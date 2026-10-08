import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  newBlockId,
  type TemplateBlock,
  type TemplateFieldType,
  type PositionedField,
  type PositionedFieldType,
} from "@/lib/signatureTemplates";
import { createViewUrl } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const template = await getTemplate(params.id);
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Phase 2: hand the editor a fresh presigned view URL for the source PDF
  // each time the template is (re-)opened, rather than persisting one —
  // see lib/phiStorage.ts's createViewUrl.
  const viewUrl = template.kind === "pdf" && template.sourcePdfKey ? await createViewUrl({ s3Key: template.sourcePdfKey }) : null;

  return NextResponse.json({ template, viewUrl });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.documentType === "string") patch.documentType = body.documentType.trim();
  if (typeof body.signatureLabel === "string") patch.signatureLabel = body.signatureLabel.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.kind === "blocks" || body.kind === "pdf") patch.kind = body.kind;
  if (body.blocks !== undefined) patch.blocks = sanitizeBlocks(body.blocks);
  if (typeof body.sourcePdfKey === "string") patch.sourcePdfKey = body.sourcePdfKey;
  if (typeof body.sourcePdfFileName === "string") patch.sourcePdfFileName = body.sourcePdfFileName;
  if (typeof body.pageCount === "number") patch.pageCount = body.pageCount;
  if (body.fields !== undefined) patch.fields = sanitizeFields(body.fields);

  const updated = await updateTemplate(params.id, patch);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await deleteTemplate(params.id);
  return NextResponse.json({ ok: true });
}
