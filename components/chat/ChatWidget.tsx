"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n";
import { extractFields, isEmergencyMessage } from "@/lib/chat/extract";
import { nextMissingSlot, type LeadDraft, type SlotKey } from "@/lib/chat/conversation";
import { isLikelyInServiceArea } from "@/lib/zip-lookup";
import { insuranceSelectOptions } from "@/data/insurance";
import { company } from "@/data/company";
import { cn, telHref } from "@/lib/utils";
import Logo from "@/components/layout/Logo";

type Msg = { id: string; role: "assistant" | "user"; text: string };

export default function ChatWidget({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("chat");
  const tf = useTranslations("forms");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<LeadDraft>({});
  const [submitted, setSubmitted] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      pushAssistant(t("greeting"));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function pushAssistant(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text }]);
  }
  function pushUser(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
  }

  function askForSlot(slot: SlotKey, currentDraft: LeadDraft) {
    switch (slot) {
      case "whoFor":
        return pushAssistant(t("prompts.whoFor"));
      case "contactName":
        return pushAssistant(t("prompts.contactName"));
      case "relationship":
        return pushAssistant(t("prompts.relationship"));
      case "clientAge":
        return pushAssistant(t("prompts.clientAge"));
      case "cityZip":
        return pushAssistant(t("prompts.cityZip"));
      case "setting":
        return pushAssistant(t("prompts.setting"));
      case "insurance":
        return pushAssistant(t("prompts.insurance"));
      case "previousAba":
        return pushAssistant(t("prompts.previousAba"));
      case "documents":
        return pushAssistant(t("prompts.documents"));
      case "phone":
        return pushAssistant(t("prompts.phone"));
      case "email":
        return pushAssistant(t("prompts.email"));
      case "contactMethod":
        return pushAssistant(t("prompts.contactMethod"));
      case "contactTime":
        return pushAssistant(t("prompts.contactTime"));
      case "consent": {
        setPendingConsent(true);
        return pushAssistant(t("prompts.consent"));
      }
    }
  }

  function advance(updated: LeadDraft) {
    setDraft(updated);
    const missing = nextMissingSlot(updated);
    if (!missing) {
      void finalizeSubmission(updated);
      return;
    }
    // Service-area callout happens once, right after we learn the ZIP.
    if (missing === "setting" && updated.zip && !updated._areaChecked) {
      const { inArea } = isLikelyInServiceArea(updated.zip);
      pushAssistant(inArea ? t("prompts.inServiceArea") : t("prompts.outsideServiceArea"));
      updated = { ...updated, _areaChecked: true } as LeadDraft;
      setDraft(updated);
    }
    askForSlot(missing, updated);
  }

  async function finalizeSubmission(finalDraft: LeadDraft) {
    setSending(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactName: finalDraft.contactName,
          clientFirstName: finalDraft.clientFirstName,
          relationship: finalDraft.relationship,
          clientAge: finalDraft.clientAge,
          city: finalDraft.city,
          zip: finalDraft.zip,
          county: finalDraft.county,
          preferredLanguage: locale,
          setting: finalDraft.setting,
          insurance: finalDraft.insurance,
          previousAba: finalDraft.previousAba,
          hasReferral: finalDraft.hasReferral,
          contactMethod: finalDraft.contactMethod,
          contactTime: finalDraft.contactTime,
          phone: finalDraft.phone,
          email: finalDraft.email,
          consent: true,
          consentTextVersion: "2026-09-v1",
          sourcePage: typeof window !== "undefined" ? window.location.pathname : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          companyWebsite: "",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        pushAssistant(t("confirmation.body"));
      } else {
        pushAssistant(tf("validation.genericError"));
      }
    } catch {
      pushAssistant(tf("validation.genericError"));
    } finally {
      setSending(false);
    }
  }

  function handleConsent(accepted: boolean) {
    setPendingConsent(false);
    pushUser(accepted ? "✓" : "✗");
    if (!accepted) {
      pushAssistant(tf("validation.consentRequired"));
      setPendingConsent(true);
      return;
    }
    void finalizeSubmission(draft);
  }

  async function handleSend(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || sending) return;
    pushUser(text);
    setInput("");

    if (isEmergencyMessage(text)) {
      pushAssistant(t("prompts.emergency"));
      return;
    }

    if (/\b(talk to someone|hablar con alguien|call us|llamar|rele nou)\b/i.test(text)) {
      pushAssistant(t("prompts.talkToSomeone"));
      return;
    }

    const extracted = extractFields(text, locale);
    const merged: LeadDraft = {
      ...draft,
      contactName: draft.contactName || extracted.name,
      relationship: draft.relationship || extracted.relationship,
      clientAge: draft.clientAge || extracted.age,
      city: draft.city || extracted.city,
      zip: draft.zip || extracted.zip,
      setting: draft.setting || (extracted.setting as string | undefined),
      insurance: draft.insurance || extracted.insurance,
      phone: draft.phone || extracted.phone,
      email: draft.email || extracted.email,
    };

    // If this looks like a free-form question rather than a slot answer
    // (i.e. we didn't extract anything new and conversation hasn't started
    // collecting yet), try the grounded /api/chat responder before falling
    // into slot-filling.
    const gotNewInfo = JSON.stringify(merged) !== JSON.stringify(draft);
    const noSlotsYet = nextMissingSlot(draft) === "whoFor" && !gotNewInfo;

    if (noSlotsYet && /\?|qué|como|kijan|comment|wie|what|how|does|do you/i.test(text)) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, locale }),
        });
        const data = await res.json();
        if (data.emergency) {
          pushAssistant(t("prompts.emergency"));
          return;
        }
        if (data.reply) {
          pushAssistant(data.reply);
          return;
        }
      } catch {
        /* fall through to slot-filling below */
      }
    }

    advance(merged);
  }

  if (!open) return null;

  const settingOptions = tf.raw("options.settings") as string[];
  const yesNoUnsure = tf.raw("options.yesNoUnsure") as string[];
  const contactMethods = tf.raw("options.contactMethod") as string[];
  const contactTimes = tf.raw("options.contactTime") as string[];
  const missingSlot = nextMissingSlot(draft);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t("assistantName")} — ${t("assistantSubtitle")}`}
      className="fixed inset-x-3 bottom-[92px] z-50 flex h-[min(640px,75vh)] flex-col overflow-hidden rounded-xl3 border border-ink-100 bg-white shadow-soft sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[380px]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-brand-navy px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <Logo variant="white" className="text-white" />
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-sm font-semibold">{t("assistantName")}</span>
          <span className="text-[11px] text-white/70">{t("disclosure")}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug",
              m.role === "assistant"
                ? "bg-ink-100 text-ink-900"
                : "ml-auto bg-brand-blue text-white"
            )}
          >
            {m.text}
          </div>
        ))}

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(t.raw("quickActions") as Record<string, string>).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleSend(label)}
                className="rounded-full border border-brand-blue/30 bg-brand-blue-light px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {!submitted && missingSlot === "setting" && (
          <ChoiceRow options={settingOptions} onPick={(v) => advance({ ...draft, setting: v })} />
        )}
        {!submitted && missingSlot === "insurance" && (
          <ChoiceRow options={insuranceSelectOptions} onPick={(v) => advance({ ...draft, insurance: v })} wrap />
        )}
        {!submitted && missingSlot === "previousAba" && (
          <ChoiceRow options={yesNoUnsure} onPick={(v) => advance({ ...draft, previousAba: v })} />
        )}
        {!submitted && missingSlot === "documents" && (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium hover:bg-ink-100"
              onClick={() => advance({ ...draft, hasReferral: "Skip" })}
            >
              {tf("common.skip")}
            </button>
          </div>
        )}
        {!submitted && missingSlot === "contactMethod" && (
          <ChoiceRow options={contactMethods} onPick={(v) => advance({ ...draft, contactMethod: v })} />
        )}
        {!submitted && missingSlot === "contactTime" && (
          <ChoiceRow options={contactTimes} onPick={(v) => advance({ ...draft, contactTime: v })} wrap />
        )}
        {!submitted && pendingConsent && (
          <div className="space-y-2 rounded-xl2 border border-ink-100 bg-ink-100/50 p-3">
            <label className="flex items-start gap-2 text-xs text-ink-700">
              <input
                type="checkbox"
                onChange={(e) => handleConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300"
              />
              <span>{tf("consent.text")}</span>
            </label>
          </div>
        )}

        {sending && <p className="text-xs text-ink-500">{tf("common.loading") || "…"}</p>}
      </div>

      {!submitted && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 border-t border-ink-100 p-3"
        >
          <label htmlFor="milo-input" className="sr-only">
            Message
          </label>
          <input
            id="milo-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-full border border-ink-100 px-4 py-2.5 text-sm outline-none focus-visible:border-brand-blue"
            placeholder="…"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white disabled:opacity-50"
            disabled={sending}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 9h13M9 3l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      )}

      {submitted && (
        <div className="border-t border-ink-100 p-3 text-center">
          <a href={telHref(company.phone.e164)} className="text-sm font-semibold text-brand-blue">
            {company.phone.display}
          </a>
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  options,
  onPick,
  wrap,
}: {
  options: string[];
  onPick: (value: string) => void;
  wrap?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div className={cn("flex gap-2", wrap ? "flex-wrap" : "flex-wrap")}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onPick(opt)}
          className="rounded-full border border-ink-100 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:border-brand-blue hover:text-brand-blue"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
