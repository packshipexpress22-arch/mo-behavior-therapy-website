import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createSessionToken,
  constantTimeStringEqual,
  DUMMY_PASSWORD_HASH,
  ADMIN_COOKIE_NAME,
} from "@/lib/adminAuth";
import { getAdminCredentials } from "@/lib/adminCredentials";
import { getClientIp } from "@/lib/clientIp";
import { durableRateLimit } from "@/lib/securityStore";

export const runtime = "nodejs";

// In-memory fallback layer — kept so this endpoint is never LESS protected
// than before, for the window between this deploy and SecurityTable
// actually being provisioned (and for the (unlikely) case a DynamoDB call
// itself fails). The real fix for the known gap this used to have on its
// own — reset on cold start, not shared across concurrent Lambda instances
// — is durableRateLimit() below (mo-security-audit.md finding #6).
const attempts = new Map<string, { count: number; resetAt: number }>();
function inMemoryRateLimited(ip: string) {
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
  const ip = getClientIp(req);
  // durableRateLimit() returns false unconditionally (never limits) until
  // SECURITY_TABLE is deployed, so the in-memory check is ORed in to keep
  // today's level of protection in the meantime — see the comments above.
  const limited = (await durableRateLimit("admin-login", ip, 10, 60_000)) || inMemoryRateLimited(ip);
  if (limited) {
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

  // Both checks always run, regardless of whether the username matches —
  // a wrong username falls through to hashing the submitted password
  // against a dummy hash instead of short-circuiting, so it costs the same
  // scryptSync time as a wrong password for a correct username. Without
  // this, response timing alone would tell an attacker whether a guessed
  // username exists (security audit finding #11, mo-security-audit.md).
  const usernameOk = constantTimeStringEqual(username, creds.username);
  const passwordOk = verifyPassword(password, usernameOk ? creds.passwordHash : DUMMY_PASSWORD_HASH);
  if (!usernameOk || !passwordOk) {
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
