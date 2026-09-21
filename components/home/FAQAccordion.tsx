"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Section from "@/components/ui/Section";
import { faqOrder } from "@/data/faq";
import JsonLd from "@/components/seo/JsonLd";
import { faqSchema } from "@/lib/schema";

export default function FAQAccordion({ limit }: { limit?: number }) {
  const t = useTranslations("faq.items");
  const tp = useTranslations("pages.faq");
  const [openId, setOpenId] = useState<string | null>(faqOrder[0]);
  const ids = limit ? faqOrder.slice(0, limit) : faqOrder;

  const schemaItems = faqOrder.map((id) => ({
    question: t(`${id}.question`),
    answer: t(`${id}.answer`),
  }));

  return (
    <Section id="faq">
      <JsonLd data={faqSchema(schemaItems)} />
      <h2 className="text-center font-display text-3xl font-bold text-ink-900 sm:text-4xl">{tp("title")}</h2>
      <div className="mx-auto mt-10 max-w-3xl divide-y divide-ink-100 rounded-xl3 border border-ink-100">
        {ids.map((id) => {
          const isOpen = openId === id;
          return (
            <div key={id}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${id}`}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink-900 sm:text-base"
                >
                  {t(`${id}.question`)}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={isOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  >
                    <path d="M2 5l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </h3>
              {isOpen && (
                <div id={`faq-panel-${id}`} className="px-5 pb-4 text-sm leading-relaxed text-ink-700">
                  {t(`${id}.answer`)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
