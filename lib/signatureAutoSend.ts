import type { LeadRecord } from "./leadStore";
import { listAutoSendTemplates, signatureTemplatesConfigured, type SignatureTemplate } from "./signatureTemplates";
import { createEnvelope, signatureEnvelopesConfigured } from "./signatureEnvelopes";
import { createSignatureAccessToken, isSignatureAuthConfigured } from "./signatureAuth";
import { sendSignatureRequestInvite } from "./email";

// Auto-send: the moment a new lead/referral comes in, automatically send
// (not just store) a signature envelope for every active template the admin
// has flagged for that lead kind — see lib/signatureTemplates.ts's
// autoSendOnFamilyLead/autoSendOnReferral and app/admin/SignaturesPanel.tsx's
// template editor, where the admin sets those two flags independently.
// Before this, the only way to send a template was the admin manually
// picking a template + client in the admin dashboard's Signatures tab (see
// app/api/admin/signature-envelopes/route.ts, whose createEnvelope +
// signing-link + sendSignatureRequestInvite steps are mirrored below).
//
// Called from app/api/leads/route.ts and app/api/referrals/route.ts at the
// same time as (not chained after) their existing document-upload-invite
// email — both fire immediately the moment the lead/referral is stored, so
// the family/provider isn't waiting on anything else first. Changed
// 2026-10-14: this used to run only after the document-upload-invite email
// finished sending, which made auto-send feel delayed even though nothing
// about it actually depended on that email. Uses the exact same best-effort
// pattern those routes already use for every other email they send: never
// let a signature-related failure (one template, or all of them) cost the
// lead that's already safely stored, and never block the response the
// visitor is waiting on.
export async function autoSendSignatureTemplatesForLead(
  lead: LeadRecord,
  kind: "family" | "referral"
): Promise<void> {
  if (!signatureTemplatesConfigured() || !signatureEnvelopesConfigured() || !isSignatureAuthConfigured()) {
    return; // not configured for this stage yet — same graceful no-op as sendDocumentUploadInvite()
  }

  const d = lead.data as Record<string, string>;
  const clientEmail = d.email;
  const clientName = d.contactName || "";
  if (!clientEmail) return; // nothing to send to

  let templates: SignatureTemplate[];
  try {
    templates = await listAutoSendTemplates(kind);
  } catch (err) {
    console.error(`[signatureAutoSend] failed to list templates for lead ${lead.id} (kind=${kind}):`, err);
    return;
  }
  if (templates.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  const results = await Promise.allSettled(
    templates.map(async (template) => {
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
        // Distinguishes auto-sent envelopes from ones an admin picked by
        // hand (sentBy would otherwise hold their admin username) — see
        // lib/signatureEnvelopes.ts's SignatureEnvelope.sentBy.
        sentBy: "auto-send",
      });

      const linkToken = createSignatureAccessToken(envelope.envelopeId, clientEmail);
      const link = `${siteUrl}/sign/${envelope.envelopeId}?token=${encodeURIComponent(linkToken)}`;

      // The envelope already exists and is visible/resendable from the
      // admin dashboard regardless of whether this invite email goes out —
      // same store-first-then-notify pattern as every other email in this
      // app (see app/api/admin/signature-envelopes/route.ts).
      await sendSignatureRequestInvite({
        clientName,
        clientEmail,
        documentTitle: template.title,
        link,
        language: lead.language || "en",
      });
    })
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `[signatureAutoSend] failed for template ${templates[i]?.id} on lead ${lead.id} (kind=${kind}):`,
        r.reason
      );
    }
  });
}
