import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, createPatientSessionToken, PATIENT_COOKIE_NAME } from "@/lib/phiAuth";
import { claimOnce } from "@/lib/securityStore";

export const runtime = "nodejs";

// Generous fixed TTL for the claim record — both magic-link lifetimes this
// app issues (the 15-minute interactive one and the 24-hour document-invite
// one, see lib/phiAuth.ts) comfortably fit inside it; the claim entry
// outliving the token's own expiry by a wide margin is harmless (it's only
// ever checked while the token could otherwise still verify).
const CLAIM_TTL_SECONDS = 25 * 60 * 60;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = verifyMagicLinkToken(token);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  if (!verified) {
    return NextResponse.redirect(`${siteUrl}/portal/login?error=expired_link`);
  }

  // Signature + expiry alone (above) let the same link be reused any number
  // of times within its window — claim the token's nonce so a second use of
  // the exact same link (prefetched by a mail scanner, forwarded, reopened
  // from browser history) is rejected the same way an expired one is, even
  // while it would otherwise still verify (security audit finding #7).
  const firstUse = await claimOnce(`magiclink#${verified.nonce}`, CLAIM_TTL_SECONDS);
  if (!firstUse) {
    return NextResponse.redirect(`${siteUrl}/portal/login?error=expired_link`);
  }

  const session = createPatientSessionToken(verified.email, verified.leadId);
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
