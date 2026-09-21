import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

// The six first-class languages required for launch. Adding a language
// later is a two-line change: add the code here and drop a matching
// messages/<code>.json file — no component changes required.
export const locales = ["en", "es", "ht", "pt", "fr", "de"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ht: "Kreyòl Ayisyen",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
};

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: "America/New_York",
  };
});
