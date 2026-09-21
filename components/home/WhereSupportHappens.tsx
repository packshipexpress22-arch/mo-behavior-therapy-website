"use client";

import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";

const icons: Record<string, JSX.Element> = {
  home: (
    <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  school: (
    <path
      d="M12 4l9 4-9 4-9-4 9-4zM5 10.5V16c0 1.5 3 3 7 3s7-1.5 7-3v-5.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  community: (
    <path
      d="M8 12a3 3 0 100-6 3 3 0 000 6zM16 12a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.5-5 6-5s6 2 6 5M10 20c0-3 2.5-5 6-5s6 2 6 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export default function WhereSupportHappens() {
  const t = useTranslations("home.whereSupport");
  const keys = ["home", "school", "community"] as const;

  return (
    <Section className="bg-ink-100/40">
      <h2 className="text-center font-display text-3xl font-bold text-ink-900 sm:text-4xl">{t("heading")}</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {keys.map((key) => (
          <div key={key} className="rounded-xl3 border border-ink-100 bg-white p-7 shadow-card">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {icons[key]}
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-ink-900">{t(`${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{t(`${key}.description`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
