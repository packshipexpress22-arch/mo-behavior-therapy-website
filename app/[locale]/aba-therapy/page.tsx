import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("pages.abaTherapy");
  return { title: t("title"), description: t("intro") };
}

export default async function AbaTherapyPage() {
  const t = await getTranslations("pages.abaTherapy");
  const tc = await getTranslations("common");
  const sections = t.raw("sections") as { title: string; body: string }[];

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-10">
          {sections.map((s, i) => (
            <div key={s.title} className="flex gap-5">
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue-light text-sm font-bold text-brand-blue">
                {i + 1}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-ink-900">{s.title}</h2>
                <p className="mt-1.5 leading-relaxed text-ink-700">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button href="/contact">{tc("requestServices")}</Button>
        </div>
      </Section>
    </>
  );
}

