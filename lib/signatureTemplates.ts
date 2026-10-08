import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

// E-signature template metadata — DynamoDB only (SST-managed table, see
// SignatureTemplatesTable in sst.config.ts, same pattern as MoLeadsTable:
// SST provisions and grants full CRUD automatically via `link`, no manual
// IAM permission list needed like the manually-created PHI bucket/table).
//
// A template is admin-authored content: a title/description plus an
// ordered list of "blocks" (static paragraphs/headings or fillable
// fields) and a label for the signature itself. Phase 1 scope: the admin
// builds/edits templates through a simple editor in the admin dashboard
// (see app/admin/SignaturesPanel.tsx) — no code change or redeploy is
// needed to add or edit a template's content.
//
// IMPORTANT: when a template is sent to a client (see
// lib/signatureEnvelopes.ts's createEnvelope), the envelope stores a frozen
// COPY of the template's content at that moment ("templateSnapshot"). A
// template can keep being edited afterward without ever altering what a
// client already saw, filled in, or signed — the signed PDF and the
// audit trail always reflect the exact content that was presented.

const TABLE_NAME = process.env.SIGNATURE_TEMPLATES_TABLE;

export function signatureTemplatesConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

export type TemplateFieldType = "text" | "textarea" | "date" | "checkbox";

export type TemplateBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "paragraph"; id: string; text: string }
  | {
      type: "field";
      id: string;
      fieldType: TemplateFieldType;
      label: string;
      required: boolean;
      helpText?: string;
    };

// Phase 2 (added 2026-10-08): a template can instead be built from an
// admin-UPLOADED PDF (an existing intake form, treatment plan, etc.) with
// fillable/signature fields placed visually on top of it — see
// app/admin/PdfFieldEditor.tsx — rather than authored from scratch as
// `blocks`. `kind` picks which of the two shapes below is in play; the
// unused one is just an empty array/null, never both populated.
export type TemplateKind = "blocks" | "pdf";

export type PositionedFieldType = "text" | "date" | "checkbox" | "signature";

// Position is stored as fractions (0..1) of the PDF PAGE's own width/height,
// measured from the page's TOP-LEFT corner (matching how the admin's editor
// and the client's signing page both lay out their on-screen overlay) —
// resolution-independent, so it works whether the page is rendered at any
// zoom level in the browser or at its native point size when lib/signaturePdf.ts
// stamps the final values onto the real PDF (which flips to PDF's bottom-left
// origin at that point — see generateStampedPdf).
export type PositionedField = {
  id: string;
  page: number; // 0-indexed
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  type: PositionedFieldType;
  label: string;
  required: boolean;
};

export type SignatureTemplate = {
  id: string;
  title: string;
  description: string;
  documentType: string; // free text set by the admin, e.g. "Intake", "Assessment" — not a fixed enum, since Phase 1 lets the admin define any template
  kind: TemplateKind;
  blocks: TemplateBlock[]; // kind === "blocks"
  sourcePdfKey: string | null; // kind === "pdf" — S3 key under signature-sources/ (see lib/phiStorage.ts)
  sourcePdfFileName: string | null;
  pageCount: number | null;
  fields: PositionedField[]; // kind === "pdf"
  signatureLabel: string; // e.g. "Parent/Guardian Signature"
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Backfills defaults for templates written before Phase 2 (which lacked
 * `kind`/`sourcePdfKey`/`fields` entirely) so every reader gets a
 * fully-shaped object regardless of when the item was created. */
function normalizeTemplate(item: Record<string, unknown>): SignatureTemplate {
  return {
    id: item.id as string,
    title: (item.title as string) ?? "",
    description: (item.description as string) ?? "",
    documentType: (item.documentType as string) ?? "Custom",
    kind: item.kind === "pdf" ? "pdf" : "blocks",
    blocks: Array.isArray(item.blocks) ? (item.blocks as TemplateBlock[]) : [],
    sourcePdfKey: typeof item.sourcePdfKey === "string" ? item.sourcePdfKey : null,
    sourcePdfFileName: typeof item.sourcePdfFileName === "string" ? item.sourcePdfFileName : null,
    pageCount: typeof item.pageCount === "number" ? item.pageCount : null,
    fields: Array.isArray(item.fields) ? (item.fields as PositionedField[]) : [],
    signatureLabel: (item.signatureLabel as string) || "Signature",
    active: Boolean(item.active),
    createdAt: (item.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (item.updatedAt as string) ?? new Date().toISOString(),
  };
}

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("signatureTemplates: SIGNATURE_TEMPLATES_TABLE is not configured");
  }
  return client;
}

export function newBlockId(): string {
  return nanoid(8);
}

export async function createTemplate(args: {
  title: string;
  description: string;
  documentType: string;
  kind: TemplateKind;
  blocks: TemplateBlock[];
  sourcePdfKey?: string | null;
  sourcePdfFileName?: string | null;
  pageCount?: number | null;
  fields?: PositionedField[];
  signatureLabel: string;
}): Promise<SignatureTemplate> {
  const c = requireClient();
  const now = new Date().toISOString();
  const template: SignatureTemplate = {
    id: nanoid(12),
    title: args.title,
    description: args.description,
    documentType: args.documentType,
    kind: args.kind,
    blocks: args.kind === "blocks" ? args.blocks : [],
    sourcePdfKey: args.kind === "pdf" ? args.sourcePdfKey ?? null : null,
    sourcePdfFileName: args.kind === "pdf" ? args.sourcePdfFileName ?? null : null,
    pageCount: args.kind === "pdf" ? args.pageCount ?? null : null,
    fields: args.kind === "pdf" ? args.fields ?? [] : [],
    signatureLabel: args.signatureLabel || "Signature",
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: template }));
  return template;
}

export async function getTemplate(id: string): Promise<SignatureTemplate | null> {
  const c = requireClient();
  const res = await c.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));
  return res.Item ? normalizeTemplate(res.Item as Record<string, unknown>) : null;
}

export async function updateTemplate(
  id: string,
  patch: Partial<
    Pick<
      SignatureTemplate,
      | "title"
      | "description"
      | "documentType"
      | "kind"
      | "blocks"
      | "sourcePdfKey"
      | "sourcePdfFileName"
      | "pageCount"
      | "fields"
      | "signatureLabel"
      | "active"
    >
  >
): Promise<SignatureTemplate | null> {
  const c = requireClient();
  const existing = await getTemplate(id);
  if (!existing) return null;
  const updated: SignatureTemplate = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return updated;
}

export async function deleteTemplate(id: string): Promise<void> {
  const c = requireClient();
  await c.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}

/**
 * Admin-only: lists every template (active and inactive) for the editor's
 * list view. A full table Scan is acceptable here for the same reason as
 * lib/phiDocuments.ts's listAllDocuments() — this table only ever holds a
 * small clinic's own template definitions, the route that calls this is
 * session-gated behind admin auth, and result volume is tiny.
 */
export async function listTemplates(): Promise<SignatureTemplate[]> {
  const c = requireClient();
  const items: SignatureTemplate[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await c.send(new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey }));
    items.push(...((res.Items as Record<string, unknown>[]) ?? []).map(normalizeTemplate));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
