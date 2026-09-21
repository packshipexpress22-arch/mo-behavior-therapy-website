import { NextRequest, NextResponse } from "next/server";
import { careersSchema } from "@/lib/validation";
import { storeLead } from "@/lib/leadStore";
import { sendEmail } from "@/lib/email";
import { company } from "@/data/company";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (body.companyWebsite) return NextResponse.json({ ok: true });

  const parsed = careersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const lead = await storeLead({
      kind: "career",
      data: parsed.data,
      language: "en",
      consent: { given: true, textVersion: "2026-09-v1", timestamp: new Date().toISOString(), ip: null },
      source: { page: "/careers", utm: {}, referrer: "" },
    });

    await sendEmail({
      to: process.env.COMPANY_NOTIFICATION_EMAIL || company.email,
      subject: `NEW APPLICATION – ${parsed.data.positionAppliedFor} – ${parsed.data.applicantName}`,
      html: `<h2>New Job Application</h2><pre>${JSON.stringify(parsed.data, null, 2)}</pre><p>Lead ID: ${lead.id}</p>`,
      text: `New application: ${JSON.stringify(parsed.data, null, 2)}\nLead ID: ${lead.id}`,
      replyTo: parsed.data.email,
    }).catch((err) => console.error("[careers] email failed:", err));

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[careers] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
