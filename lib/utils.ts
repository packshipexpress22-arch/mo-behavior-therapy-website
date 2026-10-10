import { clsx, type ClassValue } from "clsx";
import { company } from "@/data/company";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function telHref(e164: string) {
  return `tel:${e164}`;
}

export function mailHref(email: string) {
  return `mailto:${email}`;
}

/** Escapes a string for safe interpolation into an HTML email body. Lead,
 * referral, and careers submissions include free-text fields that get
 * rendered into HTML notification emails (lib/email.ts, app/api/referrals,
 * app/api/careers) — without this, a submitter could embed a fake link,
 * styled content, or a tracking pixel that renders live in a staff member's
 * inbox. Always escape user-supplied values before interpolating them into
 * an HTML string; plain-text email bodies don't need this. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Very small helper for interpolating ICU-lite `{token}` strings coming out
 * of next-intl when we need the raw string outside of <FormattedMessage>
 * (e.g. building an email subject line server-side). */
export function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

/** Full postal address as a single line, used to build Google Maps links —
 * single source of truth so the footer embed, schema.org hasMap and any
 * "get directions" link never drift from data/company.ts. */
export function fullAddress() {
  return `${company.address.line1}, ${company.address.city}, ${company.address.state} ${company.address.zip}`;
}

/** A plain Google Maps link (opens the Maps app/site) — no API key required. */
export function mapsHref() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress())}`;
}

/** An embeddable Google Maps URL for an <iframe> — also keyless. */
export function mapsEmbedSrc() {
  return `https://www.google.com/maps?q=${encodeURIComponent(fullAddress())}&output=embed`;
}
