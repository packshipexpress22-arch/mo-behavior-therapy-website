"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/navigation";

/**
 * Shared, unchecked-by-default consent control used by every form that
 * submits a lead. Never pre-check this — that's a hard requirement from the
 * client's brief, not a default to "improve" later.
 */
export default function ConsentCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
}) {
  const t = useTranslations("forms.consent");

  return (
    <div>
      <label className="flex items-start gap-3 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"
          aria-invalid={error}
          aria-describedby="consent-links"
        />
        <span>{t("text")}</span>
      </label>
      <p id="consent-links" className="mt-1.5 pl-8 text-xs text-ink-500">
        {t.rich("links", {
          privacyPolicy: (chunks) => (
            <Link href="/privacy-policy" className="underline hover:text-brand-blue">
              {chunks}
            </Link>
          ),
          terms: (chunks) => (
            <Link href="/terms" className="underline hover:text-brand-blue">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
