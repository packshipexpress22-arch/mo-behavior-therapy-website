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
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-white object-contain"
        />
        <span className="hidden text-sm font-semibold sm:inline">{t("assistantName")}</span>
      </button>

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />

      <MobileStickyBar onChatClick={() => setChatOpen(true)} />
    </>
  );
}
