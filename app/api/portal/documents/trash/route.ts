import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { listTrashedDocumentsForPatient } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists the signed-in caregiver's own trashed documents (soft-deleted via
// ../[id]/route.ts's DELETE) for the "Trash" view in
// app/portal/PortalDashboard.tsx. Loading this also sweeps (purges) any of
// this patient's documents that have passed their 30-day retention window
// — see lib/phiDocuments.ts's listTrashedDocumentsForPatient.
export async function GET() {
  const token = cookies().get(PATIENT_COOKIE_NAME)?.value;
  const session = verifyPatientSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const documents = await listTrashedDocumentsForPatient(session.patientId, session.leadId);
  return NextResponse.json({ documents });
}
