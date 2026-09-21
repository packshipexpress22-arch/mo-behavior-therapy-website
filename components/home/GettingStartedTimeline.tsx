"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";

export default function GettingStartedTimeline() {
  const t = useTranslations("home.timeline");
  const steps = t.raw("steps") as { step: string; title: string; description: string }[];

  return (
    <Section className="bg-brand-navy text-white">
      <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">{t("heading")}</h2>
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.step} className="rounded-xl2 border border-white/15 bg-white/5 p-6">
            <span className="font-display text-3xl font-bold text-brand-gold">{s.step}</span>
            <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">{s.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
