"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Turnstile from "./Turnstile";
import { cn } from "@/lib/utils";

const TURNSTILE_REQUIRED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

type FieldState = {
  applicantName: string;
  phone: string;
  email: string;
  positionAppliedFor: string;
  message: string;
  companyWebsite: string;
};

const initial: FieldState = {
  applicantName: "",
  phone: "",
  email: "",
  positionAppliedFor: "",
  message: "",
  companyWebsite: "",
};

export default function CareersForm() {
  const t = useTranslations("forms");
  const tp = useTranslations("pages.careers");
  const tc = useTranslations("common");
  const [fields, setFields] = useState<FieldState>(initial);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "captcha_error">("idle");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [turnstileToken, setTurnstileToken] = useState("");

  function set<K extends keyof FieldState>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};
    if (!fields.applicantName) newErrors.applicantName = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) newErrors.email = true;
    if (!fields.positionAppliedFor) newErrors.positionAppliedFor = true;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/careers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, turnstileToken }),
      });
      if (res.ok) {
        setStatus("success");
        return;
      }
      const resBody = await res.json().catch(() => ({}) as { error?: string });
      setStatus(resBody.error === "captcha_failed" ? "captcha_error" : "error");
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
          <label className={labelClass} htmlFor="applicantName">
            {t("labels.fullName")}
          </label>
          <input
            id="applicantName"
            className={cn(inputClass, errors.applicantName && "border-brand-coral")}
            value={fields.applicantName}
            onChange={(e) => set("applicantName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="positionAppliedFor">
            {t("labels.positionAppliedFor")}
          </label>
          <select
            id="positionAppliedFor"
            className={cn(inputClass, errors.positionAppliedFor && "border-brand-coral")}
            value={fields.positionAppliedFor}
            onChange={(e) => set("positionAppliedFor", e.target.value)}
          >
            <option value="" />
            {(tp.raw("roles") as string[]).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="c-phone">
            {t("labels.phone")}
          </label>
          <input id="c-phone" type="tel" className={inputClass} value={fields.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="c-email">
            {t("labels.email")}
          </label>
          <input
            id="c-email"
            type="email"
            className={cn(inputClass, errors.email && "border-brand-coral")}
            value={fields.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="c-message">
          {t("labels.message")}
        </label>
        <textarea
          id="c-message"
          rows={4}
          className={inputClass}
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
        />
        <p className="mt-2 text-xs text-ink-500">
        </p>
      </div>

      <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />

      {status === "error" && <p className="text-sm text-brand-coral">{t("validation.genericError")}</p>}
      {status === "captcha_error" && (
        <p className="text-sm text-brand-coral">
          Please complete the verification check above and try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || (TURNSTILE_REQUIRED && !turnstileToken)}
        className="w-full rounded-full bg-brand-blue px-6 py-3.5 text-center text-base font-semibold text-white shadow-card disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? tc("loading") : tc("joinOurTeam")}
      </button>
    </form>
  );
}
