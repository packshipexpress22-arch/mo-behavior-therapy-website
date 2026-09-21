import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";

export async function generateMetadata() {
  const t = await getTranslations("pages.privacyPolicy");
  return { title: t("title") };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("pages.privacyPolicy");
  const sections = t.raw("sections") as { title: string; body: string }[];

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold text-ink-900">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-700">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
