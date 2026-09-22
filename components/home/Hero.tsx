"use client";

import { useTranslations } from "next-intl";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import LanguageSelector from "@/components/layout/LanguageSelector";
import { company } from "@/data/company";
import { telHref } from "@/lib/utils";

export default function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative overflow-hidden wave-divider">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-gold/20 blur-3xl animate-wave-drift"
      />
      <div
        aria-hidden="true"
        className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-brand-green/20 blur-3xl animate-wave-drift"
      />
      <Container className="relative py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-blue">{t("eyebrow")}</p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] text-ink-900 sm:text-5xl">
              {t("headline")}
            </h1>
            <p className="mt-4 text-xl font-medium text-ink-700">{t("subheadline")}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-700">{t("body")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button href="/contact" variant="primary">
                {t("primaryCta")}
              </Button>
              <Button href={telHref(company.phone)} variant="outline">
                {t("secondaryCta")}
              </Button>
            </div>

            <div className="mt-6">
              <LanguageSelector />
            </div>
          </div>

          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl3 border border-white/60 bg-gradient-to-br from-brand-blue-light via-white to-brand-green-light shadow-soft">
              <img
                src="/hero-child.jpg"
                alt="Child engaged in a therapy activity"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
