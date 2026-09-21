"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n";
import { insuranceSelectOptions } from "@/data/insurance";
import ConsentCheckbox from "./ConsentCheckbox";
import { cn } from "@/lib/utils";

type FieldState = {
  contactName: string;
  clientFirstName: string;
  relationship: string;
  clientAge: string;
  phone: string;
  email: string;
  city: string;
  zip: string;
  setting: string;
  insurance: string;
  previousAba: string;
  hasReferral: string;
  hasEvaluation: string;
  hasIep: string;
  contactMethod: string;
  contactTime: string;
  howHeard: string;
  message: string;
  companyWebsite: string; // honeypot
};

const initial: FieldState = {
  contactName: "",
  clientFirstName: "",
  relationship: "",
  clientAge: "",
  phone: "",
  email: "",
  city: "",
  zip: "",
  setting: "",
  insurance: "",
  previousAba: "",
  hasReferral: "",
  hasEvaluation: "",
  hasIep: "",
  contactMethod: "",
  contactTime: "",
  howHeard: "",
  message: "",
  companyWebsite: "",
};

export default function LeadForm() {
  const t = useTranslations("forms");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
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
    if (!fields.contactName) newErrors.contactName = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) newErrors.email = true;
    if (!/^[\d\s()+.-]{7,20}$/.test(fields.phone)) newErrors.phone = true;
    if (!consent) newErrors.consent = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...fields,
          preferredLanguage: locale,
          consent: true,
          consentTextVersion: "2026-09-v1",
          sourcePage: typeof window !== "undefined" ? window.location.pathname : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
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
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Honeypot — visually and functionally hidden from real visitors */}
      <input
        type="text"
        name="companyWebsite"
        value={fields.companyWebsite}
        onChange={(e) => set("companyWebsite", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="contactName">
            {t("labels.contactName")}
          </label>
          <input
            id="contactName"
            className={cn(inputClass, errors.contactName && "border-brand-coral")}
            value={fields.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="relationship">
            {t("labels.relationship")}
          </label>
          <select
            id="relationship"
            className={inputClass}
            value={fields.relationship}
            onChange={(e) => set("relationship", e.target.value)}
          >
            <option value="" />
            {(t.raw("options.relationship") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
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
          <label className={labelClass} htmlFor="clientAge">
            {t("labels.clientAge")}
          </label>
          <input
            id="clientAge"
            className={inputClass}
            value={fields.clientAge}
            onChange={(e) => set("clientAge", e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="phone">
            {t("labels.phone")}
          </label>
          <input
            id="phone"
            type="tel"
            className={cn(inputClass, errors.phone && "border-brand-coral")}
            value={fields.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">
            {t("labels.email")}
          </label>
          <input
            id="email"
            type="email"
            className={cn(inputClass, errors.email && "border-brand-coral")}
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="city">
            {t("labels.city")}
          </label>
          <input id="city" className={inputClass} value={fields.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="zip">
            {t("labels.zip")}
          </label>
          <input
            id="zip"
            inputMode="numeric"
            className={inputClass}
            value={fields.zip}
            onChange={(e) => set("zip", e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="setting">
            {t("labels.preferredSetting")}
          </label>
          <select id="setting" className={inputClass} value={fields.setting} onChange={(e) => set("setting", e.target.value)}>
            <option value="" />
            {(t.raw("options.settings") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="insurance">
            {t("labels.insurance")}
          </label>
          <select id="insurance" className={inputClass} value={fields.insurance} onChange={(e) => set("insurance", e.target.value)}>
            <option value="" />
            {insuranceSelectOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="previousAba">
            {t("labels.previousAba")}
          </label>
          <select
            id="previousAba"
            className={inputClass}
            value={fields.previousAba}
            onChange={(e) => set("previousAba", e.target.value)}
          >
            <option value="" />
            {(t.raw("options.yesNoUnsure") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="howHeard">
            {t("labels.howHeard")}
          </label>
          <select id="howHeard" className={inputClass} value={fields.howHeard} onChange={(e) => set("howHeard", e.target.value)}>
            <option value="" />
            {(t.raw("options.howHeard") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        {(["hasReferral", "hasEvaluation", "hasIep"] as const).map((key) => (
          <div key={key}>
            <label className={labelClass} htmlFor={key}>
              {t(`labels.${key}`)}
            </label>
            <select id={key} className={inputClass} value={fields[key]} onChange={(e) => set(key, e.target.value)}>
              <option value="" />
              {(t.raw("options.availability") as string[]).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="contactMethod">
            {t("labels.preferredContactMethod")}
          </label>
          <select
            id="contactMethod"
            className={inputClass}
            value={fields.contactMethod}
            onChange={(e) => set("contactMethod", e.target.value)}
          >
            <option value="" />
            {(t.raw("options.contactMethod") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="contactTime">
            {t("labels.preferredContactTime")}
          </label>
          <select
            id="contactTime"
            className={inputClass}
            value={fields.contactTime}
            onChange={(e) => set("contactTime", e.target.value)}
          >
            <option value="" />
            {(t.raw("options.contactTime") as string[]).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="message">
          {t("labels.message")}
        </label>
        <textarea
          id="message"
          rows={3}
          className={inputClass}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>

      <ConsentCheckbox checked={consent} onChange={setConsent} error={errors.consent} />
      {errors.consent && <p className="text-sm text-brand-coral">{t("validation.consentRequired")}</p>}
      {status === "error" && <p className="text-sm text-brand-coral">{t("validation.genericError")}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-brand-blue px-6 py-3.5 text-center text-base font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? tc("loading") : tc("submit")}
      </button>
    </form>
  );
}
