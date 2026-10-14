import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { listAllTrashedDocuments, phiDocumentsConfigured } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: lists every trashed PHI document across all patients, for
// the "Trash" view in app/admin/AdminDashboard.tsx's Documents tab.
// Loading this also sweeps (purges) anything past its 30-day retention
// window — see lib/phiDocuments.ts's listAllTrashedDocuments.
export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!phiDocumentsConfigured()) {
    return NextResponse.json({ error: "not_configured", documents: [] }, { status: 503 });
  }

  const documents = await listAllTrashedDocuments();
  return NextResponse.json({ documents });
}
