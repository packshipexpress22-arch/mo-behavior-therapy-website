import { clsx, type ClassValue } from "clsx";

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

