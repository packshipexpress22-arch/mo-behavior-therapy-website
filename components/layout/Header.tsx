"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";
import { primaryNav } from "@/data/nav";
import { company } from "@/data/company";
import { telHref } from "@/lib/utils";
import Logo from "./Logo";
import LanguageSelector from "./LanguageSelector";

export default function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={company.shortName}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-700 transition-colors hover:text-brand-blue"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSelector />
          <a
            href={telHref(company.phone.e164)}
            className="rounded-full border border-ink-100 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-ink-100"
          >
            {tc("callUsShort")}
          </a>
          <Link
            href="/contact"
            className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 hover:bg-brand-blue"
          >
            {tc("requestServicesShort")}
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-ink-100 p-2 lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? t("close") : t("menu")}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {mobileOpen ? (
              <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-ink-100 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-900 hover:bg-ink-100"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-ink-100 pt-4">
            <LanguageSelector />
            <a
              href={telHref(company.phone.e164)}
              className="rounded-full border border-ink-100 px-4 py-2.5 text-center text-sm font-semibold text-ink-900"
            >
              {tc("callUs")}
            </a>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="rounded-full bg-brand-blue px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              {tc("requestServices")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
