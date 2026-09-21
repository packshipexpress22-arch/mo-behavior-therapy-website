import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import ReferralForm from "@/components/forms/ReferralForm";

export async function generateMetadata() {
  const t = await getTranslations("pages.referralSources");
  return { title: t("title"), description: t("intro") };
}

export default async function ReferralSourcesPage() {
  const t = await getTranslations("pages.referralSources");
  const tf = await getTranslations("forms.referralForm");

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <p className="mx-auto mb-8 max-w-2xl text-sm text-ink-500">{t("note")}</p>
        <div className="mx-auto max-w-2xl rounded-xl3 border border-ink-100 bg-white p-7 shadow-card sm:p-10">
          <h2 className="text-xl font-bold text-ink-900">{tf("title")}</h2>
          <p className="mt-1 text-sm text-ink-500">{tf("subtitle")}</p>
          <div className="mt-6">
            <ReferralForm />
          </div>
        </div>
      </Section>
    </>
  );
}
