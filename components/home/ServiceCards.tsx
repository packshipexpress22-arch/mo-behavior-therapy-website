"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function ServiceCards() {
  const t = useTranslations("home.services");
  const tp = useTranslations("pages");

  const cards = [
    { title: tp("abaTherapy.sections.0.title"), body: tp("abaTherapy.sections.0.body") },
    { title: tp("services.behaviorReduction.title"), body: tp("services.behaviorReduction.body") },
    { title: tp("services.parentTraining.title"), body: tp("services.parentTraining.body") },
    { title: tp("whereWeProvide.school.title"), body: tp("whereWeProvide.school.body") },
  ];

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
        <p className="mt-4 text-base leading-relaxed text-ink-700">{t("subheading")}</p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl3 border border-ink-100 p-6 shadow-card">
            <h3 className="text-base font-semibold text-ink-900">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{card.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Button href="/services" variant="secondary">
          {t("cta")}
        </Button>
      </div>
    </Section>
  );
}
