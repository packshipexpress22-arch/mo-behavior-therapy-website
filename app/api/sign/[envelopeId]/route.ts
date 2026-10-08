import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAccessToken } from "@/lib/signatureAuth";
import { getEnvelope } from "@/lib/signatureEnvelopes";
import { createViewUrl } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public but token-gated: returns just enough of an envelope for the
// client-facing /sign/[envelopeId] page to render the document and its
// fillable fields. No cookie session is ever issued here — the bearer
// token (embedding both the envelopeId and the client's email, see
// lib/signatureAuth.ts) is re-verified on every request, matching how a
// DocuSign-style one-time signing link behaves.
export async function GET(req: NextRequest, { params }: { params: { envelopeId: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = verifySignatureAccessToken(token);
  if (!verified || verified.envelopeId !== params.envelopeId) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 401 });
  }

  const envelope = await getEnvelope(verified.email, params.envelopeId);
  if (!envelope) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Phase 2: "pdf"-kind envelopes also need a fresh presigned URL so the
  // client's browser can render the source document with pdf.js — minted
  // on every load rather than stored, same as the admin editor's viewUrl.
  const viewUrl =
    envelope.templateSnapshot.kind === "pdf" && envelope.templateSnapshot.sourcePdfKey
      ? await createViewUrl({ s3Key: envelope.templateSnapshot.sourcePdfKey })
      : null;

  // Deliberately returns only what the fill-in page needs to render — not
  // the admin-only sentBy/consentIp/etc. audit fields.
  return NextResponse.json({
    envelopeId: envelope.envelopeId,
    status: envelope.status,
    clientName: envelope.clientName,
    clientEmail: envelope.clientEmail,
    template: envelope.templateSnapshot,
    viewUrl,
    fieldValues: envelope.fieldValues,
    completedAt: envelope.completedAt,
  });
}
