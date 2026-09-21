import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { Link } from "@/lib/navigation";
import { insurancePlans, insuranceDisclaimer, insuranceNotListed } from "@/data/insurance";
import type { Locale } from "@/i18n";

export async function generateMetadata() {
  const t = await getTranslations("pages.insurance");
  return { title: t("title"), description: t("intro") };
}

export default async function InsurancePage() {
  const t = await getTranslations("pages.insurance");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;
  const primaryPlans = insurancePlans.filter((p) => p.primary);

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <h2 className="text-2xl font-bold text-ink-900">{t("primaryHeading")}</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {primaryPlans.map((plan) => (
            <Link
              key={plan.id}
              href={`/insurance/${plan.slug}`}
              className="flex h-24 flex-col items-center justify-center rounded-xl2 border border-ink-100 bg-white px-3 text-center shadow-card transition-shadow hover:shadow-soft"
            >
              <span className="text-sm font-semibold text-ink-900">{plan.name}</span>
              {plan.notes && <span className="mt-1 text-[11px] text-ink-500">{plan.notes}</span>}
            </Link>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm text-ink-500">{insuranceNotListed[locale] || insuranceNotListed.en}</p>
        <p className="mt-4 max-w-2xl rounded-xl2 border border-ink-100 bg-ink-100/40 p-4 text-sm text-ink-700">
          {insuranceDisclaimer[locale] || insuranceDisclaimer.en}
        </p>
        <p className="mt-4 max-w-2xl text-sm text-ink-700">{t("note")}</p>
        <div className="mt-8">
          <Button href="/contact">{t("cta")}</Button>
        </div>
      </Section>
    </>
  );
}

