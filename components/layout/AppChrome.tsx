"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import MobileStickyBar from "./MobileStickyBar";
import ChatWidget from "@/components/chat/ChatWidget";

export default function AppChrome() {
  const [chatOpen, setChatOpen] = useState(false);
  const t = useTranslations("chat");

  return (
    <>
      <button
        type="button"
        onClick={() => setChatOpen((o) => !o)}
        aria-expanded={chatOpen}
        aria-label={t("assistantName")}
        className="fixed bottom-[76px] right-4 z-40 flex items-center gap-2 rounded-full bg-brand-blue px-4 py-3 text-white shadow-soft transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 11.5a8.4 8.4 0 01-8.9 8.4 8.9 8.9 0 01-3.2-.6L3 21l1.7-5A8.4 8.4 0 1121 11.5z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
        <span className="hidden text-sm font-semibold sm:inline">{t("assistantName")}</span>
      </button>

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      <MobileStickyBar onChatClick={() => setChatOpen(true)} />
    </>
  );
}
