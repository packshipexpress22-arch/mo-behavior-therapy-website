import nodemailer from "nodemailer";
import { company } from "@/data/company";
import { interpolate } from "@/lib/utils";
import type { LeadRecord } from "@/lib/leadStore";
import { createMagicLinkToken, isPatientPortalConfigured, DOCUMENT_INVITE_TTL_MS } from "@/lib/phiAuth";

// Pluggable email delivery. EMAIL_PROVIDER=smtp (default) uses Nodemailer
// against any SMTP host (Google Workspace, M365, Postmark, SES SMTP, etc.);
// EMAIL_PROVIDER=resend posts to the Resend API instead. Both branches are
// server-only — this file must never be imported from client components,
// and the API keys it reads are never exposed to the browser.

type SendArgs = { to: string; subject: string; html: string; text: string; replyTo?: string };

async function sendViaSmtp(args: SendArgs) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM_ADDRESS || `MO Behavior Therapy <no-reply@${company.domain}>`,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo,
  });
}

async function sendViaResend(args: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM_ADDRESS || `MO Behavior Therapy <no-reply@${company.domain}>`,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      reply_to: args.replyTo,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error: ${res.status} ${await res.text()}`);
  }
}

export async function sendEmail(args: SendArgs) {
  const provider = process.env.EMAIL_PROVIDER || "smtp";
  if (provider === "resend") return sendViaResend(args);
  return sendViaSmtp(args);
}

/**
 * Internal staff notification — kept scannable on a phone, per spec.
 * Deliberately excludes anything that reads like clinical narrative; only a
 * secure lead-record link/ID should carry that, once an internal dashboard
 * exists (see README "Lead dashboard").
 */
export async function sendInternalNotification(lead: LeadRecord) {
  const d = lead.data as Record<string, string>;
  const subject = interpolate("NEW ABA INQUIRY – {name} – {zip}", {
    name: d.contactName || d.fullName || "Unknown",
    zip: d.zip || "n/a",
  });

  const rows: [string, string | undefined][] = [
    ["Name", d.contactName || d.fullName],
    ["Phone", d.phone],
    ["Email", d.email],
    ["Language", lead.language],
    ["Preferred contact method", d.contactMethod],
    ["Preferred contact time", d.contactTime],
    ["City", d.city],
    ["ZIP", d.zip],
    ["County", d.county],
    ["Potential client age/group", d.clientAge],
    ["Relationship", d.relationship],
    ["Insurance", d.insurance],
    ["Requested setting", d.setting],
    ["Previous ABA", d.previousAba],
    ["Referral available", d.hasReferral],
    ["Diagnostic evaluation available", d.hasEvaluation],
    ["IEP/504 available", d.hasIep],
    ["How they heard about us", d.howHeard],
    ["Consent to contact", lead.consent.given ? "YES" : "NO"],
    ["Consent timestamp", lead.consent.timestamp],
    ["Source page", lead.source.page],
    ["UTM source", lead.source.utm.utm_source],
    ["UTM campaign", lead.source.utm.utm_campaign],
    ["Lead ID", lead.id],
  ];

  const html = `
    <h2>New MO Behavior Therapy Inquiry</h2>
    <table cellpadding="4" cellspacing="0" style="font-family:sans-serif;font-size:14px">
      ${rows
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([label, value]) => `<tr><td style="font-weight:600;padding-right:12px">${label}</td><td>${value}</td></tr>`)
        .join("")}
    </table>
    ${d.message ? `<p><strong>Message:</strong> ${d.message}</p>` : ""}
  `;

  const text = rows
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  await sendEmail({
    to: process.env.COMPANY_NOTIFICATION_EMAIL || company.email,
    subject,
    html,
    text,
    replyTo: d.email,
  });
}

type ConfirmationCopy = {
  subject: string;
  greeting: string;
  body1: string;
  body2: string;
  body3: string;
  closing: string;
  signOff: string;
  tagline: string;
};

const EN_CONFIRMATION_COPY: ConfirmationCopy = {
  subject: "We've Received Your Request | MO Behavior Therapy",
  greeting: "Hi {firstName},",
  body1: "Thank you for contacting MO Behavior Therapy.",
  body2: "We've received your information. A member of our team will review your request and contact you soon regarding the next steps.",
  body3: "If you'd prefer to speak with us directly, please call:",
  closing: "Thank you for considering MO Behavior Therapy.",
  signOff: "MO Behavior Therapy Team",
  tagline: "Building Brighter Futures, One Child at a Time.",
};

const CONFIRMATION_COPY: Record<string, ConfirmationCopy> = {
  en: EN_CONFIRMATION_COPY,
  es: {
    subject: "Hemos recibido su solicitud | MO Behavior Therapy",
    greeting: "Hola {firstName},",
    body1: "Gracias por comunicarse con MO Behavior Therapy.",
    body2: "Hemos recibido su información. Un miembro de nuestro equipo revisará su solicitud y se comunicará con usted próximamente para orientarle sobre los próximos pasos.",
    body3: "Si prefiere hablar directamente con nosotros, puede llamarnos al:",
    closing: "Gracias por considerar a MO Behavior Therapy.",
    signOff: "Equipo de MO Behavior Therapy",
    tagline: "Construyendo futuros más brillantes, un niño a la vez.",
  },
  ht: {
    subject: "Nou Resevwa Demand Ou | MO Behavior Therapy",
    greeting: "Bonjou {firstName},",
    body1: "Mèsi paske ou kontakte MO Behavior Therapy.",
    body2: "Nou resevwa enfòmasyon ou. Yon manm nan ekip nou an ap revize demand ou epi kontakte ou byento konsènan pwochen etap yo.",
    body3: "Si ou ta pito pale dirèkteman avèk nou, tanpri rele:",
    closing: "Mèsi paske ou konsidere MO Behavior Therapy.",
    signOff: "Ekip MO Behavior Therapy",
    tagline: "Bati Yon Fiti Pi Klere, Yon Timoun Alafwa.",
  },
  pt: {
    subject: "Recebemos Sua Solicitação | MO Behavior Therapy",
    greeting: "Olá {firstName},",
    body1: "Obrigado por entrar em contato com a MO Behavior Therapy.",
    body2: "Recebemos suas informações. Um membro da nossa equipe revisará sua solicitação e entrará em contato em breve sobre os próximos passos.",
    body3: "Se preferir falar diretamente conosco, ligue para:",
    closing: "Obrigado por considerar a MO Behavior Therapy.",
    signOff: "Equipe MO Behavior Therapy",
    tagline: "Construindo Futuros Mais Brilhantes, Uma Criança de Cada Vez.",
  },
  fr: {
    subject: "Nous Avons Reçu Votre Demande | MO Behavior Therapy",
    greeting: "Bonjour {firstName},",
    body1: "Merci d'avoir contacté MO Behavior Therapy.",
    body2: "Nous avons reçu vos renseignements. Un membre de notre équipe examinera votre demande et vous contactera bientôt au sujet des prochaines étapes.",
    body3: "Si vous préférez nous parler directement, veuillez appeler le :",
    closing: "Merci d'avoir pensé à MO Behavior Therapy.",
    signOff: "L'équipe MO Behavior Therapy",
    tagline: "Bâtir des avenirs plus lumineux, un enfant à la fois.",
  },
  de: {
    subject: "Wir Haben Ihre Anfrage Erhalten | MO Behavior Therapy",
    greeting: "Hallo {firstName},",
    body1: "Vielen Dank, dass Sie MO Behavior Therapy kontaktiert haben.",
    body2: "Wir haben Ihre Angaben erhalten. Ein Mitglied unseres Teams wird Ihre Anfrage prüfen und sich bald bezüglich der nächsten Schritte bei Ihnen melden.",
    body3: "Wenn Sie lieber direkt mit uns sprechen möchten, rufen Sie bitte an unter:",
    closing: "Vielen Dank, dass Sie sich für MO Behavior Therapy interessieren.",
    signOff: "Ihr MO Behavior Therapy Team",
    tagline: "Wir gestalten hellere Zukunftsaussichten, ein Kind nach dem anderen.",
  },
};

/**
 * Automatic thank-you email to the prospective client, in their selected
 * language. Never includes diagnoses, member IDs, or sensitive health
 * details — only the same neutral confirmation copy the client specified.
 */
export async function sendClientConfirmation(lead: LeadRecord) {
  const d = lead.data as Record<string, string>;
  const email = d.email;
  if (!email) return; // nothing to send to

  const copy = CONFIRMATION_COPY[lead.language] || EN_CONFIRMATION_COPY;
  const firstName = (d.contactName || "").split(" ")[0] || (lead.language === "es" ? "familia" : "there");

  const html = `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0F1B2B">
      <p>${interpolate(copy.greeting, { firstName })}</p>
      <p>${copy.body1}</p>
      <p>${copy.body2}</p>
      <p>${copy.body3}<br/><strong>${company.phone.display}</strong></p>
      <p>${company.legalName}<br/>${company.address.line1}<br/>${company.address.city}, ${company.address.state} ${company.address.zip}<br/>${company.email}</p>
      <p><em>${copy.tagline}</em></p>
      <p>${copy.closing}<br/>${copy.signOff}</p>
    </div>
  `;

  const text = [
    interpolate(copy.greeting, { firstName }),
    copy.body1,
    copy.body2,
    `${copy.body3} ${company.phone.display}`,
    `${company.legalName} — ${company.address.line1}, ${company.address.city}, ${company.address.state} ${company.address.zip} — ${company.email}`,
    copy.tagline,
    `${copy.closing} — ${copy.signOff}`,
  ].join("\n\n");

  await sendEmail({ to: email, subject: copy.subject, html, text });
}

type DocInviteCopy = {
  subject: string;
  greeting: string;
  intro: string;
  requiredLabel: string;
  ifAvailableLabel: string;
  items: {
    caregiverId: string;
    insuranceCard: string;
    diagnosisLetter: string;
    iep: string;
    psychEvaluation: string;
  };
  button: string;
  expiry: string;
  security: string;
  closing: string;
  signOff: string;
};

const EN_DOC_INVITE_COPY: DocInviteCopy = {
  subject: "Securely Upload Your Documents | MO Behavior Therapy",
  greeting: "Hi {firstName},",
  intro:
    "To help us review your case as quickly as possible, please securely upload the following documents through our HIPAA-compliant patient portal:",
  requiredLabel: "Required",
  ifAvailableLabel: "If you already have them",
  items: {
    caregiverId: "A photo of the caregiver's driver's license or another government-issued photo ID",
    insuranceCard: "The client's insurance card (front and back, if possible)",
    diagnosisLetter: "A diagnosis letter from the client's pediatrician, neurologist, or psychiatrist",
    iep: "The client's IEP (Individualized Education Program)",
    psychEvaluation: "A psychological evaluation report",
  },
  button: "Upload your documents securely",
  expiry:
    "This link is valid for 24 hours and can only be used by you. If it expires, just request a new one on our patient portal sign-in page using this same email address.",
  security:
    "Your documents are encrypted and stored in our HIPAA-compliant system — they are never shared outside MO Behavior Therapy, and no AI tool ever has access to them.",
  closing: "Thank you for trusting us with your family's care.",
  signOff: "MO Behavior Therapy Team",
};

const DOC_INVITE_COPY: Record<string, DocInviteCopy> = {
  en: EN_DOC_INVITE_COPY,
  es: {
    subject: "Suba sus documentos de forma segura | MO Behavior Therapy",
    greeting: "Hola {firstName},",
    intro:
      "Para ayudarnos a revisar su caso lo más rápido posible, por favor suba de forma segura los siguientes documentos a través de nuestro portal de pacientes, que cumple con HIPAA:",
    requiredLabel: "Obligatorio",
    ifAvailableLabel: "Si ya los tiene",
    items: {
      caregiverId: "Una foto de la licencia de conducir del cuidador u otra identificación oficial con foto",
      insuranceCard: "La tarjeta de seguro del cliente (frente y reverso, si es posible)",
      diagnosisLetter: "Una carta de diagnóstico del pediatra, neurólogo o psiquiatra del cliente",
      iep: "El IEP (Programa Educativo Individualizado) del cliente",
      psychEvaluation: "Un informe de evaluación psicológica",
    },
    button: "Subir mis documentos de forma segura",
    expiry:
      "Este enlace es válido por 24 horas y solo usted puede usarlo. Si expira, simplemente solicite uno nuevo en la página de inicio de sesión de nuestro portal de pacientes usando este mismo correo electrónico.",
    security:
      "Sus documentos se cifran y almacenan en nuestro sistema que cumple con HIPAA — nunca se comparten fuera de MO Behavior Therapy, y ninguna herramienta de inteligencia artificial tiene acceso a ellos.",
    closing: "Gracias por confiarnos el cuidado de su familia.",
    signOff: "Equipo de MO Behavior Therapy",
  },
  ht: {
    subject: "Telechaje Dokiman Ou an Sekirite | MO Behavior Therapy",
    greeting: "Bonjou {firstName},",
    intro:
      "Pou ede nou revize ka ou pi vit posib, tanpri telechaje dokiman sa yo an sekirite atravè pòtal pasyan nou an, ki konfòm ak HIPAA:",
    requiredLabel: "Obligatwa",
    ifAvailableLabel: "Si ou deja genyen yo",
    items: {
      caregiverId: "Yon foto lisans kondwi moun k ap pran swen an oswa yon lòt kat idantite ofisyèl ak foto",
      insuranceCard: "Kat asirans kliyan an (devan ak dèyè, si posib)",
      diagnosisLetter: "Yon lèt dyagnostik ki soti nan men pedyat, nèwològ, oswa psikyat kliyan an",
      iep: "IEP (Pwogram Edikasyon Endividyalize) kliyan an",
      psychEvaluation: "Yon rapò evalyasyon sikolojik",
    },
    button: "Telechaje dokiman mwen yo an sekirite",
    expiry:
      "Lyen sa a valab pou 24 èdtan e se sèlman ou ki ka itilize li. Si li ekspire, senpleman mande yon nouvo nan paj koneksyon pòtal pasyan nou an avèk menm imel sa a.",
    security:
      "Dokiman ou yo chifre e estoke nan sistèm nou an ki konfòm ak HIPAA — yo pa janm pataje deyò MO Behavior Therapy, e okenn zouti entèlijans atifisyèl pa janm gen aksè a yo.",
    closing: "Mèsi paske ou fè nou konfyans pou swen fanmi ou.",
    signOff: "Ekip MO Behavior Therapy",
  },
  pt: {
    subject: "Envie Seus Documentos com Segurança | MO Behavior Therapy",
    greeting: "Olá {firstName},",
    intro:
      "Para nos ajudar a revisar seu caso o mais rápido possível, envie com segurança os seguintes documentos através do nosso portal do paciente, em conformidade com a HIPAA:",
    requiredLabel: "Obrigatório",
    ifAvailableLabel: "Se você já os tiver",
    items: {
      caregiverId: "Uma foto da carteira de motorista do cuidador ou outro documento oficial com foto",
      insuranceCard: "O cartão do convênio do cliente (frente e verso, se possível)",
      diagnosisLetter: "Uma carta de diagnóstico do pediatra, neurologista ou psiquiatra do cliente",
      iep: "O IEP (Programa Educacional Individualizado) do cliente",
      psychEvaluation: "Um relatório de avaliação psicológica",
    },
    button: "Enviar meus documentos com segurança",
    expiry:
      "Este link é válido por 24 horas e só pode ser usado por você. Se expirar, basta solicitar um novo na página de login do portal do paciente usando este mesmo e-mail.",
    security:
      "Seus documentos são criptografados e armazenados em nosso sistema compatível com a HIPAA — eles nunca são compartilhados fora da MO Behavior Therapy, e nenhuma ferramenta de IA tem acesso a eles.",
    closing: "Obrigado por confiar a nós o cuidado da sua família.",
    signOff: "Equipe MO Behavior Therapy",
  },
  fr: {
    subject: "Téléversez vos documents en toute sécurité | MO Behavior Therapy",
    greeting: "Bonjour {firstName},",
    intro:
      "Afin de nous aider à examiner votre dossier le plus rapidement possible, veuillez téléverser en toute sécurité les documents suivants via notre portail patient conforme à la loi HIPAA :",
    requiredLabel: "Obligatoire",
    ifAvailableLabel: "Si vous les avez déjà",
    items: {
      caregiverId: "Une photo du permis de conduire de l'aidant ou d'une autre pièce d'identité officielle avec photo",
      insuranceCard: "La carte d'assurance du client (recto et verso, si possible)",
      diagnosisLetter: "Une lettre de diagnostic du pédiatre, neurologue ou psychiatre du client",
      iep: "Le PEI (Programme d'Éducation Individualisé) du client",
      psychEvaluation: "Un rapport d'évaluation psychologique",
    },
    button: "Téléverser mes documents en toute sécurité",
    expiry:
      "Ce lien est valable 24 heures et ne peut être utilisé que par vous. S'il expire, demandez-en simplement un nouveau sur la page de connexion de notre portail patient avec cette même adresse e-mail.",
    security:
      "Vos documents sont chiffrés et stockés dans notre système conforme à la loi HIPAA — ils ne sont jamais partagés en dehors de MO Behavior Therapy, et aucun outil d'intelligence artificielle n'y a accès.",
    closing: "Merci de nous confier le suivi de votre famille.",
    signOff: "L'équipe MO Behavior Therapy",
  },
  de: {
    subject: "Laden Sie Ihre Unterlagen sicher hoch | MO Behavior Therapy",
    greeting: "Hallo {firstName},",
    intro:
      "Damit wir Ihren Fall so schnell wie möglich prüfen können, laden Sie bitte die folgenden Unterlagen sicher über unser HIPAA-konformes Patientenportal hoch:",
    requiredLabel: "Erforderlich",
    ifAvailableLabel: "Falls bereits vorhanden",
    items: {
      caregiverId: "Ein Foto des Führerscheins der betreuenden Person oder eines anderen amtlichen Lichtbildausweises",
      insuranceCard: "Die Versicherungskarte des Kindes/Klienten (Vorder- und Rückseite, wenn möglich)",
      diagnosisLetter: "Ein Diagnosebrief des Kinderarztes, Neurologen oder Psychiaters",
      iep: "Der IEP (individueller Förderplan) des Kindes/Klienten",
      psychEvaluation: "Ein psychologischer Gutachtenbericht",
    },
    button: "Meine Unterlagen sicher hochladen",
    expiry:
      "Dieser Link ist 24 Stunden gültig und kann nur von Ihnen verwendet werden. Sollte er ablaufen, fordern Sie auf der Anmeldeseite unseres Patientenportals mit derselben E-Mail-Adresse einfach einen neuen an.",
    security:
      "Ihre Unterlagen werden verschlüsselt und in unserem HIPAA-konformen System gespeichert — sie werden niemals außerhalb von MO Behavior Therapy weitergegeben, und kein KI-Tool hat jemals Zugriff darauf.",
    closing: "Vielen Dank, dass Sie uns die Betreuung Ihrer Familie anvertrauen.",
    signOff: "Ihr MO Behavior Therapy Team",
  },
};

/**
 * Sent alongside sendClientConfirmation right after a family/caregiver
 * submits the contact form (see app/api/leads/route.ts's Promise.allSettled
 * call). Generates a one-time magic link (lib/phiAuth.ts) into the
 * HIPAA-compliant patient portal so the caregiver can securely upload the
 * case's supporting documents whenever they're ready. This function itself
 * never touches a document's bytes or content — only a signed sign-in link
 * and a plain-language checklist of what to bring (see lib/phiStorage.ts /
 * lib/phiDocuments.ts for how the actual uploads stay out of this app's
 * Lambda and out of any AI tool's reach).
 */
export async function sendDocumentUploadInvite(lead: LeadRecord) {
  // Graceful no-op if PATIENT_SESSION_SECRET isn't set yet for this stage —
  // same degradation pattern as /api/portal/request-link/route.ts, so a
  // not-yet-configured portal never turns into a 500 for the family.
  if (!isPatientPortalConfigured()) return;

  const d = lead.data as Record<string, string>;
  const email = d.email;
  if (!email) return; // nothing to send to

  const copy = DOC_INVITE_COPY[lead.language] || EN_DOC_INVITE_COPY;
  const firstName = (d.contactName || "").split(" ")[0] || (lead.language === "es" ? "familia" : "there");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
  const token = createMagicLinkToken(email, DOCUMENT_INVITE_TTL_MS);
  const link = `${siteUrl}/api/portal/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0F1B2B">
      <p>${interpolate(copy.greeting, { firstName })}</p>
      <p>${copy.intro}</p>
      <p style="font-weight:600;margin-bottom:4px">${copy.requiredLabel}:</p>
      <ul style="margin-top:0">
        <li>${copy.items.caregiverId}</li>
        <li>${copy.items.insuranceCard}</li>
      </ul>
      <p style="font-weight:600;margin-bottom:4px">${copy.ifAvailableLabel}:</p>
      <ul style="margin-top:0">
        <li>${copy.items.diagnosisLetter}</li>
        <li>${copy.items.iep}</li>
        <li>${copy.items.psychEvaluation}</li>
      </ul>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:9999px;text-decoration:none;font-weight:600">${copy.button}</a></p>
      <p style="font-size:13px;color:#475569">${copy.expiry}</p>
      <p style="font-size:13px;color:#475569">${copy.security}</p>
      <p>${copy.closing}<br/>${copy.signOff}</p>
    </div>
  `;

  const text = [
    interpolate(copy.greeting, { firstName }),
    copy.intro,
    `${copy.requiredLabel}: ${copy.items.caregiverId}; ${copy.items.insuranceCard}`,
    `${copy.ifAvailableLabel}: ${copy.items.diagnosisLetter}; ${copy.items.iep}; ${copy.items.psychEvaluation}`,
    `${copy.button}: ${link}`,
    copy.expiry,
    copy.security,
    `${copy.closing} — ${copy.signOff}`,
  ].join("\n\n");

  await sendEmail({ to: email, subject: copy.subject, html, text });
}

/**
 * Same secure-upload mechanism as sendDocumentUploadInvite() above, but for
 * a referring professional (pediatrician, neurologist, psychiatrist, school,
 * etc.) submitting the separate /referral-sources form (see
 * app/api/referrals/route.ts) rather than a family/caregiver. That form is
 * English-only today (no language selector — see components/forms/ReferralForm.tsx
 * and the hardcoded language: "en" in app/api/referrals/route.ts), so this
 * copy isn't translated yet; extend it the same way as DOC_INVITE_COPY above
 * if the referral form ever gains a language switcher.
 *
 * The document checklist is deliberately different — and shorter — than the
 * family invite: per the client, a referring professional only ever sends
 * two things: the diagnosis document referring the child for ABA therapy,
 * and the child's insurance information. No caregiver ID, IEP, or
 * psychological evaluation is expected from this sender.
 */
export async function sendReferralDocumentUploadInvite(lead: LeadRecord) {
  if (!isPatientPortalConfigured()) return;

  const d = lead.data as Record<string, string>;
  const email = d.email;
  if (!email) return;

  const firstName = (d.contactName || "").split(" ")[0] || "there";
  const clientFirstName = d.clientFirstName || "your patient";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
  const token = createMagicLinkToken(email, DOCUMENT_INVITE_TTL_MS);
  const link = `${siteUrl}/api/portal/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0F1B2B">
      <p>Hi ${firstName},</p>
      <p>Thank you for referring ${clientFirstName} to ${company.shortName}. To help us process this referral, please securely upload the following through our HIPAA-compliant provider portal:</p>
      <ul>
        <li>The diagnosis document referring ${clientFirstName} for ABA therapy</li>
        <li>${clientFirstName}'s insurance information</li>
      </ul>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:9999px;text-decoration:none;font-weight:600">Upload documents securely</a></p>
      <p style="font-size:13px;color:#475569">This link is valid for 24 hours and can only be used by you. If it expires, just request a new one on our provider portal sign-in page using this same email address.</p>
      <p style="font-size:13px;color:#475569">Documents are encrypted and stored in our HIPAA-compliant system — they are never shared outside ${company.shortName}, and no AI tool ever has access to them.</p>
      <p>Thank you for trusting us with your patient's care.<br/>${company.shortName} Team</p>
    </div>
  `;

  const text = [
    `Hi ${firstName},`,
    `Thank you for referring ${clientFirstName} to ${company.shortName}. To help us process this referral, please securely upload the following through our HIPAA-compliant provider portal:`,
    `- The diagnosis document referring ${clientFirstName} for ABA therapy`,
    `- ${clientFirstName}'s insurance information`,
    `Upload documents securely: ${link}`,
    "This link is valid for 24 hours and can only be used by you. If it expires, just request a new one on our provider portal sign-in page using this same email address.",
    `Documents are encrypted and stored in our HIPAA-compliant system — they are never shared outside ${company.shortName}, and no AI tool ever has access to them.`,
    `Thank you for trusting us with your patient's care. — ${company.shortName} Team`,
  ].join("\n\n");

  await sendEmail({
    to: email,
    subject: `Securely Share Documents for Your Referral | ${company.shortName}`,
    html,
    text,
  });
}


