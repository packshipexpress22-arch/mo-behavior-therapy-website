import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import PageHero from "@/components/ui/PageHero";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema, serviceSchema, faqSchema } from "@/lib/schema";
import { cities, counties, officeLocation } from "@/data/serviceAreas";

// Note: generateStaticParams is intentionally omitted here (see
// app/[locale]/layout.tsx for why) — forcing static generation for this
// route while it calls next-intl's getTranslations() without setRequestLocale
// causes a hard prerender error. Rendering dynamically is correct.

export async function generateMetadata({ params }: { params: { city: string } }) {
  const city = cities.find((c) => c.slug === params.city);
  if (!city) return {};
  return {
    title: `ABA Therapy in ${city.name}, FL | MO Behavior Therapy`,
    description: `Individualized, BCBA-led ABA services available to families in ${city.name}, FL. Service availability varies by location, staffing, clinical need and insurance authorization.`,
  };
}

// A small, page-specific FAQ pulled from the shared FAQ copy (never invented
// text) — gives each city page unique, indexable content instead of being a
// thin near-duplicate of the others, and doubles as FAQPage structured data.
const cityFaqIds = ["areasServed", "insuranceCoverage", "howToRequestServices"] as const;

export default async function CityPage({ params }: { params: { city: string } }) {
  const city = cities.find((c) => c.slug === params.city);
  if (!city) notFound();

  const county = counties.find((c) => c.id === city.county);
  const t = await getTranslations("common");
  const tFaqPage = await getTranslations("pages.faq");
  const tFaqItems = await getTranslations("faq.items");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  const cityFaqs = cityFaqIds.map((id) => ({
    question: tFaqItems(`${id}.question`),
    answer: tFaqItems(`${id}.answer`),
  }));

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: siteUrl },
          { name: "Service Areas", url: `${siteUrl}/service-areas` },
          { name: city.name, url: `${siteUrl}/service-areas/${city.slug}` },
        ])}
      />
      <JsonLd
        data={serviceSchema(
          "ABA Therapy",
          `Individualized, BCBA-led ABA therapy for families in ${city.name}, FL.`,
          [city.name]
        )}
      />
      <JsonLd data={faqSchema(cityFaqs)} />
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
      <Section className="bg-ink-100/40">
        <h2 className="text-center font-display text-2xl font-bold text-ink-900 sm:text-3xl">{tFaqPage("title")}</h2>
        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          {cityFaqs.map((item) => (
            <div key={item.question} className="rounded-xl2 border border-ink-100 bg-white p-5">
              <h3 className="text-sm font-semibold text-ink-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.answer}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
