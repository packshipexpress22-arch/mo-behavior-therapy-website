"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";

export default function GettingStartedTimeline() {
  const t = useTranslations("home.timeline");
  const steps = t.raw("steps") as { step: string; title: string; description: string }[];

  return (
    <Section className="bg-brand-navy text-white">
      <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">{t("heading")}</h2>
      <div className="relative mt-12">
        {/* Decorative connecting line — a sibling of <ol>, not a child of
            it, so <ol> still contains only <li> elements. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[13%] right-[13%] top-[34px] hidden h-0.5 bg-gradient-to-r from-brand-gold/50 via-white/15 to-brand-gold/50 lg:block"
        />
        <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.step}
              className="group relative rounded-xl2 border border-white/15 bg-white/5 p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white/10"
            >
              <span className="inline-flex font-display text-3xl font-bold text-brand-gold transition-transform duration-200 group-hover:scale-110">
                {s.step}
              </span>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/75">{s.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
