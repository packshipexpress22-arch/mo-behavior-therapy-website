import nodemailer from "nodemailer";
import { company } from "@/data/company";
import { interpolate } from "@/lib/utils";
import type { LeadRecord } from "@/lib/leadStore";

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
