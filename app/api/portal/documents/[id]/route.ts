import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { getDocument, softDeleteDocument } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Family-portal side of the document trash/restore feature (added
// 2026-10-14, at the user's request, for the case where a caregiver
// uploads the wrong file by mistake). This is a SOFT delete: the document
// moves to a 30-day trash (see lib/phiDocuments.ts's
// softDeleteDocument/TRASH_RETENTION_DAYS) and can still be restored from
// there — see ./restore/route.ts and ../trash/route.ts. The admin-side
// equivalent is app/api/admin/documents/[id]/route.ts.
//
// leadId scoping mirrors lib/phiDocuments.ts's listDocumentsForPatient: a
// null session.leadId (no case could be determined for this login) can
// never prove ownership of one specific document, so it's denied rather
// than trusted — same reasoning as that function returning [] in that case.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
  const session = verifyPatientSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const doc = await getDocument(session.patientId, params.id);
  if (!doc || session.leadId === null || doc.leadId !== session.leadId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (doc.deletedAt) {
    return NextResponse.json({ error: "already_deleted" }, { status: 409 });
  }

  const updated = await softDeleteDocument(session.patientId, params.id);
  return NextResponse.json({ document: updated });
}
