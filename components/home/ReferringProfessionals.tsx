"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function ReferringProfessionals() {
  const t = useTranslations("home.referring");

  return (
    <Section>
      <div className="rounded-xl3 border border-ink-100 bg-gradient-to-br from-brand-blue-light to-white p-10 text-center shadow-card sm:p-14">
        <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-700">{t("body")}</p>
        <div className="mt-8">
          <Button href="/referral-sources" variant="primary">
            {t("cta")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
