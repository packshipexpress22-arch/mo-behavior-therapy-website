import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getDocument, restoreDocument } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Undoes ../route.ts's DELETE (soft-delete) — brings a document back out
// of the admin dashboard's trash view.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (!doc.deletedAt) {
    return NextResponse.json({ error: "not_deleted" }, { status: 409 });
  }

  const updated = await restoreDocument(patientId, params.id);
  return NextResponse.json({ document: updated });
}
