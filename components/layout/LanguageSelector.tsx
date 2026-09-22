"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useRef, useEffect, useTransition } from "react";
import { locales, localeNames, type Locale } from "@/i18n";
import { usePathname, useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export default function LanguageSelector({ variant = "light" }: { variant?: "light" | "dark" }) {
  const t = useTranslations("languageSelector");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function switchTo(next: Locale) {
    // Guard against a second switch firing before the first one's
    // navigation (and the NEXT_LOCALE cookie it sets) has finished:
    // two overlapping router.replace() calls can resolve out of order,
    // leaving the cookie pointing at whichever one happened to respond
    // last rather than the locale the user actually picked last. Ignoring
    // clicks while a switch is still pending keeps the two in sync.
    if (isPending || next === locale) {
      setOpen(false);
      return;
    }
    setOpen(false);
    try {
      window.localStorage.setItem("mo-preferred-locale", next);
    } catch {
      /* private browsing / storage disabled — non-fatal */
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const dark = variant === "dark";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={isPending}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-70",
          dark
            ? "border-white/30 text-white hover:bg-white/10"
            : "border-ink-100 text-ink-900 hover:bg-ink-100"
        )}
      >
        <span aria-hidden="true">🌐</span>
        <span>{localeNames[locale]}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}>
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="listbox" aria-label={t("label")}
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl2 border border-ink-100 bg-white py-2 shadow-soft">
          {locales.map((l) => (
            <button
              key={l}
              role="option"
              aria-selected={l === locale}
              disabled={isPending}
              onClick={() => switchTo(l)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-brand-blue-light disabled:cursor-not-allowed disabled:opacity-60",
                l === locale ? "font-semibold text-brand-blue" : "text-ink-900"
              )}
            >
              {localeNames[l]}
              {l === locale && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="mt-1 border-t border-ink-100 px-4 pt-2 text-xs text-ink-500">
            <p className="font-medium text-ink-700">{t("moreLanguages")}</p>
            <p>{t("moreLanguagesNote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
