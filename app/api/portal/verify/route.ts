import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, createPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = verifyMagicLinkToken(token);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  if (!verified) {
    return NextResponse.redirect(`${siteUrl}/portal/login?error=expired_link`);
  }

  const session = createPatientSessionToken(verified.email);
  const res = NextResponse.redirect(`${siteUrl}/portal`);
  res.cookies.set(PATIENT_COOKIE_NAME, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, matches SESSION_TTL_MS in lib/phiAuth.ts
  });
  return res;
}
