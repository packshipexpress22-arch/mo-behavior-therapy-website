import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation";
import { storeLead } from "@/lib/leadStore";
import { sendInternalNotification, sendClientConfirmation } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 8; // 8 lead submissions/min/IP is generous for real traffic, tight for bots
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Honeypot: a real visitor never fills a field named companyWebsite that's
  // visually hidden in the form. If it's filled, silently pretend success
  // instead of tipping the bot off.
  if (body.companyWebsite) {
    return NextResponse.json({ ok: true });
  }

  const turnstileOk = await verifyTurnstileToken(body.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 422 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { consent, consentTextVersion, sourcePage, utm, referrer, preferredLanguage, ...data } =
    parsed.data;

  try {
    // Store first — never lose a lead because an email happened to fail.
    const lead = await storeLead({
      kind: "family",
      data,
      language: preferredLanguage || "en",
      consent: {
        given: consent,
        textVersion: consentTextVersion,
        timestamp: new Date().toISOString(),
        ip: process.env.LOG_IP_ADDRESSES === "true" ? ip : null,
      },
      source: {
        page: sourcePage || "",
        utm: utm || {},
        referrer: referrer || "",
      },
    });

    // Notification + confirmation emails are best-effort: log failures but
    // never fail the request the visitor is waiting on, and never discard
    // the lead that's already safely stored.
    const results = await Promise.allSettled([
      sendInternalNotification(lead),
      sendClientConfirmation(lead),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        // eslint-disable-next-line no-console
        console.error(`[leads] email step ${i} failed for ${lead.id}:`, r.reason);
      }
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[leads] failed to store lead:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
