import { NextRequest, NextResponse } from "next/server";
import { referralSchema } from "@/lib/validation";
import { storeLead } from "@/lib/leadStore";
import { sendEmail, sendReferralDocumentUploadInvite } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { company } from "@/data/company";
import { escapeHtml } from "@/lib/utils";
import { createRateLimiter } from "@/lib/rateLimit";
import { autoSendSignatureTemplatesForLead } from "@/lib/signatureAutoSend";

export const runtime = "nodejs";

// Same per-IP limit as /api/leads — this endpoint previously had none at
// all beyond the honeypot. See lib/rateLimit.ts.
const rateLimited = createRateLimiter(8);

// Kept as its own endpoint (and its own form — see components/forms/ReferralForm.tsx)
// deliberately separate from /api/leads: referring professionals are not
// family intake, and this form collects less personal data about the
// prospective client.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (body.companyWebsite) return NextResponse.json({ ok: true });

  const turnstileOk = await verifyTurnstileToken(body.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 422 });
  }

  const parsed = referralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { consent, ...data } = parsed.data;

  // Added 2026-10-12: fold the caregiver's contact info into `message` —
  // the shared Lead schema (prisma/schema.prisma / lib/dynamoLeads.ts's
  // FlatLead) has no dedicated caregiver-contact columns yet, and adding
  // them would mean touching all three storage backends plus the admin
  // dashboard's display just to show three extra lines. Prepending them
  // here gets this in front of staff today, in the same place they already
  // look (the admin dashboard's "message" field and this notification
  // email); revisit as dedicated columns if staff ever need to filter/sort
  // referrals by caregiver contact info specifically.
  const caregiverContactLines = [
    data.caregiverName && `Caregiver name: ${data.caregiverName}`,
    `Caregiver phone: ${data.caregiverPhone}`,
    data.caregiverEmail && `Caregiver email: ${data.caregiverEmail}`,
  ].filter(Boolean);
  const message = [caregiverContactLines.join("\n"), data.notes].filter(Boolean).join("\n\n");

  // Normalize into the shared Lead columns (see prisma/schema.prisma) so a
  // referral shows up identifiable — by contact name, city/zip — in the
  // admin dashboard, not just in this endpoint's own notification email.
  const storedData = {
    contactName: data.professionalName,
    organization: data.organization,
    role: data.role,
    phone: data.phone,
    email: data.email,
    clientFirstName: data.clientFirstName,
    city: data.clientCity,
    zip: data.clientZip,
    message,
  };

  try {
    const lead = await storeLead({
      kind: "referral",
      data: storedData,
      language: "en",
      consent: { given: consent, textVersion: "2026-09-v1", timestamp: new Date().toISOString(), ip: null },
      source: { page: "/referral-sources", utm: {}, referrer: "" },
    });

    // Internal notification + the professional's own document-upload invite
    // are both best-effort: a failure here never costs the already-stored
    // referral. sendReferralDocumentUploadInvite() no-ops gracefully if the
    // patient/provider portal isn't configured for this stage.
    //
    // documentInviteThenAutoSend chains rather than firing in parallel —
    // same ordering rationale as app/api/leads/route.ts: the referring
    // professional should receive the document-upload invite before any
    // auto-sent signature template. See lib/signatureAutoSend.ts.
    const documentInviteThenAutoSend = sendReferralDocumentUploadInvite(lead)
      .catch((err) => {
        console.error(`[referrals] email step "document_upload_invite" failed for ${lead.id}:`, err);
      })
      .then(() => autoSendSignatureTemplatesForLead(lead, "referral"));

    const emailSteps = [
      ["internal_notification", sendEmail({
        to: process.env.COMPANY_NOTIFICATION_EMAIL || company.email,
        subject: `NEW REFERRAL – ${data.professionalName}`,
        // JSON.stringify does not HTML-escape "<"/">" — escape the whole
        // block so a crafted field value (e.g. in `notes`) can't render as
        // a live link/image/tracking-pixel in the staff member's inbox.
        html: `<h2>New Referral</h2><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre><p>Lead ID: ${lead.id}</p>`,
        text: `New referral from ${data.professionalName}\n${JSON.stringify(data, null, 2)}\nLead ID: ${lead.id}`,
        replyTo: data.email,
      })],
      ["document_upload_invite_then_signature_auto_send", documentInviteThenAutoSend],
    ] as const;
    const results = await Promise.allSettled(emailSteps.map(([, p]) => p));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[referrals] email step "${emailSteps[i]?.[0]}" failed for ${lead.id}:`, r.reason);
      }
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[referrals] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
