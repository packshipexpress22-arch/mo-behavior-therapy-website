"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type TemplateFieldType = "text" | "textarea" | "date" | "checkbox";

type TemplateBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "paragraph"; id: string; text: string }
  | {
      type: "field";
      id: string;
      fieldType: TemplateFieldType;
      label: string;
      required: boolean;
      helpText?: string;
    };

type TemplateKind = "blocks" | "pdf";

type PositionedFieldType = "text" | "date" | "checkbox" | "signature";

type PositionedField = {
  id: string;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  type: PositionedFieldType;
  label: string;
  required: boolean;
};

type TemplateSnapshot = {
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
};

type EnvelopeResponse = {
  envelopeId: string;
  status: "sent" | "completed" | "voided";
  clientName: string;
  clientEmail: string;
  template: TemplateSnapshot;
  viewUrl: string | null;
  fieldValues: Record<string, string>;
  completedAt: string | null;
};

/** Phase 2: renders the frozen source PDF (via pdf.js, client-side only)
 * one page at a time with the template's fillable fields overlaid at their
 * saved positions — the same percentage-based technique as the admin's
 * app/admin/PdfFieldEditor.tsx, just read/fill instead of place/resize.
 * Signature-type fields are shown only as a marker on the page — the
 * actual signing UI (reusing SignaturePad below) stays its own
 * comfortably-sized card rather than being crammed into however small a
 * box the admin drew. */
