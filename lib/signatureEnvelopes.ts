import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";
import type { SignatureTemplate } from "./signatureTemplates";

// E-signature envelope metadata — DynamoDB only (SST-managed table, see
// SignatureEnvelopesTable in sst.config.ts). An "envelope" is one send of
// one template to one client: it freezes a snapshot of the template's
// content at send time, then accumulates the client's filled-in field
// values, their signature, and a basic audit trail once they complete it.
//
// Key shape mirrors lib/phiDocuments.ts: partition key `patientId` (the
// client's normalized email — reusing the exact same identity convention
// as the patient portal, though this module is intentionally independent
// of lib/phiAuth.ts's session system), sort key `envelopeId` (nanoid).
// This lets a future "my documents to sign" patient-facing list query by
// email directly, the same way PHI documents already do, without a GSI.

const TABLE_NAME = process.env.SIGNATURE_ENVELOPES_TABLE;

export function signatureEnvelopesConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

export type EnvelopeStatus = "sent" | "completed" | "voided";

export type SignatureValue =
  | { type: "drawn"; dataUrl: string }
  | { type: "typed"; typedName: string };

// A frozen copy of exactly what the client was shown — see the header note
// in lib/signatureTemplates.ts on why this is never re-derived from the
// live template after send time. Phase 2 (2026-10-08): also freezes the
// source-PDF reference and field positions for "pdf"-kind templates, same
// immutability guarantee — the admin can keep editing the template's field
// layout afterward without ever altering what a client already saw/signed.
export type TemplateSnapshot = Pick<
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
>;

export type SignatureEnvelope = {
  patientId: string; // normalized client email
  envelopeId: string;
  templateId: string;
  templateSnapshot: TemplateSnapshot;
  clientName: string;
  clientEmail: string;
  status: EnvelopeStatus;
  fieldValues: Record<string, string>;
  // Added 2026-10-13: the printed name of the caregiver who actually signs,
  // captured as its own mandatory field on the signing page (see
  // app/sign/[envelopeId]/SignatureSigningClient.tsx) — distinct from
  // `clientName` above, which is just whoever the envelope was addressed to
  // (typed by admin, or by the auto-send feature from the lead's own
  // contact name) and isn't confirmed by the actual signer. Null until the
  // envelope is completed.
  caregiverName: string | null;
  signature: SignatureValue | null;
  consentIp: string | null;
  consentTimestamp: string | null;
  consentUserAgent: string | null;
  pdfS3Key: string | null;
  // Set when the signed-PDF render/upload step (see
  // app/api/sign/[envelopeId]/submit/route.ts and, for a retry, the admin's
  // regenerate-pdf route) throws — the envelope still completes either way
  // (the signature/consent data is the source of truth), but this is what
  // lets the admin dashboard explain *why* the Download button is missing
  // instead of just not showing it, and gives them something to act on
  // (e.g. "has no sourcePdfKey" means the template's source PDF is gone).
  // Cleared back to null whenever pdfS3Key is successfully set.
  pdfGenerationError: string | null;
  sentBy: string; // admin username who sent it
  sentAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("signatureEnvelopes: SIGNATURE_ENVELOPES_TABLE is not configured");
  }
  return client;
}

export async function createEnvelope(args: {
  templateId: string;
  templateSnapshot: TemplateSnapshot;
  clientName: string;
  clientEmail: string;
  sentBy: string;
}): Promise<SignatureEnvelope> {
  const c = requireClient();
  const now = new Date().toISOString();
  const envelope: SignatureEnvelope = {
    patientId: args.clientEmail.trim().toLowerCase(),
    envelopeId: nanoid(12),
    templateId: args.templateId,
    templateSnapshot: args.templateSnapshot,
    clientName: args.clientName,
    clientEmail: args.clientEmail.trim().toLowerCase(),
    status: "sent",
    fieldValues: {},
    caregiverName: null,
    signature: null,
    consentIp: null,
    consentTimestamp: null,
    consentUserAgent: null,
    pdfS3Key: null,
    pdfGenerationError: null,
    sentBy: args.sentBy,
    sentAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: envelope }));
  return envelope;
}

