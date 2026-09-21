"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { company } from "@/data/company";
import { telHref } from "@/lib/utils";

export default function FinalCTA() {
  const t = useTranslations("home.finalCta");

  return (
    <Section className="bg-brand-navy text-white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{t("heading")}</h2>
        <p className="mt-4 text-base leading-relaxed text-white/80">{t("body")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/contact" variant="white">
            {t("primaryCta")}
          </Button>
          <Button href={telHref(company.phone.e164)} variant="ghost" className="border-white/30 text-white hover:bg-white/10">
            {t("tertiaryCta")}
          </Button>
        </div>
      </div>
    </Section>
  );
}
