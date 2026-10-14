import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation";
import { storeLead } from "@/lib/leadStore";
import { sendInternalNotification, sendClientConfirmation, sendDocumentUploadInvite } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createRateLimiter } from "@/lib/rateLimit";
import { autoSendSignatureTemplatesForLead } from "@/lib/signatureAutoSend";

export const runtime = "nodejs";

// 8 lead submissions/min/IP is generous for real traffic, tight for bots.
// See lib/rateLimit.ts for the known in-memory/per-Lambda-instance caveat.
const rateLimited = createRateLimiter(8);

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

    // Notification + confirmation + document-upload-invite + signature
    // auto-send are all best-effort and all fire immediately, independently
    // of each other, the moment the lead is stored: log failures but never
    // fail the request the visitor is waiting on, and never discard the
    // lead that's already safely stored. sendDocumentUploadInvite() no-ops
    // gracefully if the patient portal isn't configured for this stage (see
    // lib/phiAuth.ts's isPatientPortalConfigured()), so it's safe to always
    // include. Changed 2026-10-14: signature auto-send used to be chained
    // after the document-upload-invite email finished sending — the family
    // reported it felt like it was "waiting" for something. There was never
    // an actual dependency between the two (auto-send doesn't need the
    // invite email's content or the client having uploaded anything), so
    // it now fires at the same time as the rest, same as every other email
    // here — see lib/signatureAutoSend.ts.
    const emailSteps = [
      ["internal_notification", sendInternalNotification(lead)],
      ["client_confirmation", sendClientConfirmation(lead)],
      ["document_upload_invite", sendDocumentUploadInvite(lead)],
      ["signature_auto_send", autoSendSignatureTemplatesForLead(lead, "family")],
    ] as const;
    const results = await Promise.allSettled(emailSteps.map(([, p]) => p));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        // eslint-disable-next-line no-console
        console.error(`[leads] email step "${emailSteps[i]?.[0]}" failed for ${lead.id}:`, r.reason);
      }
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[leads] failed to store lead:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
