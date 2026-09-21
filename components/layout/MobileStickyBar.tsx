"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";
import { company } from "@/data/company";
import { telHref } from "@/lib/utils";

export default function MobileStickyBar({ onChatClick }: { onChatClick: () => void }) {
  const t = useTranslations("mobileBar");

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-ink-100 bg-white shadow-[0_-4px_16px_rgba(15,27,43,0.08)] lg:hidden"
      role="navigation"
      aria-label="Quick actions"
    >
      <a
        href={telHref(company.phone.e164)}
        className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold text-ink-900 active:bg-ink-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 3c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        {t("call")}
      </a>
      <Link
        href="/contact"
        className="flex flex-col items-center justify-center gap-0.5 border-x border-ink-100 bg-brand-blue py-2.5 text-xs font-semibold text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {t("request")}
      </Link>
      <button
        type="button"
        onClick={onChatClick}
        className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold text-ink-900 active:bg-ink-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 11.5a8.4 8.4 0 01-8.9 8.4 8.9 8.9 0 01-3.2-.6L3 21l1.7-5A8.4 8.4 0 1121 11.5z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        {t("chat")}
      </button>
    </div>
  );
}
