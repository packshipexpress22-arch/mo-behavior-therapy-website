import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import JsonLd from "@/components/seo/JsonLd";
import { serviceSchema } from "@/lib/schema";

export async function generateMetadata() {
  const t = await getTranslations("pages.services");
  return { title: t("title"), description: t("intro") };
}

export default async function ServicesPage() {
  const t = await getTranslations("pages.services");
  const tc = await getTranslations("common");
  const categoryItems = t.raw("categories.items") as string[];

  return (
    <>
      <JsonLd data={serviceSchema(t("title"), t("intro"))} />
      <PageHero title={t("title")} intro={t("intro")} />

      <Section>
        <h2 className="text-2xl font-bold text-ink-900">{t("categories.heading")}</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {categoryItems.map((item) => (
            <span key={item} className="rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-900 shadow-card">
              {item}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-ink-500">
          {/* Not every child receives every service — noted explicitly per spec */}
        </p>
      </Section>

      <Section className="bg-ink-100/40">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl3 border border-ink-100 bg-white p-7 shadow-card">
            <h3 className="text-lg font-semibold text-ink-900">{t("behaviorReduction.title")}</h3>
            <p className="mt-2 leading-relaxed text-ink-700">{t("behaviorReduction.body")}</p>
          </div>
          <div className="rounded-xl3 border border-ink-100 bg-white p-7 shadow-card">
            <h3 className="text-lg font-semibold text-ink-900">{t("parentTraining.title")}</h3>
            <p className="mt-2 leading-relaxed text-ink-700">{t("parentTraining.body")}</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <Button href="/contact">{tc("requestServices")}</Button>
        </div>
      </Section>
    </>
  );
}