function PdfFillViewer({
  viewUrl,
  pageCount,
  fields,
  fieldValues,
  onFieldChange,
}: {
  viewUrl: string;
  pageCount: number;
  fields: PositionedField[];
  fieldValues: Record<string, string>;
  onFieldChange: (id: string, value: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const renderPage = useCallback(async (pageIndex: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    try {
      const pdfPage = await doc.getPage(pageIndex + 1);
      const containerWidth = containerRef.current?.clientWidth || 700;
      const nativeViewport = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / nativeViewport.width, 1.4);
      const viewport = pdfPage.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      setRenderError(null);
    } catch {
      setRenderError("No se pudo mostrar esta página.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const doc = await pdfjsLib.getDocument(viewUrl).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        await renderPage(0);
      } catch {
        if (!cancelled) setRenderError("No se pudo cargar el documento.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewUrl, renderPage]);

  useEffect(() => {
    void renderPage(page);
  }, [page, renderPage]);

  const fieldsOnPage = fields.filter((f) => f.page === page);

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-center gap-3 text-xs text-ink-500">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(p - 1, 0))}
          disabled={page === 0}
          className="rounded-full border border-ink-100 px-2 py-1 disabled:opacity-30"
        >
          ←
        </button>
        Página {page + 1} de {pageCount}
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
          disabled={page === pageCount - 1}
          className="rounded-full border border-ink-100 px-2 py-1 disabled:opacity-30"
        >
          →
        </button>
      </div>

      {renderError && <p className="mb-2 text-center text-sm text-brand-coral">{renderError}</p>}

      <div
        ref={containerRef}
        className="relative mx-auto overflow-hidden rounded-xl3 border border-ink-100 bg-white shadow-card"
        style={canvasSize ? { width: canvasSize.width, height: canvasSize.height } : undefined}
      >
        <canvas ref={canvasRef} className="block" />
        {fieldsOnPage.map((f) => {
          const boxStyle = {
            left: `${f.xPct * 100}%`,
            top: `${f.yPct * 100}%`,
            width: `${f.widthPct * 100}%`,
            height: `${f.heightPct * 100}%`,
          };
          if (f.type === "signature") {
            return (
              <div
                key={f.id}
                className="absolute flex items-center justify-center rounded border-2 border-dashed border-brand-blue/50 bg-brand-blue/5 px-1 text-center text-[9px] font-medium text-brand-blue"
                style={boxStyle}
              >
                {f.label || "Firma abajo ↓"}
              </div>
            );
          }
          if (f.type === "checkbox") {
            return (
              <label
                key={f.id}
                className="absolute flex items-center justify-center rounded border border-brand-blue/50 bg-white/80"
                style={boxStyle}
                title={f.label}
              >
                <input
                  type="checkbox"
                  checked={fieldValues[f.id] === "true"}
                  onChange={(e) => onFieldChange(f.id, e.target.checked ? "true" : "false")}
                  className="h-full w-full cursor-pointer"
                />
              </label>
            );
          }
          return (
            <input
              key={f.id}
              type={f.type === "date" ? "date" : "text"}
              value={fieldValues[f.id] || ""}
              onChange={(e) => onFieldChange(f.id, e.target.value)}
              placeholder={f.label}
              title={f.label}
              className="absolute rounded border border-brand-blue/50 bg-white/90 px-1 text-xs outline-none focus-visible:border-brand-blue"
              style={boxStyle}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Minimal pointer-driven signature pad — mouse and touch both fire
 * pointer events in evergreen browsers, so one handler set covers both
 * without a separate library. Draws on a fixed-resolution canvas and
 * exports a PNG data URL on submit. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  function getPos(e: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F1B2B";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInkRef.current = true;
  }

  function finishStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInkRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="w-full touch-none rounded-xl border border-ink-100 bg-white"
        style={{ height: 150 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs font-medium text-ink-500 hover:text-brand-blue hover:underline"
      >
        Clear signature
      </button>
    </div>
  );
}

export default function SignatureSigningClient({ envelopeId, token }: { envelopeId: string; token: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<EnvelopeResponse | null>(null);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/sign/${envelopeId}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setLoadError(
          res.status === 401 ? "This link is invalid or has expired." : "Couldn't load this document. Please try again."
        );
        return;
      }
      const data = (await res.json()) as EnvelopeResponse;
      setEnvelope(data);
      if (data.status === "completed") setSubmitted(true);
    } catch {
      setLoadError("Couldn't load this document. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [envelopeId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(id: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    if (!envelope) return;
    setSubmitError(null);

    const missing =
      envelope.template.kind === "pdf"
        ? envelope.template.fields.find(
            (f) =>
              f.type !== "signature" &&
              f.required &&
              (f.type === "checkbox" ? fieldValues[f.id] !== "true" : !fieldValues[f.id]?.trim())
          )
        : envelope.template.blocks.find(
            (b) =>
              b.type === "field" &&
              b.required &&
              (b.fieldType === "checkbox" ? fieldValues[b.id] !== "true" : !fieldValues[b.id]?.trim())
          );
    if (missing) {
      setSubmitError("Please complete all required fields before submitting.");
      return;
    }

    const signature =
      signatureMode === "draw"
        ? drawnDataUrl
          ? { type: "drawn" as const, dataUrl: drawnDataUrl }
          : null
        : typedName.trim()
          ? { type: "typed" as const, typedName: typedName.trim() }
          : null;

    if (!signature) {
      setSubmitError(
        signatureMode === "draw" ? "Please draw your signature above." : "Please type your full name as your signature."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${envelopeId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, fieldValues, signature }),
      });
      if (!res.ok) {
        setSubmitError("Something went wrong submitting your signature. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your signature. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <p className="text-sm text-ink-500">Loading…</p>
      </main>
    );
  }

  if (loadError || !envelope) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <div className="rounded-xl3 border border-brand-coral/30 bg-brand-coral/10 p-6 text-center">
          <p className="text-sm text-brand-coral">{loadError || "This document could not be found."}</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <div className="rounded-xl3 border border-ink-100 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-light text-2xl text-brand-green">
            ✓
          </div>
          <h1 className="mb-2 text-lg font-semibold text-ink-900">Document signed</h1>
          <p className="text-sm text-ink-500">
            Thank you — "{envelope.template.title}" has been completed and securely saved. You don't need to do
            anything else.
          </p>
        </div>
      </main>
    );
  }

  const isPdfTemplate = envelope.template.kind === "pdf";

  return (
    <main className={isPdfTemplate ? "mx-auto max-w-3xl px-4 py-10" : "mx-auto max-w-2xl px-4 py-10"}>
      <div className="mb-6 rounded-xl3 border border-ink-100 bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold text-ink-900">{envelope.template.title}</h1>
        {envelope.template.description && (
          <p className="mt-2 text-sm text-ink-500">{envelope.template.description}</p>
        )}
        <p className="mt-3 text-xs text-ink-500">
          For {envelope.clientName} · {envelope.clientEmail}
        </p>
      </div>

      <div className="space-y-5">
        {isPdfTemplate && envelope.viewUrl && (
          <PdfFillViewer
            viewUrl={envelope.viewUrl}
            pageCount={envelope.template.pageCount || 1}
            fields={envelope.template.fields}
            fieldValues={fieldValues}
            onFieldChange={setField}
          />
        )}
        {isPdfTemplate && !envelope.viewUrl && (
          <p className="text-sm text-brand-coral">No se pudo cargar el documento. Por favor intenta de nuevo más tarde.</p>
        )}

        {!isPdfTemplate &&
          envelope.template.blocks.map((block) => {
          if (block.type === "heading") {
            return (
              <h2 key={block.id} className="pt-2 text-base font-semibold text-ink-900">
                {block.text}
              </h2>
            );
          }
          if (block.type === "paragraph") {
            return (
              <p key={block.id} className="whitespace-pre-wrap text-sm text-ink-700">
                {block.text}
              </p>
            );
          }

          // field
          return (
            <div key={block.id} className="rounded-xl3 border border-ink-100 bg-white p-4 shadow-card">
              <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor={`field-${block.id}`}>
                {block.label}
                {block.required && <span className="text-brand-coral"> *</span>}
              </label>
              {block.helpText && <p className="mb-2 text-xs text-ink-500">{block.helpText}</p>}

              {block.fieldType === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    id={`field-${block.id}`}
                    type="checkbox"
                    checked={fieldValues[block.id] === "true"}
                    onChange={(e) => setField(block.id, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-ink-100"
                  />
                  Yes
                </label>
              ) : block.fieldType === "textarea" ? (
                <textarea
                  id={`field-${block.id}`}
                  rows={3}
                  value={fieldValues[block.id] || ""}
                  onChange={(e) => setField(block.id, e.target.value)}
                  className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue"
                />
              ) : (
                <input
                  id={`field-${block.id}`}
                  type={block.fieldType === "date" ? "date" : "text"}
                  value={fieldValues[block.id] || ""}
                  onChange={(e) => setField(block.id, e.target.value)}
                  className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue"
                />
              )}
            </div>
          );
        })}

        <div className="rounded-xl3 border border-ink-100 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-ink-900">{envelope.template.signatureLabel}</label>
            <div className="flex gap-1 rounded-full bg-ink-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSignatureMode("draw")}
                className={
                  signatureMode === "draw"
                    ? "rounded-full bg-white px-3 py-1 text-ink-900 shadow-sm"
                    : "rounded-full px-3 py-1 text-ink-500"
                }
              >
                Draw
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode("type")}
                className={
                  signatureMode === "type"
                    ? "rounded-full bg-white px-3 py-1 text-ink-900 shadow-sm"
                    : "rounded-full px-3 py-1 text-ink-500"
                }
              >
                Type
              </button>
            </div>
          </div>

          {signatureMode === "draw" ? (
            <SignaturePad onChange={setDrawnDataUrl} />
          ) : (
            <input
              type="text"
              placeholder="Type your full name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              className="w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm italic outline-none focus-visible:border-brand-blue"
            />
          )}
          <p className="mt-3 text-xs text-ink-500">
            By signing, you confirm that you have reviewed this document and agree to its contents. Your signature,
            the date/time, and your IP address are recorded as part of this document's audit trail.
          </p>
        </div>

        {submitError && (
          <div className="rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-brand-blue px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit signed document"}
        </button>
      </div>
    </main>
  );
}
