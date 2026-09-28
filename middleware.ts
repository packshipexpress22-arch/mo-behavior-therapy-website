import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // /  ->  en (no prefix), /es/... for other locales
  localeDetection: true, // honors Accept-Language on first visit
});

export const config = {
  // Skip static assets, API routes, the admin dashboard, the patient portal
  // (both their own English-only, non-localized trees — see
  // app/admin/layout.tsx and app/portal/layout.tsx), and Next internals.
  matcher: ["/((?!api|admin|portal|_next|.*\\..*).*)"],
};
