import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { getDocument, markDocumentUploaded } from "@/lib/phiDocuments";
import { headUploadedObject } from "@/lib/phiStorage";
import { sendDocumentUploadedNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
    const session = verifyPatientSessionToken(token);
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const doc = await getDocument(session.patientId, params.id);
    if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Confirm the object actually landed in S3 rather than trusting the
  // client's say-so - a patient's browser could call this without really
  // uploading (or the upload could have failed silently).
  const head = await headUploadedObject(doc.s3Key);
    if (!head) {
          return NextResponse.json({ error: "upload_not_found" }, { status: 409 });
    }

  const updated = await markDocumentUploaded(session.patientId, params.id, head.sizeBytes);

  // Best-effort, non-blocking - same store-first-then-notify pattern as the
  // lead pipeline (app/api/leads/route.ts): a notification-email hiccup
  // must never fail the patient's upload confirmation. The document itself
  // is already safely in S3 by this point regardless of what happens below.
  sendDocumentUploadedNotification(updated).catch((err) => {
        console.error(`[portal] document-uploaded notification failed for ${updated.documentId}:`, err);
  });

  return NextResponse.json({ document: updated });
}
