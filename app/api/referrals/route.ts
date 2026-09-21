import { NextRequest, NextResponse } from "next/server";
import { referralSchema } from "@/lib/validation";
import { storeLead } from "@/lib/leadStore";
import { sendEmail } from "@/lib/email";
import { company } from "@/data/company";

export const runtime = "nodejs";

// Kept as its own endpoint (and its own form — see components/forms/ReferralForm.tsx)
// deliberately separate from /api/leads: referring professionals are not
// family intake, and this form collects less personal data about the
// prospective client.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (body.companyWebsite) return NextResponse.json({ ok: true });

  const parsed = referralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { consent, ...data } = parsed.data;

  try {
    const lead = await storeLead({
      kind: "referral",
      data,
      language: "en",
      consent: { given: consent, textVersion: "2026-09-v1", timestamp: new Date().toISOString(), ip: null },
      source: { page: "/referral-sources", utm: {}, referrer: "" },
    });

    await sendEmail({
      to: process.env.COMPANY_NOTIFICATION_EMAIL || company.email,
      subject: `NEW REFERRAL – ${data.professionalName}`,
      html: `<h2>New Referral</h2><pre>${JSON.stringify(data, null, 2)}</pre><p>Lead ID: ${lead.id}</p>`,
      text: `New referral from ${data.professionalName}\n${JSON.stringify(data, null, 2)}\nLead ID: ${lead.id}`,
      replyTo: data.email,
    }).catch((err) => console.error("[referrals] email failed:", err));

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[referrals] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
