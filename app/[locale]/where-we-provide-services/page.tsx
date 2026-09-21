import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("pages.whereWeProvide");
  return { title: t("title"), description: t("intro") };
}

export default async function WhereWeProvidePage() {
  const t = await getTranslations("pages.whereWeProvide");
  const tc = await getTranslations("common");
  const settings = ["home", "school", "community"] as const;

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="grid gap-6 sm:grid-cols-3">
          {settings.map((key) => (
            <div key={key} className="rounded-xl3 border border-ink-100 p-7 shadow-card">
              <h2 className="text-lg font-semibold text-ink-900">{t(`${key}.title`)}</h2>
              <p className="mt-2 leading-relaxed text-ink-700">{t(`${key}.body`)}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button href="/contact">{tc("requestServices")}</Button>
        </div>
      </Section>
    </>
  );
}
