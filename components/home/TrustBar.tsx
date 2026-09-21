"use client";

import { useTranslations } from "next-intl";
import Container from "@/components/ui/Container";

export default function TrustBar() {
  const t = useTranslations("home.trustBar");
  const items = t.raw("items") as string[];

  return (
    <div className="border-y border-ink-100 bg-white py-5">
      <Container>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-ink-700">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
