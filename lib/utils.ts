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