// Mirrors app/portal/PortalDashboard.tsx's DOCUMENT_TYPE_LABELS - kept as a
// separate copy rather than a shared import because that file is a client
// component and this one is server-only; duplicating a 6-line label map is
// cheaper than threading a shared module across the client/server boundary
// for something this small.
const ADMIN_DOCUMENT_TYPE_LABELS: Record<string, string> = {
    caregiver_id: "Caregiver photo ID",
    insurance_card: "Client's insurance card",
    diagnosis_letter: "Diagnosis letter",
    iep: "IEP/504",
    psych_evaluation: "Psychological evaluation",
    other: "Other document",
};

/**
 * Staff notification sent right after a patient/caregiver's upload is
 * confirmed in S3 (see app/api/portal/documents/[id]/confirm/route.ts).
 *
 * Deliberately carries no PHI beyond what the team already receives in the
 * original lead-inquiry email (the patient's contact email) and a
 * controlled document-type label picked from a fixed list - never the
 * uploader-supplied file name (which a family could name anything, up to
 * and including a string that itself reads like clinical narrative) and
 * never the file content or a direct link to it. Staff click through to the
 * admin dashboard (behind login) to actually view/download the document;
 * the file bytes never travel over email.
 */
export async function sendDocumentUploadedNotification(doc: {
    patientId: string;
    documentType: string;
}) {
    const label = ADMIN_DOCUMENT_TYPE_LABELS[doc.documentType] || ADMIN_DOCUMENT_TYPE_LABELS.other;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";
    const adminLink = `${siteUrl}/admin`;

  const subject = `New document uploaded - ${label} - ${doc.patientId}`;

  const html = `
      <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#0F1B2B">
            <p>A new document was uploaded to the patient portal.</p>
                  <table cellpadding="4" cellspacing="0" style="font-size:14px">
                          <tr><td style="font-weight:600;padding-right:12px">Patient email</td><td>${doc.patientId}</td></tr>
                                  <tr><td style="font-weight:600;padding-right:12px">Document type</td><td>${label}</td></tr>
                                        </table>
                                              <p><a href="${adminLink}" style="display:inline-block;padding:10px 20px;background:#2563EB;color:#fff;border-radius:9999px;text-decoration:none;font-weight:600">Open admin dashboard</a></p>
                                                    <p style="font-size:13px;color:#475569">Sign in and open the "Documents" tab to securely view or download it. This email never carries the file itself.</p>
                                                        </div>
                                                          `;

  const text = [
        "A new document was uploaded to the patient portal.",
        `Patient email: ${doc.patientId}`,
        `Document type: ${label}`,
        `Open admin dashboard: ${adminLink}`,
      ].join("\n");

  await sendEmail({
        to: process.env.COMPANY_NOTIFICATION_EMAIL || company.email,
        subject,
        html,
        text,
  });
}
