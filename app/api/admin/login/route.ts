import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getAdminCredentials } from "@/lib/adminCredentials";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  // Credentials are read from DynamoDB (bootstrapped from the
  // ADMIN_USER/ADMIN_PASSWORD_HASH build-time secrets on first use) rather
  // than straight from process.env, so a password changed via
  // /api/admin/password takes effect immediately - no redeploy needed. See
  // lib/adminCredentials.ts.
  const creds = await getAdminCredentials();
  if (!creds) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (username !== creds.username || !verifyPassword(password, creds.passwordHash)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
