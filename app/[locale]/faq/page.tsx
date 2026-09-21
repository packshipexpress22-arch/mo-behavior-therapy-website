import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import FAQAccordion from "@/components/home/FAQAccordion";

export async function generateMetadata() {
  const t = await getTranslations("pages.faq");
  return { title: t("title") };
}

export default async function FaqPage() {
  const t = await getTranslations("pages.faq");
  return (
    <>
      <PageHero title={t("title")} />
      <FAQAccordion />
    </>
  );
}
