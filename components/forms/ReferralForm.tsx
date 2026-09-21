"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import ConsentCheckbox from "./ConsentCheckbox";
import { cn } from "@/lib/utils";

type FieldState = {
  professionalName: string;
  organization: string;
  role: string;
  phone: string;
  email: string;
  clientFirstName: string;
  clientCity: string;
  clientZip: string;
  notes: string;
  companyWebsite: string;
};

const initial: FieldState = {
  professionalName: "",
  organization: "",
  role: "",
  phone: "",
  email: "",
  clientFirstName: "",
  clientCity: "",
  clientZip: "",
  notes: "",
  companyWebsite: "",
};

export default function ReferralForm() {
  const t = useTranslations("forms");
  const tc = useTranslations("common");
  const [fields, setFields] = useState<FieldState>(initial);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  function set<K extends keyof FieldState>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};
    if (!fields.professionalName) newErrors.professionalName = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) newErrors.email = true;
    if (!fields.phone) newErrors.phone = true;
    if (!consent) newErrors.consent = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, consent: true }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl3 border border-brand-green/30 bg-brand-green-light p-8 text-center">
        <p className="text-lg font-semibold text-ink-900">{t("validation.success")}</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-ink-100 px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue";
  const labelClass = "mb-1.5 block text-sm font-medium text-ink-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <input
        type="text"
        value={fields.companyWebsite}
        onChange={(e) => set("companyWebsite", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="professionalName">
            {t("labels.fullName")}
          </label>
          <input
            id="professionalName"
            className={cn(inputClass, errors.professionalName && "border-brand-coral")}
            value={fields.professionalName}
            onChange={(e) => set("professionalName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="organization">
            {t("labels.organization")}
          </label>
          <input
            id="organization"
            className={inputClass}
            value={fields.organization}
            onChange={(e) => set("organization", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="role">
            {t("labels.role")}
          </label>
          <input id="role" className={inputClass} value={fields.role} onChange={(e) => set("role", e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ref-phone">
            {t("labels.phone")}
          </label>
          <input
            id="ref-phone"
            type="tel"
            className={cn(inputClass, errors.phone && "border-brand-coral")}
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ref-email">
            {t("labels.email")}
          </label>
          <input
            id="ref-email"
            type="email"
            className={cn(inputClass, errors.email && "border-brand-coral")}
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="clientFirstName">
            {t("labels.clientFirstName")}
          </label>
          <input
            id="clientFirstName"
            className={inputClass}
            value={fields.clientFirstName}
            onChange={(e) => set("clientFirstName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientCity">
            {t("labels.city")}
          </label>
          <input
            id="clientCity"
            className={inputClass}
            value={fields.clientCity}
            onChange={(e) => set("clientCity", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="clientZip">
            {t("labels.zip")}
          </label>
          <input
            id="clientZip"
            inputMode="numeric"
            className={inputClass}
            value={fields.clientZip}
            onChange={(e) => set("clientZip", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="ref-notes">
          {t("labels.message")}
        </label>
        <textarea
          id="ref-notes"
          rows={3}
          className={inputClass}
          value={fields.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <ConsentCheckbox checked={consent} onChange={setConsent} error={errors.consent} />
      {status === "error" && <p className="text-sm text-brand-coral">{t("validation.genericError")}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-brand-blue px-6 py-3.5 text-center text-base font-semibold text-white shadow-card disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? tc("loading") : tc("referAClient")}
      </button>
    </form>
  );
}
