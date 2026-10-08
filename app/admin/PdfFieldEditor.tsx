"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

// Phase 2's visual field-placement tool: renders the admin's uploaded PDF
// (via pdf.js, client-side only — dynamically imported below so it never
// enters the server bundle) one page at a time on a canvas, with an
// absolutely-positioned overlay of draggable/resizable boxes for each
// fillable/signature field. Positions are stored as percentages of the
// page (see PositionedField in lib/signatureTemplates.ts), which is why
// the overlay's CSS size always exactly matches the canvas's rendered
// size — percentage positioning then "just works" at any zoom/page size
// without extra coordinate math here.

export type PositionedFieldType = "text" | "date" | "checkbox" | "signature";

export type PositionedField = {
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

function newFieldId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const FIELD_TYPE_LABEL: Record<PositionedFieldType, string> = {
  text: "Texto",
  date: "Fecha",
  checkbox: "Casilla",
  signature: "Firma",
};

const DEFAULT_SIZE: Record<PositionedFieldType, { widthPct: number; heightPct: number }> = {
  text: { widthPct: 0.28, heightPct: 0.035 },
  date: { widthPct: 0.18, heightPct: 0.035 },
  checkbox: { widthPct: 0.035, heightPct: 0.035 },
  signature: { widthPct: 0.3, heightPct: 0.07 },
};

const MIN_PCT = 0.02;

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  orig: PositionedField;
};

