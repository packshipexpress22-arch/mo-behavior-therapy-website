import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";

export async function generateMetadata() {
  const t = await getTranslations("pages.terms");
  return { title: t("title") };
}

export default async function TermsPage() {
  const t = await getTranslations("pages.terms");

  return (
    <>
      <PageHero title={t("title")} />
      <Section>
        <p className="mx-auto max-w-3xl leading-relaxed text-ink-700">{t("body")}</p>
      </Section>
    </>
  );
}
