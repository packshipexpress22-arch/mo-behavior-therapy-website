import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, verifyPassword, hashPassword, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getAdminCredentials, updateAdminPassword } from "@/lib/adminCredentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-service password change, used both for a voluntary change ("Change
// password" button in AdminDashboard.tsx) and for the forced rotation
// app/admin/page.tsx triggers once PASSWORD_MAX_AGE_MS has elapsed
// (app/admin/change-password/page.tsx is the one UI for both cases).
// Session-gated like every other /api/admin/* route, and additionally
// requires the CURRENT password (not just a valid session cookie) before
// accepting a new one - a stolen/left-open session shouldn't be enough on
// its own to lock out the real admin.
export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < 12) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "same_password" }, { status: 400 });
  }

  const creds = await getAdminCredentials();
  if (!creds) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (!verifyPassword(currentPassword, creds.passwordHash)) {
    return NextResponse.json({ error: "invalid_current_password" }, { status: 401 });
  }

  await updateAdminPassword(hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
