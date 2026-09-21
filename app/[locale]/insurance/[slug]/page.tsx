import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { insurancePlans, insuranceDisclaimer } from "@/data/insurance";
import type { Locale } from "@/i18n";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const plan = insurancePlans.find((p) => p.slug === params.slug);
  if (!plan) return {};
  return {
    title: `${plan.name} & ABA Therapy | MO Behavior Therapy`,
    description: `MO Behavior Therapy works with ${plan.name} where applicable. Benefits and authorization vary by plan — our team can help verify your coverage.`,
  };
}

/**
 * One unique, useful page per payer rather than a thin templated stub — per
 * spec: "unique useful pages rather than duplicate city/insurance pages
 * where only the name changes." Content still comes from data/insurance.ts
 * so adding a payer later doesn't require hand-writing a new route.
 *
 * Note: generateStaticParams is intentionally omitted (see app/[locale]/layout.tsx
 * for why) — locale comes straight from params instead of next-intl's getLocale(),
 * which depends on headers() and would force a dynamic-rendering conflict.
 */
export default async function InsurancePlanPage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  const plan = insurancePlans.find((p) => p.slug === params.slug);
  if (!plan) notFound();

  const t = await getTranslations("pages.insurance");
  const locale = params.locale as Locale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: t("title"), url: `${siteUrl}/insurance` },
          { name: plan.name, url: `${siteUrl}/insurance/${plan.slug}` },
        ])}
      />
      <PageHero
        title={`${plan.name} & ABA Therapy`}
        intro={`MO Behavior Therapy works with ${plan.name}${plan.notes ? ` (${plan.notes})` : ""} where applicable. ${
          insuranceDisclaimer[locale] || insuranceDisclaimer.en
        }`}
      />
      <Section>
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-ink-900">What this means for your family</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-700">
              <li>• We work with {plan.name} where applicable — actual behavioral health benefits depend on your specific plan.</li>
              <li>• Prior authorization may be required before ABA services begin.</li>
              <li>• Our team can verify your eligibility and benefits before you commit to anything.</li>
              <li>• We never guarantee coverage until it's been verified with {plan.name} directly.</li>
            </ul>
          </div>
          <div className="text-center">
            <Button href="/contact">{t("cta")}</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
