import type { MetadataRoute } from "next";
import { locales } from "@/i18n";
import { insurancePlans } from "@/data/insurance";
import { cities } from "@/data/serviceAreas";

const staticPaths = [
  "",
  "/aba-therapy",
  "/services",
  "/parent-caregiver-training",
  "/where-we-provide-services",
  "/insurance",
  "/about",
  "/service-areas",
  "/referral-sources",
  "/careers",
  "/faq",
  "/contact",
  "/privacy-policy",
  "/accessibility",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobehaviortherapy.com";

  const dynamicPaths = [
    ...insurancePlans.map((p) => `/insurance/${p.slug}`),
    ...cities.map((c) => `/service-areas/${c.slug}`),
  ];

  const allPaths = [...staticPaths, ...dynamicPaths];

  const entries: MetadataRoute.Sitemap = [];
  for (const path of allPaths) {
    for (const locale of locales) {
      const prefix = locale === "en" ? "" : `/${locale}`;
      entries.push({
        url: `${siteUrl}${prefix}${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
      });
    }
  }

  return entries;
}

