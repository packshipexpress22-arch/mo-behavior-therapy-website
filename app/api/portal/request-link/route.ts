import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMagicLinkToken, isPatientPortalConfigured } from "@/lib/phiAuth";
import { sendEmail } from "@/lib/email";
import { company } from "@/data/company";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().trim().email() });

// Same lightweight per-IP rate limiter pattern as app/api/admin/login/route.ts.
// A second limiter keyed by the requested email caps how many links any one
// inbox can be sent, independent of how many different IPs ask for it.
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const emailAttempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(map: Map<string, { count: number; resetAt: number }>, key: string, max: number) {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  // Always return the same generic response, success or not, so this
  // endpoint can't be used to enumerate which emails have been used before
  // — the UI shows "check your email" regardless (see app/portal/login).
  const genericOk = NextResponse.json({ ok: true });

  if (rateLimited(ipAttempts, ip, 20)) return genericOk;
  if (!isPatientPortalConfigured()) return genericOk;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return genericOk;

  const email = parsed.data.email.trim().toLowerCase();
  if (rateLimited(emailAttempts, email, 5)) return genericOk;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
  const token = createMagicLinkToken(email);
  const link = `${siteUrl}/api/portal/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0F1B2B">
      <p>Hi,</p>
      <p>Use the secure link below to sign in to the ${company.shortName} patient portal. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:9999px;text-decoration:none;font-weight:600">Sign in to the patient portal</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>${company.legalName}</p>
    </div>
  `;
  const text = `Use this link to sign in to the ${company.shortName} patient portal (expires in 15 minutes, one-time use):\n${link}\n\nIf you didn't request this, you can safely ignore this email.`;

  try {
    await sendEmail({
      to: email,
      subject: `Your secure sign-in link | ${company.shortName}`,
      html,
      text,
    });
  } catch (err) {
    // Swallow — still return genericOk so we never leak whether email
    // delivery succeeded (and so a transient SMTP failure doesn't surface a
    // 500 to a patient trying to sign in). Log to CloudWatch (staff-only,
    // never exposed to the caller) so delivery failures are actually
    // investigable — a bare `catch {}` here previously discarded the error
    // entirely despite this comment claiming otherwise.
    console.error("[portal/request-link] sendEmail failed:", err);
  }

  return genericOk;
}
