import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { listAllDocuments, phiDocumentsConfigured } from "@/lib/phiDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: lists every uploaded PHI document across all patients, for
// the "Documents" tab in app/admin/AdminDashboard.tsx. Metadata only
// (patient email, document type, size, timestamps) - never the file bytes;
// an admin downloads an individual file via
// GET /api/admin/documents/[id]/download, which mints a short-lived
// presigned S3 URL on demand.
export async function GET() {
    const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session) {
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

  if (!phiDocumentsConfigured()) {
        return NextResponse.json({ error: "not_configured", documents: [] }, { status: 503 });
  }

  const documents = await listAllDocuments();
    return NextResponse.json({ documents });
}
