import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getDocument, softDeleteDocument } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-side soft-delete for the document trash/restore feature (added
// 2026-10-14) — see app/api/portal/documents/[id]/route.ts for the
// family-portal equivalent and lib/phiDocuments.ts for the shared
// trash/restore/purge mechanics. patientId is required as a query param
// for the same reason as [id]/download/route.ts: the PHI documents
// table's key is composite (patientId + documentId).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (!doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (doc.deletedAt) {
    return NextResponse.json({ error: "already_deleted" }, { status: 409 });
  }

  const updated = await softDeleteDocument(patientId, params.id);
  return NextResponse.json({ document: updated });
}
