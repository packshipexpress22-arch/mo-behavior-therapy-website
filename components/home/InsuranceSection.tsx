"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { insurancePlans, insuranceNotListed } from "@/data/insurance";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n";

/**
 * Exactly the five payers confirmed on the official flyer, shown
 * prominently — plus the "don't see yours?" line directly underneath so the
 * section never reads as a hard limit of five. New contracts get added by
 * editing data/insurance.ts only; this component never hard-codes a payer
 * name.
 */
export default function InsuranceSection() {
  const t = useTranslations("home.insurance");
  const locale = useLocale() as Locale;
  const primaryPlans = insurancePlans.filter((p) => p.primary);

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
        <p className="mt-4 text-base leading-relaxed text-ink-700">{t("body")}</p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {primaryPlans.map((plan) => (
          <div
            key={plan.id}
            className="flex h-24 items-center justify-center rounded-xl2 border border-ink-100 bg-white px-4 text-center shadow-card"
          >
            <span className="text-sm font-semibold text-ink-900">{plan.name}</span>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-ink-500">
        {insuranceNotListed[locale] || insuranceNotListed.en}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/contact" variant="primary">
          {t("cta")}
        </Button>
        <Button href="/insurance" variant="ghost">
          {t("viewInsurancePage")}
        </Button>
      </div>
    </Section>
  );
}
