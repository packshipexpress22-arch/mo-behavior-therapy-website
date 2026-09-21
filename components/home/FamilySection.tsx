"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function FamilySection() {
  const t = useTranslations("home.family");
  const tc = useTranslations("common");

  return (
    <Section className="bg-brand-green-light">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-700">{t("body")}</p>
          <div className="mt-6">
            <Button href="/parent-caregiver-training" variant="primary">
              {tc("learnMore")}
            </Button>
          </div>
        </div>
        <div className="aspect-video rounded-xl3 border border-white bg-white/60 shadow-card" aria-hidden="true" />
      </div>
    </Section>
  );
}
