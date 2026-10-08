import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getTemplate } from "@/lib/signatureTemplates";
import {
  createEnvelope,
  listAllEnvelopes,
  signatureEnvelopesConfigured,
} from "@/lib/signatureEnvelopes";
import { createSignatureAccessToken, isSignatureAuthConfigured } from "@/lib/signatureAuth";
import { sendSignatureRequestInvite } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: lists every signature envelope (sent + completed), for the
// admin dashboard's "Signatures" tab. Same tiny-volume Scan justification
// used throughout this app (see lib/signatureEnvelopes.ts).
export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!signatureEnvelopesConfigured()) {
    return NextResponse.json({ error: "not_configured", envelopes: [] }, { status: 503 });
  }

  const envelopes = await listAllEnvelopes();
  return NextResponse.json({ envelopes });
}

// Admin-only: picks a template + a client, freezes a snapshot of the
// template's current content into a new envelope, and emails the client a
// one-time link to review and sign it. Mirrors how app/api/leads/route.ts
// sends its document-upload invite — store first, then send, and never let
// an email failure hide a successfully-created envelope from the admin.
export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!signatureEnvelopesConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!isSignatureAuthConfigured()) {
    return NextResponse.json({ error: "signature_auth_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const templateId = typeof body?.templateId === "string" ? body.templateId : "";
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
  const clientEmail = typeof body?.clientEmail === "string" ? body.clientEmail.trim() : "";
  const language = typeof body?.language === "string" ? body.language : "en";

  if (!templateId || !clientName || !clientEmail) {
    return NextResponse.json({ error: "missing_fields" }, { status: 422 });
  }

  const template = await getTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }

  const envelope = await createEnvelope({
    templateId: template.id,
    templateSnapshot: {
      title: template.title,
      description: template.description,
      documentType: template.documentType,
      kind: template.kind,
      blocks: template.blocks,
      sourcePdfKey: template.sourcePdfKey,
      sourcePdfFileName: template.sourcePdfFileName,
      pageCount: template.pageCount,
      fields: template.fields,
      signatureLabel: template.signatureLabel,
    },
    clientName,
    clientEmail,
    sentBy: session.username,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
  const linkToken = createSignatureAccessToken(envelope.envelopeId, clientEmail);
  const link = `${siteUrl}/sign/${envelope.envelopeId}?token=${encodeURIComponent(linkToken)}`;

  try {
    await sendSignatureRequestInvite({
      clientName,
      clientEmail,
      documentTitle: template.title,
      link,
      language,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[signature-envelopes] failed to send invite for ${envelope.envelopeId}:`, err);
    // The envelope already exists and is visible/resendable from the admin
    // dashboard — never fail the request just because the email didn't go
    // out, same store-first-then-notify pattern as leads.
  }

  return NextResponse.json({ envelope });
}
