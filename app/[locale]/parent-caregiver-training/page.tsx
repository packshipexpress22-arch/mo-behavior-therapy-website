import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("pages.parentTraining");
  return { title: t("title"), description: t("intro") };
}

export default async function ParentTrainingPage() {
  const t = await getTranslations("pages.parentTraining");
  const tc = await getTranslations("common");

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-lg leading-relaxed text-ink-700">{t("body")}</p>
          <div className="mt-10">
            <Button href="/contact">{tc("requestServices")}</Button>
          </div>
        </div>
      </Section>
    </>
  );
}

