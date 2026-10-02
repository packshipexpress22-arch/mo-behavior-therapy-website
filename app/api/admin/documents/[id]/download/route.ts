import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getDocument } from "@/lib/phiDocuments";
import { createDownloadUrl } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: mints a fresh, short-lived (5 min) presigned S3 GET URL for
// one document so a logged-in staff member can view/download it. The URL
// is generated on demand per click and returned directly to the admin's
// own authenticated browser session - it is never stored, logged, or
// emailed (see lib/email.ts's sendDocumentUploadedNotification, which only
// ever links to the admin dashboard itself, never to a document).
//
// patientId is required as a query param because the PHI documents table's
// key is composite (patientId + documentId) - see lib/phiDocuments.ts.
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

  const doc = await getDocument(patientId, params.id);
    if (!doc || doc.status !== "uploaded") {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

  const url = await createDownloadUrl({ s3Key: doc.s3Key, fileName: doc.fileName });
    return NextResponse.json({ url });
}
