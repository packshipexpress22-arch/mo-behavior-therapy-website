import { company } from "@/data/company";
import { counties, cities } from "@/data/serviceAreas";
import { mapsHref } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

function areaServedList() {
  return [
    ...counties.map((c) => ({ "@type": "AdministrativeArea", name: c.name })),
    ...cities.map((c) => ({
      "@type": "City",
      name: c.name,
      "@id": `${siteUrl}/service-areas/${c.slug}`,
    })),
  ];
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${siteUrl}/#organization`,
    name: company.legalName,
    alternateName: company.shortName,
    url: siteUrl,
    telephone: company.phone.e164,
    email: company.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: company.address.line1,
      addressLocality: company.address.city,
      addressRegion: company.address.state,
      postalCode: company.address.zip,
      addressCountry: "US",
    },
    hasMap: mapsHref(),
    areaServed: areaServedList(),
    medicalSpecialty: "Applied Behavior Analysis (ABA) Therapy",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:30",
      closes: "17:00",
    },
  };
}

export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#localbusiness`,
    name: company.legalName,
    image: `${siteUrl}/logo.png`,
    telephone: company.phone.e164,
    email: company.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: company.address.line1,
      addressLocality: company.address.city,
      addressRegion: company.address.state,
      postalCode: company.address.zip,
      addressCountry: "US",
    },
    hasMap: mapsHref(),
    priceRange: "$$",
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function serviceSchema(name: string, description: string, areaServedNames?: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: name,
    description,
    provider: { "@id": `${siteUrl}/#organization` },
    areaServed: areaServedNames
      ? areaServedNames.map((n) => ({ "@type": "City", name: n }))
      : counties.map((c) => ({ "@type": "AdministrativeArea", name: c.name })),
  };
}
