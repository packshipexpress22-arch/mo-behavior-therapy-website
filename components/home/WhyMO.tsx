"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";

export default function WhyMO() {
  const t = useTranslations("home.why");
  const items = t.raw("items") as { title: string; description: string }[];

  return (
    <Section>
      <h2 className="text-center font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={item.title} className="rounded-xl2 border border-ink-100 p-6 transition-shadow hover:shadow-card">
            <span
              aria-hidden="true"
              className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{
                backgroundColor: ["#1F6FEB", "#2FAE66", "#F5B400", "#F47C20", "#F0554A", "#7C5CFC"][i % 6],
              }}
            >
              {i + 1}
            </span>
            <h3 className="text-base font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{item.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
