import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { cities, counties, officeLocation } from "@/data/serviceAreas";

export function generateStaticParams() {
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: { city: string } }) {
  const city = cities.find((c) => c.slug === params.city);
  if (!city) return {};
  return {
    title: `ABA Therapy in ${city.name}, FL | MO Behavior Therapy`,
    description: `Individualized, BCBA-led ABA services available to families in ${city.name}, FL. Service availability varies by location, staffing, clinical need and insurance authorization.`,
  };
}

export default async function CityPage({ params }: { params: { city: string } }) {
  const city = cities.find((c) => c.slug === params.city);
  if (!city) notFound();

  const county = counties.find((c) => c.id === city.county);
  const t = await getTranslations("common");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Service Areas", url: `${siteUrl}/service-areas` },
          { name: city.name, url: `${siteUrl}/service-areas/${city.slug}` },
        ])}
      />
      <PageHero
        title={`ABA Therapy Availability in ${city.name}, FL`}
        intro={
          city.isOfficeLocation
            ? `${city.name} is home to our office. Many families here are also served at home, at school, or in the community, depending on clinical need.`
            : `We provide ABA services to families in ${city.name} (${county?.name}), with availability varying by location, staffing, clinical need and insurance authorization. This is a service area, not a physical office.`
        }
      />
      <Section>
        <div className="mx-auto max-w-2xl space-y-6 text-ink-700">
          <p>
            Families in {city.name} can access individualized, BCBA-led ABA therapy at home, at school (subject to
            school/district authorization), or in the community — whichever setting best fits your child's needs.
          </p>
          <p>
            Our office is located at {officeLocation.address}. Service availability varies by location, staffing,
            clinical need and insurance authorization — our team can give you specifics once we review your request.
          </p>
          <div className="text-center">
            <Button href="/contact">{t("requestServices")}</Button>
          </div>
        </div>
      </Section>
    </>
  );
}
