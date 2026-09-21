import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AppChrome from "@/components/layout/AppChrome";
import JsonLd from "@/components/seo/JsonLd";
import { organizationSchema, localBusinessSchema } from "@/lib/schema";
import "../globals.css";

// Note: generateStaticParams is intentionally omitted here. next-intl's
// Server Component APIs (getTranslations/getMessages) require every page in
// the tree to call `setRequestLocale` to safely opt into static rendering;
// without that, forcing static generation via generateStaticParams causes a
// hard prerender error. Rendering these routes dynamically (the default
// without generateStaticParams) is correct and avoids that failure mode —
// revisit with setRequestLocale calls if static generation is wanted later.
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("home.title"), template: `%s | ${t("siteName")}` },
    description: t("home.description"),
    alternates: {
      canonical: "/",
      languages: Object.fromEntries(locales.map((l) => [l, `/${l === "en" ? "" : l}`])),
    },
    openGraph: {
      siteName: t("siteName"),
      type: "website",
      locale,
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans">
        <NextIntlClientProvider messages={messages} locale={locale as Locale}>
          <JsonLd data={[organizationSchema(), localBusinessSchema()]} />
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <Header />
          <main id="main-content" className="flex-1 pb-16 lg:pb-0">
            {children}
          </main>
          <Footer />
          <AppChrome />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

