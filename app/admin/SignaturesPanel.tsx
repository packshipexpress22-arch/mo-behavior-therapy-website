"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import PdfFieldEditor, { type PositionedField } from "./PdfFieldEditor";

type TemplateFieldType = "text" | "textarea" | "date" | "checkbox";

type TemplateBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "paragraph"; id: string; text: string }
  | { type: "field"; id: string; fieldType: TemplateFieldType; label: string; required: boolean; helpText?: string };

type TemplateKind = "blocks" | "pdf";

type SignatureTemplate = {
  id: string;
  title: string;
  description: string;
  documentType: string;
  kind: TemplateKind;
  blocks: TemplateBlock[];
  sourcePdfKey: string | null;
  sourcePdfFileName: string | null;
  pageCount: number | null;
  fields: PositionedField[];
  signatureLabel: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type EnvelopeStatus = "sent" | "completed" | "voided";

type SignatureEnvelope = {
  patientId: string;
  envelopeId: string;
  templateId: string;
  templateSnapshot: { title: string };
  clientName: string;
  clientEmail: string;
  status: EnvelopeStatus;
  sentAt: string;
  completedAt: string | null;
  pdfS3Key: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function newLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_STYLE: Record<EnvelopeStatus, string> = {
  sent: "bg-brand-gold/20 text-ink-900",
  completed: "bg-brand-green-light text-brand-green",
  voided: "bg-ink-100 text-ink-500",
};

function emptyTemplateDraft(): Omit<SignatureTemplate, "id" | "active" | "createdAt" | "updatedAt"> {
  return {
    title: "",
    description: "",
    documentType: "Custom",
    kind: "blocks",
    blocks: [],
    sourcePdfKey: null,
    sourcePdfFileName: null,
    pageCount: null,
    fields: [],
    signatureLabel: "Signature",
  };
}

export default function SignaturesPanel() {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"templates" | "sent">("templates");

  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [envelopes, setEnvelopes] = useState<SignatureEnvelope[]>([]);
  const [envelopesLoading, setEnvelopesLoading] = useState(false);
  const [envelopesLoaded, setEnvelopesLoaded] = useState(false);
  const [envelopesError, setEnvelopesError] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<SignatureTemplate | null>(null);
  const [draft, setDraft] = useState(emptyTemplateDraft());
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Phase 2: the source PDF's view URL is ephemeral (re-minted on each
  // load, never persisted — see lib/phiStorage.ts's createViewUrl), so it
  // lives in its own piece of state rather than on `draft`.
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendClientName, setSendClientName] = useState("");
  const [sendClientEmail, setSendClientEmail] = useState("");
  const [sendLanguage, setSendLanguage] = useState("en");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await fetch("/api/admin/signature-templates");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.status === 503) {
        setTemplatesError("E-signature templates aren't configured for this stage yet.");
        setTemplates([]);
        return;
      }
      if (!res.ok) {
        setTemplatesError("Couldn't load templates. Please try again.");
        return;
      }
      const data = (await res.json()) as { templates: SignatureTemplate[] };
      setTemplates(data.templates);
    } catch {
      setTemplatesError("Couldn't load templates. Please check your connection and try again.");
    } finally {
      setTemplatesLoading(false);
      setTemplatesLoaded(true);
    }
  }, [router]);

  const fetchEnvelopes = useCallback(async () => {
    setEnvelopesLoading(true);
    setEnvelopesError(null);
    try {
      const res = await fetch("/api/admin/signature-envelopes");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.status === 503) {
        setEnvelopesError("E-signature requests aren't configured for this stage yet.");
        setEnvelopes([]);
        return;
      }
      if (!res.ok) {
        setEnvelopesError("Couldn't load sent documents. Please try again.");
        return;
      }
      const data = (await res.json()) as { envelopes: SignatureEnvelope[] };
      setEnvelopes(data.envelopes);
    } catch {
      setEnvelopesError("Couldn't load sent documents. Please check your connection and try again.");
    } finally {
      setEnvelopesLoading(false);
      setEnvelopesLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    if (!templatesLoaded) void fetchTemplates();
  }, [templatesLoaded, fetchTemplates]);

  useEffect(() => {
    if (subTab === "sent" && !envelopesLoaded) void fetchEnvelopes();
  }, [subTab, envelopesLoaded, fetchEnvelopes]);

  function openNewTemplate() {
    setEditingTemplate(null);
    setDraft(emptyTemplateDraft());
    setPdfViewUrl(null);
    setUploadError(null);
    setShowEditor(true);
  }

  async function openEditTemplate(t: SignatureTemplate) {
    setEditingTemplate(t);
    setDraft({
      title: t.title,
      description: t.description,
      documentType: t.documentType,
      kind: t.kind,
      blocks: t.blocks,
      sourcePdfKey: t.sourcePdfKey,
      sourcePdfFileName: t.sourcePdfFileName,
      pageCount: t.pageCount,
      fields: t.fields,
      signatureLabel: t.signatureLabel,
    });
    setUploadError(null);
    setPdfViewUrl(null);
    setShowEditor(true);

    // Phase 2: a "pdf"-kind template's view URL isn't on the list response
    // (see GET /api/admin/signature-templates) — fetch a fresh one from the
    // single-template route so the field editor can render the source PDF.
    if (t.kind === "pdf" && t.sourcePdfKey) {
      try {
        const res = await fetch(`/api/admin/signature-templates/${t.id}`);
        if (res.ok) {
          const data = (await res.json()) as { viewUrl: string | null };
          setPdfViewUrl(data.viewUrl);
        }
      } catch {
        setUploadError("No se pudo cargar el PDF original. Intenta de nuevo.");
      }
    }
  }

  async function handleUploadPdf(file: File) {
    setUploadingPdf(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/signature-templates/upload-pdf", { method: "POST", body: form });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        setUploadError("No se pudo subir el PDF. Verifica que sea un PDF válido de menos de 15 MB.");
        return;
      }
      const data = (await res.json()) as {
        sourcePdfKey: string;
        sourcePdfFileName: string;
        pageCount: number;
        viewUrl: string;
      };
      setDraft((d) => ({
        ...d,
        sourcePdfKey: data.sourcePdfKey,
        sourcePdfFileName: data.sourcePdfFileName,
        pageCount: data.pageCount,
        fields: [],
      }));
      setPdfViewUrl(data.viewUrl);
    } catch {
      setUploadError("No se pudo subir el PDF. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setUploadingPdf(false);
    }
  }

  function addBlock(type: TemplateBlock["type"]) {
    const base = { id: newLocalId() };
    const block: TemplateBlock =
      type === "heading"
        ? { ...base, type: "heading", text: "" }
        : type === "paragraph"
          ? { ...base, type: "paragraph", text: "" }
          : { ...base, type: "field", fieldType: "text", label: "", required: false };
    setDraft((d) => ({ ...d, blocks: [...d.blocks, block] }));
  }

  function updateBlock(id: string, patch: Partial<TemplateBlock>) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as TemplateBlock) : b)),
    }));
  }

  function removeBlock(id: string) {
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(newIdx, 0, item!);
      return { ...d, blocks };
    });
  }

  async function saveTemplate() {
    if (!draft.title.trim()) return;
    setSavingTemplate(true);
    try {
      const res = editingTemplate
        ? await fetch(`/api/admin/signature-templates/${editingTemplate.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(draft),
          })
        : await fetch("/api/admin/signature-templates", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(draft),
          });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) return;
      setShowEditor(false);
      await fetchTemplates();
    } finally {
      setSavingTemplate(false);
    }
  }

  async function toggleActive(t: SignatureTemplate) {
    setActionBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/signature-templates/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) await fetchTemplates();
    } finally {
      setActionBusyId(null);
    }
  }

  async function deleteTemplateConfirmed(t: SignatureTemplate) {
    setActionBusyId(t.id);
    try {
      const res = await fetch(`/api/admin/signature-templates/${t.id}`, { method: "DELETE" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.ok) await fetchTemplates();
    } finally {
      setActionBusyId(null);
    }
  }

  function openSendModal(templateId?: string) {
    setSendTemplateId(templateId || templates.find((t) => t.active)?.id || "");
    setSendClientName("");
    setSendClientEmail("");
    setSendLanguage("en");
    setSendError(null);
    setShowSendModal(true);
  }

  async function sendEnvelope() {
    if (!sendTemplateId || !sendClientName.trim() || !sendClientEmail.trim()) {
      setSendError("Please fill in the template, client name, and client email.");
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/admin/signature-envelopes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: sendTemplateId,
          clientName: sendClientName.trim(),
          clientEmail: sendClientEmail.trim(),
          language: sendLanguage,
        }),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        setSendError("Couldn't send this document. Please try again.");
        return;
      }
      setShowSendModal(false);
      setSubTab("sent");
      await fetchEnvelopes();
    } finally {
      setSending(false);
    }
  }

  async function resendEnvelope(e: SignatureEnvelope) {
    setActionBusyId(e.envelopeId);
    try {
      const res = await fetch(`/api/admin/signature-envelopes/${e.envelopeId}/resend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: e.patientId }),
      });
      if (res.status === 401) {
        router.push("/admin/login");
      }
    } finally {
      setActionBusyId(null);
    }
  }

  async function downloadSignedPdf(e: SignatureEnvelope) {
    setActionBusyId(e.envelopeId);
    try {
      const res = await fetch(
        `/api/admin/signature-envelopes/${e.envelopeId}/download?patientId=${encodeURIComponent(e.patientId)}`
      );
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-ink-100 p-1 text-xs font-medium">
          <button
            onClick={() => setSubTab("templates")}
            className={cn("rounded-full px-3 py-1.5", subTab === "templates" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
          >
            Templates
          </button>
          <button
            onClick={() => setSubTab("sent")}
            className={cn("rounded-full px-3 py-1.5", subTab === "sent" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
          >
            Sent for signature
          </button>
        </div>
        <div className="flex gap-2">
          {subTab === "templates" ? (
            <button
              onClick={openNewTemplate}
              className="rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white"
            >
              New template
            </button>
          ) : (
            <button
              onClick={() => openSendModal()}
              disabled={templates.filter((t) => t.active).length === 0}
              className="rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Send for signature
            </button>
          )}
        </div>
      </div>

      {subTab === "templates" && (
        <div>
          {templatesError && (
            <div className="mb-4 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
              {templatesError}
            </div>
          )}
          {templatesLoading && !templatesError && <p className="text-sm text-ink-500">Loading…</p>}
          {!templatesLoading && !templatesError && templates.length === 0 && (
            <p className="text-sm text-ink-500">No templates yet. Create one to start sending documents for signature.</p>
          )}
          {!templatesLoading && templates.length > 0 && (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl3 border border-ink-100 bg-white p-4 shadow-card"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{t.title}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          t.active ? "bg-brand-green-light text-brand-green" : "bg-ink-100 text-ink-500"
                        )}
                      >
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500">
                      {t.documentType} ·{" "}
                      {t.kind === "pdf"
                        ? `PDF subido · ${t.fields.length} campo(s)`
                        : `${t.blocks.filter((b) => b.type === "field").length} field(s)`}{" "}
                      · updated {formatDate(t.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openSendModal(t.id)}
                      disabled={!t.active}
                      className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(t)}
                      disabled={actionBusyId === t.id}
                      className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
                    >
                      {t.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteTemplateConfirmed(t)}
                      disabled={actionBusyId === t.id}
                      className="rounded-full border border-brand-coral px-3 py-1.5 text-xs font-medium text-brand-coral hover:bg-brand-coral/10 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "sent" && (
        <div>
          {envelopesError && (
            <div className="mb-4 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
              {envelopesError}
            </div>
          )}
          {envelopesLoading && !envelopesError && <p className="text-sm text-ink-500">Loading…</p>}
          {!envelopesLoading && !envelopesError && envelopes.length === 0 && (
            <p className="text-sm text-ink-500">No documents sent for signature yet.</p>
          )}
          {!envelopesLoading && envelopes.length > 0 && (
            <div className="overflow-hidden rounded-xl3 border border-ink-100 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-100 bg-ink-100/50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sent</th>
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {envelopes.map((e) => (
                    <tr key={e.envelopeId} className="border-b border-ink-100 last:border-0">
                      <td className="px-4 py-3 text-ink-500">{formatDate(e.sentAt)}</td>
                      <td className="px-4 py-3 text-ink-900">{e.templateSnapshot.title}</td>
                      <td className="px-4 py-3 text-ink-700">
                        <div>{e.clientName}</div>
                        <div className="text-xs text-ink-500">{e.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLE[e.status])}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.status === "sent" && (
                          <button
                            onClick={() => resendEnvelope(e)}
                            disabled={actionBusyId === e.envelopeId}
                            className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
                          >
                            Resend
                          </button>
                        )}
                        {e.status === "completed" && e.pdfS3Key && (
                          <button
                            onClick={() => downloadSignedPdf(e)}
                            disabled={actionBusyId === e.envelopeId}
                            className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-60"
                          >
                            Download PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div
            className={cn(
              "max-h-[90vh] w-full overflow-y-auto rounded-xl3 bg-white p-6 shadow-card",
              draft.kind === "pdf" ? "max-w-4xl" : "max-w-2xl"
            )}
          >
            <h2 className="mb-4 text-lg font-semibold text-ink-900">
              {editingTemplate ? "Edit template" : "New template"}
            </h2>

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Title</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Document type (label only)</label>
                <input
                  value={draft.documentType}
                  onChange={(e) => setDraft((d) => ({ ...d, documentType: e.target.value }))}
                  placeholder="e.g. Intake, Assessment"
                  className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
                />
              </div>
            </div>

            {!editingTemplate && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-ink-500">Tipo de plantilla</label>
                <div className="flex gap-1 rounded-full bg-ink-100 p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, kind: "blocks" }))}
                    className={cn("rounded-full px-3 py-1.5", draft.kind === "blocks" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
                  >
                    Escribir contenido
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, kind: "pdf" }))}
                    className={cn("rounded-full px-3 py-1.5", draft.kind === "pdf" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}
                  >
                    Subir PDF existente
                  </button>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-500">Description (shown to the client)</label>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-ink-500">Signature label</label>
              <input
                value={draft.signatureLabel}
                onChange={(e) => setDraft((d) => ({ ...d, signatureLabel: e.target.value }))}
                placeholder="e.g. Parent/Guardian Signature"
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            {draft.kind === "pdf" ? (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-ink-900">Documento y campos</h3>
                {!draft.sourcePdfKey ? (
                  <div className="rounded-xl border border-dashed border-ink-100 p-4 text-center">
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={uploadingPdf}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadPdf(file);
                      }}
                      className="mx-auto text-sm text-ink-700"
                    />
                    <p className="mt-2 text-xs text-ink-500">
                      {uploadingPdf ? "Subiendo…" : "Sube el PDF existente (intake, assessment, etc.) para colocar los campos sobre él."}
                    </p>
                  </div>
                ) : !pdfViewUrl ? (
                  <p className="text-sm text-ink-500">Cargando el PDF…</p>
                ) : (
                  <div>
                    <p className="mb-2 text-xs text-ink-500">
                      {draft.sourcePdfFileName} · {draft.pageCount} página(s)
                    </p>
                    <PdfFieldEditor
                      viewUrl={pdfViewUrl}
                      pageCount={draft.pageCount || 1}
                      fields={draft.fields}
                      onFieldsChange={(fields) => setDraft((d) => ({ ...d, fields }))}
                    />
                  </div>
                )}
                {uploadError && <p className="mt-2 text-sm text-brand-coral">{uploadError}</p>}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-900">Content</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addBlock("heading")}
                      className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
                    >
                      + Heading
                    </button>
                    <button
                      onClick={() => addBlock("paragraph")}
                      className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
                    >
                      + Paragraph
                    </button>
                    <button
                      onClick={() => addBlock("field")}
                      className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
                    >
                      + Fillable field
                    </button>
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  {draft.blocks.length === 0 && (
                    <p className="text-sm text-ink-500">No content yet — add a heading, paragraph, or fillable field above.</p>
                  )}
                  {draft.blocks.map((b, i) => (
                <div key={b.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                      {b.type === "field" ? `Field (${b.fieldType})` : b.type}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveBlock(b.id, -1)}
                        disabled={i === 0}
                        className="rounded px-1.5 text-xs text-ink-500 hover:text-brand-blue disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveBlock(b.id, 1)}
                        disabled={i === draft.blocks.length - 1}
                        className="rounded px-1.5 text-xs text-ink-500 hover:text-brand-blue disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeBlock(b.id)}
                        className="rounded px-1.5 text-xs text-brand-coral hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {(b.type === "heading" || b.type === "paragraph") && (
                    <textarea
                      rows={b.type === "heading" ? 1 : 2}
                      value={b.text}
                      onChange={(e) => updateBlock(b.id, { text: e.target.value } as Partial<TemplateBlock>)}
                      className="w-full rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand-blue"
                    />
                  )}

                  {b.type === "field" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={b.label}
                        placeholder="Field label"
                        onChange={(e) => updateBlock(b.id, { label: e.target.value } as Partial<TemplateBlock>)}
                        className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand-blue"
                      />
                      <select
                        value={b.fieldType}
                        onChange={(e) =>
                          updateBlock(b.id, { fieldType: e.target.value as TemplateFieldType } as Partial<TemplateBlock>)
                        }
                        className="rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand-blue"
                      >
                        <option value="text">Short text</option>
                        <option value="textarea">Long text</option>
                        <option value="date">Date</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-ink-700 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={b.required}
                          onChange={(e) => updateBlock(b.id, { required: e.target.checked } as Partial<TemplateBlock>)}
                          className="h-3.5 w-3.5 rounded border-ink-100"
                        />
                        Required
                      </label>
                    </div>
                  )}
                </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-full border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate || !draft.title.trim() || (draft.kind === "pdf" && !draft.sourcePdfKey)}
                className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingTemplate ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="w-full max-w-md rounded-xl3 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-ink-900">Send document for signature</h2>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-500">Template</label>
              <select
                value={sendTemplateId}
                onChange={(e) => setSendTemplateId(e.target.value)}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              >
                {templates
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-500">Client name</label>
              <input
                value={sendClientName}
                onChange={(e) => setSendClientName(e.target.value)}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-500">Client email</label>
              <input
                type="email"
                value={sendClientEmail}
                onChange={(e) => setSendClientEmail(e.target.value)}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-ink-500">Email language</label>
              <select
                value={sendLanguage}
                onChange={(e) => setSendLanguage(e.target.value)}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="ht">Kreyòl Ayisyen</option>
                <option value="pt">Português</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            {sendError && <p className="mb-3 text-sm text-brand-coral">{sendError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSendModal(false)}
                className="rounded-full border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700"
              >
                Cancel
              </button>
              <button
                onClick={sendEnvelope}
                disabled={sending}
                className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
