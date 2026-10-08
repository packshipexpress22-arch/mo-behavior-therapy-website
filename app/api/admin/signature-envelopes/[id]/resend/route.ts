import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getEnvelope } from "@/lib/signatureEnvelopes";
import { createSignatureAccessToken } from "@/lib/signatureAuth";
import { sendSignatureRequestInvite } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: mints a fresh signing link and re-sends the invite email for
// an envelope that's still "sent" (not yet completed) — the signature
// equivalent of /portal/login letting a caregiver request a fresh magic
// link if their original one expired.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientId = typeof body?.patientId === "string" ? body.patientId : "";
  if (!patientId) {
    return NextResponse.json({ error: "missing_patient_id" }, { status: 400 });
  }

  const envelope = await getEnvelope(patientId, params.id);
  if (!envelope) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (envelope.status !== "sent") {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
  const linkToken = createSignatureAccessToken(envelope.envelopeId, envelope.clientEmail);
  const link = `${siteUrl}/sign/${envelope.envelopeId}?token=${encodeURIComponent(linkToken)}`;

  await sendSignatureRequestInvite({
    clientName: envelope.clientName,
    clientEmail: envelope.clientEmail,
    documentTitle: envelope.templateSnapshot.title,
    link,
  });

  return NextResponse.json({ ok: true });
}
