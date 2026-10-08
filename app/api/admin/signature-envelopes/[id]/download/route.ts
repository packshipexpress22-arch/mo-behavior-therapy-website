import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getEnvelope } from "@/lib/signatureEnvelopes";
import { createDownloadUrl } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: mints a fresh, short-lived (5 min) presigned S3 GET URL for
// one completed envelope's signed PDF — same pattern as
// app/api/admin/documents/[id]/download/route.ts.
//
// patientId is required as a query param because the envelopes table's key
// is composite (patientId + envelopeId) — see lib/signatureEnvelopes.ts.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const patientId = req.nextUrl.searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "missing_patient_id" }, { status: 400 });
  }

  const envelope = await getEnvelope(patientId, params.id);
  if (!envelope || envelope.status !== "completed" || !envelope.pdfS3Key) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fileName = `${envelope.templateSnapshot.title.replace(/[^a-zA-Z0-9._ -]+/g, "")}.pdf`;
  const url = await createDownloadUrl({ s3Key: envelope.pdfS3Key, fileName });
  return NextResponse.json({ url });
}
