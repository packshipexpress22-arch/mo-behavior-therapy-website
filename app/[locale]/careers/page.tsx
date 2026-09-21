import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import CareersForm from "@/components/forms/CareersForm";

export async function generateMetadata() {
  const t = await getTranslations("pages.careers");
  return { title: t("title"), description: t("intro") };
}

export default async function CareersPage() {
  const t = await getTranslations("pages.careers");
  const tf = await getTranslations("forms.careersForm");
  const roles = t.raw("roles") as string[];

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="mx-auto max-w-2xl">
          <ul className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <li key={role} className="rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-900 shadow-card">
                {role}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-500">{t("note")}</p>

          <div className="mt-10 rounded-xl3 border border-ink-100 bg-white p-7 shadow-card sm:p-10">
            <h2 className="text-xl font-bold text-ink-900">{tf("title")}</h2>
            <p className="mt-1 text-sm text-ink-500">{tf("subtitle")}</p>
            <div className="mt-6">
              <CareersForm />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

