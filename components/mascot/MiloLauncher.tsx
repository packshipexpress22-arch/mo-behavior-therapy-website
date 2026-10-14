"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Milo from "./Milo";

const SESSION_GREETED_KEY = "milo-greeted";
const AUTO_GREET_DELAY_MS = 2600;
const BUBBLE_VISIBLE_MS = 3400;

/**
 * The floating "Milo" launcher — replaces AppChrome's old plain
 * <img src="/logo.png"> button with the animated mascot (components/mascot/Milo.tsx)
 * plus a speech-bubble greeting, per the user's design request:
 *   "El icono de milo puede ser un poco mas grande y quiero que cuando lo
 *   toque blink y salga un globo que salude a la persona que esta
 *   visitando la pagina" — confirmed via AskUserQuestion to trigger
 *   automatically once per visit (a few seconds after load) AND again on
 *   every subsequent tap.
 *
 * Still toggles the real ChatWidget on click (unchanged behavior) — the
 * greeting bubble is an extra flourish layered on top, not a replacement
 * for opening the chat.
 */
export default function MiloLauncher({
  chatOpen,
  onToggleChat,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  const t = useTranslations("chat");
  const reduceMotion = useReducedMotion();
  const [blinkNonce, setBlinkNonce] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  function triggerGreeting() {
    setBlinkNonce((n) => n + 1);
    setBubbleVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubbleVisible(false), BUBBLE_VISIBLE_MS);
  }

  useEffect(() => {
    // Auto-greet once per browser session/visit — not every page
    // navigation, which would make Milo pop up on every single page.
    let already = true;
    try {
      already = sessionStorage.getItem(SESSION_GREETED_KEY) === "1";
    } catch {
      /* sessionStorage unavailable (privacy mode, etc.) — just skip the
         auto-greet rather than throwing */
    }
    if (already) return;
    const timer = setTimeout(() => {
      triggerGreeting();
      try {
        sessionStorage.setItem(SESSION_GREETED_KEY, "1");
      } catch {
        /* ignore */
      }
    }, AUTO_GREET_DELAY_MS);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function handleClick() {
    onToggleChat();
    triggerGreeting();
  }

  return (
    <div className="fixed bottom-[76px] right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {bubbleVisible && (
          <motion.div
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative max-w-[200px] rounded-xl2 border border-ink-100 bg-white px-3.5 py-2.5 text-xs font-medium leading-snug text-ink-900 shadow-soft"
          >
            {t("bubbleGreeting")}
            <span
              aria-hidden="true"
              className="absolute -bottom-[5px] right-7 h-3 w-3 rotate-45 border-b border-r border-ink-100 bg-white"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleClick}
        aria-expanded={chatOpen}
        aria-label={t("assistantName")}
        className="flex items-center gap-2 rounded-full bg-brand-blue py-2 pl-2 pr-4 text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:scale-105 active:scale-95"
      >
        <Milo size={46} blinkNonce={blinkNonce} />
        <span className="hidden text-sm font-semibold sm:inline">{t("assistantName")}</span>
      </button>
    </div>
  );
}
