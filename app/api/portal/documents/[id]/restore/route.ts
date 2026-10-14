import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { getDocument, restoreDocument } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Undoes ../route.ts's DELETE (soft-delete) — brings a document back out
// of the family portal's trash. Same ownership check as the delete route.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
  const session = verifyPatientSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const doc = await getDocument(session.patientId, params.id);
  if (!doc || session.leadId === null || doc.leadId !== session.leadId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!doc.deletedAt) {
    return NextResponse.json({ error: "not_deleted" }, { status: 409 });
  }

  const updated = await restoreDocument(session.patientId, params.id);
  return NextResponse.json({ document: updated });
}
