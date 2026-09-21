import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import { company } from "@/data/company";

export async function generateMetadata() {
  const t = await getTranslations("pages.about");
  return { title: t("title"), description: t("intro") };
}

export default async function AboutPage() {
  const t = await getTranslations("pages.about");

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <h2 className="text-2xl font-bold text-ink-900">{t("leadershipHeading")}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {company.leadership.map((person) => (
            <div key={person.name} className="rounded-xl3 border border-ink-100 p-7 shadow-card">
              <div className="mb-4 h-20 w-20 rounded-full bg-ink-100" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-ink-900">{person.name}</h3>
              <p className="text-sm text-ink-500">{person.title}</p>
              {/* Bio intentionally left blank — see data/company.ts note: we
                  never invent biography details. */}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

