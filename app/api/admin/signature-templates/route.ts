import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import {
  createTemplate,
  listTemplates,
  signatureTemplatesConfigured,
  newBlockId,
  type TemplateBlock,
  type TemplateFieldType,
  type TemplateKind,
  type PositionedField,
  type PositionedFieldType,
} from "@/lib/signatureTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only CRUD for e-signature templates — the "editor simple en el
// admin" the practice asked for: templates are pure data, so adding or
// changing one never needs a code change or a redeploy. See
// app/admin/SignaturesPanel.tsx for the UI that calls this.

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!signatureTemplatesConfigured()) {
    return NextResponse.json({ error: "not_configured", templates: [] }, { status: 503 });
  }

  const templates = await listTemplates();
  return NextResponse.json({ templates });
}

function sanitizeBlocks(input: unknown): TemplateBlock[] {
  if (!Array.isArray(input)) return [];
  const blocks: TemplateBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const id = typeof b.id === "string" && b.id ? b.id : newBlockId();
    if (b.type === "heading" && typeof b.text === "string") {
      blocks.push({ type: "heading", id, text: b.text });
    } else if (b.type === "paragraph" && typeof b.text === "string") {
      blocks.push({ type: "paragraph", id, text: b.text });
    } else if (
      b.type === "field" &&
      typeof b.label === "string" &&
      ["text", "textarea", "date", "checkbox"].includes(b.fieldType as string)
    ) {
      blocks.push({
        type: "field",
        id,
        fieldType: b.fieldType as TemplateFieldType,
        label: b.label,
        required: Boolean(b.required),
        helpText: typeof b.helpText === "string" ? b.helpText : undefined,
      });
    }
  }
  return blocks;
}

const POSITIONED_FIELD_TYPES = ["text", "date", "checkbox", "signature"];

/** Validates/coerces the Phase 2 field-placement array the same
 * defensively as sanitizeBlocks above does for Phase 1 content — never
 * trust client-submitted shapes, especially numeric percentages. */
function sanitizeFields(input: unknown): PositionedField[] {
  if (!Array.isArray(input)) return [];
  const fields: PositionedField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.label !== "string") continue;
    if (!POSITIONED_FIELD_TYPES.includes(f.type as string)) continue;
    const toPct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0);
    fields.push({
      id: typeof f.id === "string" && f.id ? f.id : newBlockId(),
      page: typeof f.page === "number" && Number.isFinite(f.page) ? Math.max(0, Math.trunc(f.page)) : 0,
      xPct: toPct(f.xPct),
      yPct: toPct(f.yPct),
      widthPct: toPct(f.widthPct) || 0.1,
      heightPct: toPct(f.heightPct) || 0.04,
      type: f.type as PositionedFieldType,
      label: f.label,
      required: Boolean(f.required),
    });
  }
  return fields;
}

export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!signatureTemplatesConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "missing_title" }, { status: 422 });
  }

  const kind: TemplateKind = body.kind === "pdf" ? "pdf" : "blocks";
  if (kind === "pdf" && (typeof body.sourcePdfKey !== "string" || !body.sourcePdfKey)) {
    return NextResponse.json({ error: "missing_source_pdf" }, { status: 422 });
  }

  const template = await createTemplate({
    title: body.title.trim(),
    description: typeof body.description === "string" ? body.description.trim() : "",
    documentType: typeof body.documentType === "string" ? body.documentType.trim() : "Custom",
    kind,
    blocks: kind === "blocks" ? sanitizeBlocks(body.blocks) : [],
    sourcePdfKey: kind === "pdf" ? body.sourcePdfKey : null,
    sourcePdfFileName: kind === "pdf" && typeof body.sourcePdfFileName === "string" ? body.sourcePdfFileName : null,
    pageCount: kind === "pdf" && typeof body.pageCount === "number" ? body.pageCount : null,
    fields: kind === "pdf" ? sanitizeFields(body.fields) : [],
    signatureLabel:
      typeof body.signatureLabel === "string" && body.signatureLabel.trim()
        ? body.signatureLabel.trim()
        : "Signature",
  });

  return NextResponse.json({ template });
}
