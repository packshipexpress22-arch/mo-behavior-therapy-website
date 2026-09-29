import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";
import { footerNav } from "@/data/nav";
import { company } from "@/data/company";
import { telHref, mailHref, mapsHref, mapsEmbedSrc } from "@/lib/utils";
import Logo from "./Logo";

export default function Footer() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");
  const year = new Date().getFullYear();

  const columns: { heading: string; items: { key: string; href: string }[] }[] = [
    { heading: t("quickLinks"), items: footerNav.company.map((i) => ({ key: i.key, href: i.href })) },
    { heading: t("quickLinks"), items: footerNav.services },
    { heading: t("forProfessionals"), items: footerNav.forProfessionals },
    { heading: t("legal"), items: footerNav.legal },
  ];

  return (
    <footer className="border-t border-ink-100 bg-ink-100/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo />
            <address className="mt-4 not-italic text-sm leading-relaxed text-ink-700">
              {company.legalName}
              <br />
              {company.address.line1}
              <br />
              {company.address.city}, {company.address.state} {company.address.zip}
            </address>
            <p className="mt-3 text-sm text-ink-700">
              <a href={telHref(company.phone.e164)} className="font-semibold text-brand-blue hover:underline">
                {company.phone.display}
              </a>
            </p>
            <p className="text-sm text-ink-700">
              <a href={mailHref(company.email)} className="hover:underline">
                {company.email}
              </a>
            </p>
            <p className="mt-2 text-xs text-ink-500">{tc("hours")}</p>
            {company.social.instagram && (
              <a
                href={company.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("followOnInstagram")}
                className="mt-4 inline-flex items-center gap-2 text-sm text-ink-700 hover:text-brand-blue"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5 shrink-0"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                </svg>
                {t("followOnInstagram")}
              </a>
            )}
          </div>

          <nav aria-label={t("services")} className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-ink-900">{t("services")}</h2>
            <ul className="mt-3 space-y-2">
              {footerNav.services.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-ink-700 hover:text-brand-blue">
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("quickLinks")} className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-ink-900">{t("quickLinks")}</h2>
            <ul className="mt-3 space-y-2">
              {footerNav.company.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-ink-700 hover:text-brand-blue">
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("forProfessionals")} className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-ink-900">{t("forProfessionals")}</h2>
            <ul className="mt-3 space-y-2">
              {footerNav.forProfessionals.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-ink-700 hover:text-brand-blue">
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t("legal")} className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-ink-900">{t("legal")}</h2>
            <ul className="mt-3 space-y-2">
              {footerNav.legal.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-ink-700 hover:text-brand-blue">
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl2 border border-ink-100 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-white px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink-900">{tc("officeLocation")}</h2>
            <a
              href={mapsHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-blue hover:underline"
            >
              {t("getDirections")}
            </a>
          </div>
          <iframe
            src={mapsEmbedSrc()}
            title={tc("officeLocation")}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-72 w-full border-0 sm:h-80"
          />
        </div>

        <div className="mt-10 border-t border-ink-100 pt-6 text-xs text-ink-500">
          {t("copyright", { year })}
        </div>
      </div>
    </footer>
  );
}