export async function getEnvelope(patientId: string, envelopeId: string): Promise<SignatureEnvelope | null> {
  const c = requireClient();
  const res = await c.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { patientId, envelopeId } })
  );
  return (res.Item as SignatureEnvelope) ?? null;
}

// Thrown by completeEnvelope() when the conditional write below loses a
// race — see its own comment for why this can happen and why a plain
// read-then-write used to let it through silently (security audit finding
// #8, mo-security-audit.md). Callers (app/api/sign/[envelopeId]/submit/route.ts)
// catch this and respond the same way as the existing early "already
// completed" check (409), rather than a generic 500.
export class EnvelopeAlreadyCompletedError extends Error {
  constructor() {
    super("envelope_already_completed");
    this.name = "EnvelopeAlreadyCompletedError";
  }
}

export async function completeEnvelope(args: {
  patientId: string;
  envelopeId: string;
  fieldValues: Record<string, string>;
  // Required — see the caregiverName field note on SignatureEnvelope above.
  caregiverName: string;
  signature: SignatureValue;
  consentIp: string | null;
  consentUserAgent: string | null;
}): Promise<SignatureEnvelope> {
  const c = requireClient();
  const now = new Date().toISOString();
  const existing = await getEnvelope(args.patientId, args.envelopeId);
  if (!existing) throw new Error("envelope_not_found");
  const updated: SignatureEnvelope = {
    ...existing,
    status: "completed",
    fieldValues: args.fieldValues,
    caregiverName: args.caregiverName,
    signature: args.signature,
    consentIp: args.consentIp,
    consentUserAgent: args.consentUserAgent,
    consentTimestamp: now,
    completedAt: now,
    pdfGenerationError: null,
    updatedAt: now,
  };
  try {
    // The route's own "already completed?" check (envelope.status !==
    // "sent") is a plain read a moment earlier — it can't stop two
    // near-simultaneous submits (double-click, a client retry on a slow
    // response) both reading status:"sent" and both proceeding to write,
    // with the second silently overwriting the first signature. This
    // ConditionExpression makes the actual write atomic: it only succeeds
    // if the item *in DynamoDB at write time* still has status "sent",
    // so only one of the two racing writes can ever succeed.
    await c.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: updated,
        ConditionExpression: "#status = :expectedStatus",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":expectedStatus": "sent" },
      })
    );
  } catch (err) {
    // Duck-typed rather than imported (AWS SDK v3 exceptions are
    // package-specific classes; checking `.name` avoids depending on
    // exactly where the DynamoDB document client re-exports it from).
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      throw new EnvelopeAlreadyCompletedError();
    }
    throw err;
  }
  return updated;
}

/** Called on a successful PDF render+upload — stores the key and clears any
 * previous pdfGenerationError (e.g. after an admin-triggered retry). */
export async function setEnvelopePdfKey(
  patientId: string,
  envelopeId: string,
  pdfS3Key: string
): Promise<void> {
  const c = requireClient();
  const existing = await getEnvelope(patientId, envelopeId);
  if (!existing) return;
  await c.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...existing, pdfS3Key, pdfGenerationError: null, updatedAt: new Date().toISOString() },
    })
  );
}

/** Called when the PDF render/upload step throws — see the
 * pdfGenerationError field note on SignatureEnvelope above. Never throws
 * itself: this runs from inside an already-caught error path, and losing
 * the diagnostic message is worse than losing this write. */
export async function setEnvelopePdfError(
  patientId: string,
  envelopeId: string,
  message: string
): Promise<void> {
  try {
    const c = requireClient();
    const existing = await getEnvelope(patientId, envelopeId);
    if (!existing) return;
    await c.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...existing, pdfGenerationError: message.slice(0, 500), updatedAt: new Date().toISOString() },
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[signatureEnvelopes] failed to record pdfGenerationError for ${envelopeId}:`, err);
  }
}

/**
 * Admin-only: lists every envelope across all clients, for the admin
 * dashboard's "Signatures" tab. Same tiny-volume Scan justification as
 * lib/phiDocuments.ts's listAllDocuments() / lib/signatureTemplates.ts's
 * listTemplates().
 */
export async function listAllEnvelopes(): Promise<SignatureEnvelope[]> {
  const c = requireClient();
  const items: SignatureEnvelope[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await c.send(new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey }));
    items.push(...((res.Items as SignatureEnvelope[]) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
