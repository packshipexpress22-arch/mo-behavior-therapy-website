import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAccessToken } from "@/lib/signatureAuth";
import { getEnvelope, completeEnvelope, setEnvelopePdfKey, type SignatureValue } from "@/lib/signatureEnvelopes";
import { generateEnvelopePdf } from "@/lib/signaturePdf";
import { signatureS3Key, uploadGeneratedPdf } from "@/lib/phiStorage";
import { sendSignatureCompletedNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public but token-gated (same token model as GET above): the client's
// final submit — validates required fields and the signature are present,
// writes the completion + audit trail (IP, timestamp, user agent — the
// same fields the lead-consent record already captures, see
// app/api/leads/route.ts), generates the signed PDF, uploads it to the
// existing HIPAA-compliant S3 bucket, and notifies staff. The file bytes
// never pass back through the client — only a success/failure response.
export async function POST(req: NextRequest, { params }: { params: { envelopeId: string } }) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const verified = verifySignatureAccessToken(token);
  if (!verified || verified.envelopeId !== params.envelopeId) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 401 });
  }

  const envelope = await getEnvelope(verified.email, params.envelopeId);
  if (!envelope) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (envelope.status !== "sent") {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  const fieldValuesInput = body?.fieldValues;
  const fieldValues: Record<string, string> = {};
  if (fieldValuesInput && typeof fieldValuesInput === "object") {
    for (const [k, v] of Object.entries(fieldValuesInput as Record<string, unknown>)) {
      if (typeof v === "string") fieldValues[k] = v;
      else if (typeof v === "boolean") fieldValues[k] = v ? "true" : "false";
    }
  }

  // Server-side required-field validation — never trust the client-side
  // checks in app/sign/[envelopeId]/SignatureSigningClient.tsx alone.
  // Phase 1 ("blocks") and Phase 2 ("pdf") templates store their fillable
  // fields differently, so this branches on templateSnapshot.kind; the
  // signature itself is validated separately below either way.
  if (envelope.templateSnapshot.kind === "pdf") {
    for (const field of envelope.templateSnapshot.fields) {
      if (field.type === "signature" || !field.required) continue;
      const value = fieldValues[field.id];
      if (field.type === "checkbox") {
        if (value !== "true") {
          return NextResponse.json({ error: "missing_required_field", fieldId: field.id }, { status: 422 });
        }
      } else if (!value || !value.trim()) {
        return NextResponse.json({ error: "missing_required_field", fieldId: field.id }, { status: 422 });
      }
    }
  } else {
    for (const block of envelope.templateSnapshot.blocks) {
      if (block.type !== "field" || !block.required) continue;
      const value = fieldValues[block.id];
      if (block.fieldType === "checkbox") {
        if (value !== "true") {
          return NextResponse.json({ error: "missing_required_field", fieldId: block.id }, { status: 422 });
        }
      } else if (!value || !value.trim()) {
        return NextResponse.json({ error: "missing_required_field", fieldId: block.id }, { status: 422 });
      }
    }
  }

  const signatureInput = body?.signature;
  let signature: SignatureValue | null = null;
  if (signatureInput?.type === "drawn" && typeof signatureInput.dataUrl === "string" && signatureInput.dataUrl.startsWith("data:image/png")) {
    signature = { type: "drawn", dataUrl: signatureInput.dataUrl };
  } else if (signatureInput?.type === "typed" && typeof signatureInput.typedName === "string" && signatureInput.typedName.trim()) {
    signature = { type: "typed", typedName: signatureInput.typedName.trim() };
  }
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 422 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  const completed = await completeEnvelope({
    patientId: verified.email,
    envelopeId: params.envelopeId,
    fieldValues,
    signature,
    consentIp: process.env.LOG_IP_ADDRESSES === "true" ? ip : null,
    consentUserAgent: userAgent,
  });

  try {
    const pdfBytes = await generateEnvelopePdf(completed);
    const s3Key = signatureS3Key(completed.envelopeId, `${completed.templateSnapshot.title}.pdf`);
    await uploadGeneratedPdf({ s3Key, bytes: pdfBytes });
    await setEnvelopePdfKey(completed.patientId, completed.envelopeId, s3Key);
  } catch (err) {
    // The signature/consent/field data is already durably saved above —
    // a PDF-rendering hiccup never loses the client's completed envelope.
    // An admin can see it's "completed" with no PDF yet and this can be
    // regenerated later if needed.
    // eslint-disable-next-line no-console
    console.error(`[sign] failed to generate/upload PDF for ${completed.envelopeId}:`, err);
  }

  try {
    await sendSignatureCompletedNotification({
      clientEmail: completed.clientEmail,
      documentTitle: completed.templateSnapshot.title,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[sign] failed to send completion notification for ${completed.envelopeId}:`, err);
  }

  return NextResponse.json({ ok: true });
}