export default function PdfFieldEditor({
  viewUrl,
  pageCount,
  fields,
  onFieldsChange,
}: {
  viewUrl: string;
  pageCount: number;
  fields: PositionedField[];
  onFieldsChange: (fields: PositionedField[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const renderPage = useCallback(async (pageIndex: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    try {
      const pdfPage = await doc.getPage(pageIndex + 1); // pdf.js pages are 1-indexed
      const containerWidth = containerRef.current?.clientWidth || 800;
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

  // Load pdf.js once, client-side only — never imported on the server.
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
        if (!cancelled) setRenderError("No se pudo cargar el PDF. Intenta subirlo de nuevo.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewUrl, renderPage]);

  useEffect(() => {
    void renderPage(page);
  }, [page, renderPage]);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 0), pageCount - 1));
  }

  function addField(type: PositionedFieldType) {
    const size = DEFAULT_SIZE[type];
    const field: PositionedField = {
      id: newFieldId(),
      page,
      xPct: 0.1,
      yPct: 0.1,
      widthPct: size.widthPct,
      heightPct: size.heightPct,
      type,
      label: FIELD_TYPE_LABEL[type],
      required: type === "text" || type === "date",
    };
    onFieldsChange([...fields, field]);
    setSelectedId(field.id);
  }

  function updateField(id: string, patch: Partial<PositionedField>) {
    onFieldsChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onFieldsChange(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleBoxPointerDown(e: ReactPointerEvent<HTMLDivElement>, field: PositionedField, mode: "move" | "resize") {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedId(field.id);
    dragRef.current = { id: field.id, mode, startX: e.clientX, startY: e.clientY, orig: field };
  }

  function handleBoxPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const dxPct = (e.clientX - drag.startX) / rect.width;
    const dyPct = (e.clientY - drag.startY) / rect.height;

    if (drag.mode === "move") {
      const xPct = Math.min(Math.max(drag.orig.xPct + dxPct, 0), 1 - drag.orig.widthPct);
      const yPct = Math.min(Math.max(drag.orig.yPct + dyPct, 0), 1 - drag.orig.heightPct);
      updateField(drag.id, { xPct, yPct });
    } else {
      const widthPct = Math.min(Math.max(drag.orig.widthPct + dxPct, MIN_PCT), 1 - drag.orig.xPct);
      const heightPct = Math.min(Math.max(drag.orig.heightPct + dyPct, MIN_PCT), 1 - drag.orig.yPct);
      updateField(drag.id, { widthPct, heightPct });
    }
  }

  function handleBoxPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  const fieldsOnPage = fields.filter((f) => f.page === page);
  const selected = fields.find((f) => f.id === selectedId) || null;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_240px]">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addField("text")}
              className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
            >
              + Texto
            </button>
            <button
              type="button"
              onClick={() => addField("date")}
              className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
            >
              + Fecha
            </button>
            <button
              type="button"
              onClick={() => addField("checkbox")}
              className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
            >
              + Casilla
            </button>
            <button
              type="button"
              onClick={() => addField("signature")}
              className="rounded-full border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
            >
              + Firma
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              className="rounded-full border border-ink-100 px-2 py-1 disabled:opacity-30"
            >
              ←
            </button>
            Página {page + 1} de {pageCount}
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page === pageCount - 1}
              className="rounded-full border border-ink-100 px-2 py-1 disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>

        {renderError && <p className="mb-2 text-sm text-brand-coral">{renderError}</p>}

        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-xl border border-ink-100 bg-ink-100/30"
          style={canvasSize ? { width: canvasSize.width, height: canvasSize.height } : undefined}
        >
          <canvas ref={canvasRef} className="block" />
          {fieldsOnPage.map((f) => (
            <div
              key={f.id}
              onPointerDown={(e) => handleBoxPointerDown(e, f, "move")}
              onPointerMove={handleBoxPointerMove}
              onPointerUp={handleBoxPointerUp}
              className={cn(
                "absolute flex cursor-move items-center overflow-hidden rounded border-2 bg-brand-blue/10",
                f.id === selectedId ? "border-brand-blue" : "border-brand-blue/50"
              )}
              style={{
                left: `${f.xPct * 100}%`,
                top: `${f.yPct * 100}%`,
                width: `${f.widthPct * 100}%`,
                height: `${f.heightPct * 100}%`,
              }}
            >
              <span className="pointer-events-none select-none truncate px-1 text-[10px] font-medium text-brand-blue">
                {f.label || FIELD_TYPE_LABEL[f.type]}
              </span>
              <div
                onPointerDown={(e) => handleBoxPointerDown(e, f, "resize")}
                onPointerMove={handleBoxPointerMove}
                onPointerUp={handleBoxPointerUp}
                className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full bg-brand-blue"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Arrastra un campo para moverlo, o su esquina inferior derecha para cambiar su tamaño.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Campo seleccionado</h4>
          {!selected && (
            <p className="text-xs text-ink-500">Haz clic en un campo para editarlo, o agrega uno nuevo arriba.</p>
          )}
          {selected && (
            <div className="space-y-2 rounded-xl border border-ink-100 p-3">
              <input
                value={selected.label}
                onChange={(e) => updateField(selected.id, { label: e.target.value })}
                placeholder="Etiqueta"
                className="w-full rounded-lg border border-ink-100 px-2 py-1 text-xs outline-none focus-visible:border-brand-blue"
              />
              {selected.type !== "signature" && (
                <label className="flex items-center gap-2 text-xs text-ink-700">
                  <input
                    type="checkbox"
                    checked={selected.required}
                    onChange={(e) => updateField(selected.id, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-ink-100"
                  />
                  Obligatorio
                </label>
              )}
              <p className="text-[11px] text-ink-500">
                Tipo: {FIELD_TYPE_LABEL[selected.type]} · Página {selected.page + 1}
              </p>
              <button
                type="button"
                onClick={() => removeField(selected.id)}
                className="text-xs font-medium text-brand-coral hover:underline"
              >
                Eliminar campo
              </button>
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Todos los campos ({fields.length})
          </h4>
          {fields.length === 0 && <p className="text-xs text-ink-500">Aún no hay campos.</p>}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {fields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedId(f.id);
                  if (f.page !== page) setPage(f.page);
                }}
                className={cn(
                  "block w-full truncate rounded-lg px-2 py-1 text-left text-xs",
                  f.id === selectedId ? "bg-brand-blue/10 text-brand-blue" : "text-ink-700 hover:bg-ink-100"
                )}
              >
                p.{f.page + 1} · {FIELD_TYPE_LABEL[f.type]} · {f.label || "(sin etiqueta)"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
