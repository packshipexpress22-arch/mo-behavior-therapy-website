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
        {/* Decorative placeholder (no real photo yet) — a simple warm
            parent+child motif rather than a blank box, so this half of
            the section doesn't read as a missing/broken image. */}
        <div
          aria-hidden="true"
          className="relative aspect-video overflow-hidden rounded-xl3 border border-white bg-white/60 shadow-card"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-gold/25 blur-2xl" />
          <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-brand-coral/20 blur-2xl" />
          <svg
            viewBox="0 0 200 120"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <circle cx="78" cy="58" r="30" fill="#1F6FEB" fillOpacity="0.18" />
            <circle cx="120" cy="66" r="20" fill="#2FAE66" fillOpacity="0.22" />
            <path
              d="M96 50c3-6 11-6 14 0 3-6 11-6 14 0 2 4-2 10-14 16-12-6-16-12-14-16z"
              fill="#F0554A"
              opacity="0.5"
            />
          </svg>
        </div>
      </div>
    </Section>
  );
}
