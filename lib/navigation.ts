import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "@/i18n";

// Locale-aware Link/router/pathname helpers used throughout the app instead
// of next/link and next/navigation directly — this is what keeps every
// internal link correctly prefixed (or not) for the current locale.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({ locales, defaultLocale, localePrefix: "as-needed" });
