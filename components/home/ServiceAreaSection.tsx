"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { counties, cities, officeLocation } from "@/data/serviceAreas";

export default function ServiceAreaSection() {
  const t = useTranslations("home.serviceArea");
  const tc = useTranslations("common");

  return (
    <Section className="bg-ink-100/40">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-700">{t("body")}</p>
          <p className="mt-4 max-w-xl rounded-xl2 border border-ink-100 bg-white p-4 text-sm text-ink-700">
            <strong className="block text-ink-900">{tc("officeLocation")}</strong>
            {officeLocation.address}
          </p>
          <div className="mt-6">
            <Button href="/service-areas" variant="secondary">
              {t("cta")}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{tc("serviceAreaLabel")}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {counties.map((c) => (
              <span key={c.id} className="rounded-full border border-ink-100 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-900">
                {c.name}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-brand-blue-light px-3.5 py-1.5 text-sm font-medium text-brand-blue"
              >
                {c.name}
                {c.isOfficeLocation && " ★"}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">{t("officeNote")}</p>
        </div>
      </div>
    </Section>
  );
}
