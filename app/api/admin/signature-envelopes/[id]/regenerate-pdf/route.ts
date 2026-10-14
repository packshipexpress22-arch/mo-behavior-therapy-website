import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getEnvelope, setEnvelopePdfKey, setEnvelopePdfError } from "@/lib/signatureEnvelopes";
import { generateEnvelopePdf } from "@/lib/signaturePdf";
import { signatureS3Key, uploadGeneratedPdf } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: retries the signed-PDF render/upload for a "completed"
// envelope that doesn't have a pdfS3Key yet (or whose previous attempt
// failed — see pdfGenerationError on lib/signatureEnvelopes.ts). This is
// the one recovery path for the gap that same comment calls out: the
// client's signature/consent data is saved durably the moment they submit,
// but the PDF itself is best-effort at that point, so a transient failure
// (e.g. S3 hiccup) or a since-fixed issue (e.g. a template's source PDF
// re-uploaded) can be cleared without asking the client to sign again.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientId = typeof body?.patientId === "string" ? body.patientId : "";
  if (!patientId) {
    return NextResponse.json({ error: "missing_patient_id" }, { status: 400 });
  }

  const envelope = await getEnvelope(patientId, params.id);
  if (!envelope) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (envelope.status !== "completed") {
    return NextResponse.json({ error: "not_completed" }, { status: 409 });
  }

  try {
    const pdfBytes = await generateEnvelopePdf(envelope);
    const s3Key = signatureS3Key(envelope.envelopeId, `${envelope.templateSnapshot.title}.pdf`);
    await uploadGeneratedPdf({ s3Key, bytes: pdfBytes });
    await setEnvelopePdfKey(envelope.patientId, envelope.envelopeId, s3Key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[regenerate-pdf] failed for ${envelope.envelopeId}:`, err);
    await setEnvelopePdfError(envelope.patientId, envelope.envelopeId, message);
    return NextResponse.json({ error: "pdf_generation_failed", message }, { status: 500 });
  }
}
