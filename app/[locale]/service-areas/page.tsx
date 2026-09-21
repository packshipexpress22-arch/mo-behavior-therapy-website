import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { Link } from "@/lib/navigation";
import { counties, cities, officeLocation } from "@/data/serviceAreas";

export async function generateMetadata() {
  const t = await getTranslations("pages.serviceAreas");
  return { title: t("title"), description: t("intro") };
}

export default async function ServiceAreasPage() {
  const t = await getTranslations("pages.serviceAreas");
  const tc = await getTranslations("common");

  return (
    <>
      <PageHero title={t("title")} intro={t("intro")} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-ink-900">{t("officeHeading")}</h2>
            <p className="mt-2 text-ink-700">{officeLocation.address}</p>

            <h2 className="mt-8 text-xl font-bold text-ink-900">{t("countiesHeading")}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {counties.map((c) => (
                <li key={c.id} className="rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-900">
                  {c.name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-ink-900">{t("citiesHeading")}</h2>
            <ul className="mt-3 space-y-2">
              {cities.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/service-areas/${c.slug}`}
                    className="flex items-center justify-between rounded-xl2 border border-ink-100 px-4 py-3 text-sm font-medium text-ink-900 hover:border-brand-blue hover:text-brand-blue"
                  >
                    {c.name}
                    {c.isOfficeLocation && <span className="text-xs text-brand-gold">★ {tc("officeLocation")}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Button href="/contact">{tc("requestServices")}</Button>
        </div>
      </Section>
    </>
  );
}
