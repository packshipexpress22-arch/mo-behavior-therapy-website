import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SignatureEnvelope, SignatureValue } from "./signatureEnvelopes";
import { getObjectBytes } from "./phiStorage";

// Renders a completed signature envelope (template content + the client's
// filled-in field values + their signature + the audit trail) into a
// finished PDF, entirely server-side with pdf-lib (pure JS, no native
// binary/headless-browser dependency — safe to run in the Lambda runtime
// this app already uses for everything else).
//
// Phase 1 (generateSignedPdf, below): the "template" is admin-authored
// structured text/fields (see lib/signatureTemplates.ts), not an uploaded
// PDF being stamped on. This renders a clean new PDF from scratch every
// time, which keeps this function simple and avoids ever needing to
// parse/modify an arbitrary uploaded PDF's layout.
//
// Phase 2 (generateStampedPdf, further below, added 2026-10-08): the
// template is instead an admin-UPLOADED PDF with fields placed visually on
// top of it (app/admin/PdfFieldEditor.tsx) — this loads that original PDF
// and draws the client's values/signature directly onto it at the saved
// positions, rather than generating a new document. generateEnvelopePdf()
// at the bottom picks whichever of the two an envelope's frozen
// templateSnapshot.kind calls for.

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type Cursor = { page: PDFPage; y: number };

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function generateSignedPdf(envelope: SignatureEnvelope): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursor: Cursor = { page, y: PAGE_HEIGHT - MARGIN };

  function ensureSpace(c: Cursor, neededHeight: number): Cursor {
    if (c.y - neededHeight < MARGIN) {
      const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      return { page: newPage, y: PAGE_HEIGHT - MARGIN };
    }
    return c;
  }

  function drawLines(c: Cursor, lines: string[], font: PDFFont, size: number, lineGap: number, color = rgb(0.06, 0.1, 0.16)): Cursor {
    let cur = c;
    for (const line of lines) {
      cur = ensureSpace(cur, size + lineGap);
      cur.page.drawText(line, { x: MARGIN, y: cur.y - size, size, font, color });
      cur = { page: cur.page, y: cur.y - size - lineGap };
    }
    return cur;
  }

  // Title
  cursor = drawLines(cursor, wrapText(envelope.templateSnapshot.title, bold, 18, CONTENT_WIDTH), bold, 18, 8);
  cursor = { page: cursor.page, y: cursor.y - 4 };

  if (envelope.templateSnapshot.description) {
    cursor = drawLines(
      cursor,
      wrapText(envelope.templateSnapshot.description, regular, 11, CONTENT_WIDTH),
      regular,
      11,
      6,
      rgb(0.3, 0.35, 0.42)
    );
    cursor = { page: cursor.page, y: cursor.y - 10 };
  }

  // Client header block
  cursor = ensureSpace(cursor, 40);
  cursor.page.drawText(`Client: ${envelope.clientName}  ·  ${envelope.clientEmail}`, {
    x: MARGIN,
    y: cursor.y - 11,
    size: 10,
    font: regular,
    color: rgb(0.3, 0.35, 0.42),
  });
  cursor = { page: cursor.page, y: cursor.y - 11 - 18 };

  // Body blocks
  for (const block of envelope.templateSnapshot.blocks) {
    if (block.type === "heading") {
      cursor = ensureSpace(cursor, 26);
      cursor = { page: cursor.page, y: cursor.y - 6 };
      cursor = drawLines(cursor, wrapText(block.text, bold, 13, CONTENT_WIDTH), bold, 13, 6);
      continue;
    }
    if (block.type === "paragraph") {
      cursor = drawLines(cursor, wrapText(block.text, regular, 11, CONTENT_WIDTH), regular, 11, 5);
      cursor = { page: cursor.page, y: cursor.y - 4 };
      continue;
    }
    // field
    const value = envelope.fieldValues[block.id];
    const displayValue =
      block.fieldType === "checkbox"
        ? value === "true"
          ? "☑ Yes"
          : "☐ No"
        : value && value.trim()
          ? value
          : "—";
    cursor = ensureSpace(cursor, 34);
    cursor.page.drawText(block.label, { x: MARGIN, y: cursor.y - 10, size: 10, font: bold, color: rgb(0.3, 0.35, 0.42) });
    cursor = { page: cursor.page, y: cursor.y - 10 - 4 };
    cursor = drawLines(cursor, wrapText(displayValue, regular, 12, CONTENT_WIDTH), regular, 12, 4);
    cursor = { page: cursor.page, y: cursor.y - 8 };
  }

  // Signature block
  cursor = ensureSpace(cursor, 140);
  cursor = { page: cursor.page, y: cursor.y - 10 };
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y },
    thickness: 0.75,
    color: rgb(0.85, 0.87, 0.9),
  });
  cursor = { page: cursor.page, y: cursor.y - 18 };

  cursor.page.drawText(envelope.templateSnapshot.signatureLabel || "Signature", {
    x: MARGIN,
    y: cursor.y,
    size: 11,
    font: bold,
    color: rgb(0.06, 0.1, 0.16),
  });
  cursor = { page: cursor.page, y: cursor.y - 20 };

  if (envelope.signature?.type === "drawn") {
    try {
      const base64 = envelope.signature.dataUrl.split(",")[1] || "";
      const bytes = Buffer.from(base64, "base64");
      const image = await doc.embedPng(bytes);
      const maxW = 220;
      const maxH = 70;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      cursor = ensureSpace(cursor, h + 10);
      cursor.page.drawImage(image, { x: MARGIN, y: cursor.y - h, width: w, height: h });
      cursor = { page: cursor.page, y: cursor.y - h - 6 };
    } catch {
      // If the drawn signature image can't be decoded/embedded for any
      // reason, fall back to a plain note rather than failing the whole
      // PDF — the signature's audit fields (IP/timestamp/consent) below
      // still prove the action happened.
      cursor = drawLines(cursor, ["[signature image could not be rendered]"], italic, 11, 4);
    }
  } else if (envelope.signature?.type === "typed") {
    cursor = ensureSpace(cursor, 34);
    cursor.page.drawText(envelope.signature.typedName, {
      x: MARGIN,
      y: cursor.y - 22,
      size: 22,
      font: italic,
      color: rgb(0.06, 0.1, 0.16),
    });
    cursor = { page: cursor.page, y: cursor.y - 22 - 8 };
  }

  // Audit footer
  cursor = ensureSpace(cursor, 60);
  cursor = { page: cursor.page, y: cursor.y - 8 };
  const signedAt = envelope.consentTimestamp ? new Date(envelope.consentTimestamp) : new Date();
  const auditLines = [
    `Signed electronically on ${signedAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.`,
    `IP address: ${envelope.consentIp || "unknown"}`,
    `Envelope ID: ${envelope.envelopeId}`,
  ];
  cursor = drawLines(cursor, auditLines, regular, 8.5, 3, rgb(0.5, 0.54, 0.6));

  const bytes = await doc.save();
  return bytes;
}

// ---------------------------------------------------------------------------
// Phase 2: stamping values onto an admin-uploaded source PDF
// ---------------------------------------------------------------------------

async function embedSignatureImage(doc: PDFDocument, dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const bytes = Buffer.from(base64, "base64");
  return doc.embedPng(bytes);
}

/** Draws a signature (drawn image or typed name) centered inside a box
 * given in PDF point coordinates (bottom-left origin). Shared by
 * generateStampedPdf below; Phase 1's generateSignedPdf keeps its own
 * inline version above since it lays its signature out along a cursor
 * rather than inside a fixed box, and is already validated/shipped. */
async function drawSignatureInBox(
  doc: PDFDocument,
  page: PDFPage,
  signature: SignatureValue | null,
  x: number,
  y: number,
  w: number,
  h: number,
  italic: PDFFont
): Promise<void> {
  if (!signature) return;
  if (signature.type === "drawn") {
    try {
      const image = await embedSignatureImage(doc, signature.dataUrl);
      const scale = Math.min(w / image.width, h / image.height, 1);
      const iw = image.width * scale;
      const ih = image.height * scale;
      page.drawImage(image, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
    } catch {
      // Same safe fallback as Phase 1 — the audit trail in DynamoDB still
      // proves the signature happened even if the image can't be embedded.
      page.drawText("[signature]", {
        x: x + 2,
        y: y + Math.max(h / 2 - 5, 2),
        size: Math.min(h, 10),
        font: italic,
        color: rgb(0.06, 0.1, 0.16),
      });
    }
  } else {
    const size = Math.max(Math.min(h * 0.6, 16), 8);
    page.drawText(signature.typedName, {
      x: x + 2,
      y: y + Math.max((h - size) / 2, 2),
      size,
      font: italic,
      color: rgb(0.06, 0.1, 0.16),
    });
  }
}

/** Truncates text with an ellipsis so it fits within maxWidth at the given
 * size/font — a fixed field box (unlike Phase 1's free-flowing page) can't
 * grow to fit arbitrarily long input, so this is a deliberate simplification
 * rather than Phase 1's multi-line wrapText. */
function fitTextToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * Renders a completed "pdf"-kind envelope by loading its frozen
 * templateSnapshot.sourcePdfKey from S3 and drawing the client's field
 * values + signature directly onto it at the saved positions, plus a small
 * audit footer on every page (same information Phase 1 puts in its own
 * footer: envelope id, signed-at timestamp, IP).
 *
 * Position math: PositionedField stores xPct/yPct/widthPct/heightPct as
 * fractions of the page measured from its TOP-LEFT (matching the on-screen
 * overlays in app/admin/PdfFieldEditor.tsx and
 * app/sign/[envelopeId]/SignatureSigningClient.tsx), while pdf-lib draws
 * from the page's BOTTOM-LEFT — so the box's bottom-left corner in PDF
 * points is (xPct * pageWidth, pageHeight - (yPct + heightPct) * pageHeight).
 */
export async function generateStampedPdf(envelope: SignatureEnvelope): Promise<Uint8Array> {
  const snapshot = envelope.templateSnapshot;
  if (!snapshot.sourcePdfKey) {
    throw new Error(`generateStampedPdf: envelope ${envelope.envelopeId} has no sourcePdfKey`);
  }

  const sourceBytes = await getObjectBytes(snapshot.sourcePdfKey);
  const doc = await PDFDocument.load(sourceBytes);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const pageCount = doc.getPageCount();

  for (const field of snapshot.fields) {
    const pageIndex = Math.min(Math.max(field.page, 0), pageCount - 1);
    const page = doc.getPage(pageIndex);
    const { width: pw, height: ph } = page.getSize();
    const boxX = field.xPct * pw;
    const boxW = field.widthPct * pw;
    const boxH = field.heightPct * ph;
    const boxBottomY = ph - (field.yPct + field.heightPct) * ph;

    if (field.type === "signature") {
      await drawSignatureInBox(doc, page, envelope.signature, boxX, boxBottomY, boxW, boxH, italic);
      continue;
    }

    const value = envelope.fieldValues[field.id];
    if (field.type === "checkbox") {
      if (value === "true") {
        const size = Math.min(boxH * 0.8, 14);
        page.drawText("X", {
          x: boxX + Math.max((boxW - size) / 2, 1),
          y: boxBottomY + Math.max((boxH - size) / 2, 1),
          size,
          font: regular,
          color: rgb(0.06, 0.1, 0.16),
        });
      }
      continue;
    }

    // text / date
    const display = value && value.trim() ? value.trim() : "";
    if (!display) continue;
    const size = Math.min(Math.max(boxH * 0.6, 8), 12);
    const fitted = fitTextToWidth(display, regular, size, Math.max(boxW - 4, 4));
    page.drawText(fitted, {
      x: boxX + 2,
      y: boxBottomY + Math.max((boxH - size) / 2, 2),
      size,
      font: regular,
      color: rgb(0.06, 0.1, 0.16),
    });
  }

  const signedAt = envelope.consentTimestamp ? new Date(envelope.consentTimestamp) : new Date();
  const footer = `Signed electronically · Envelope ${envelope.envelopeId} · ${signedAt.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} · IP ${envelope.consentIp || "unknown"}`;
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    page.drawText(footer, { x: 24, y: 10, size: 6.5, font: italic, color: rgb(0.55, 0.58, 0.63) });
  }

  return doc.save();
}

/** Picks Phase 1 (generateSignedPdf) or Phase 2 (generateStampedPdf) based
 * on the envelope's frozen templateSnapshot.kind — the one place callers
 * (app/api/sign/[envelopeId]/submit/route.ts) need to know about, so they
 * stay kind-agnostic. */
export async function generateEnvelopePdf(envelope: SignatureEnvelope): Promise<Uint8Array> {
  return envelope.templateSnapshot.kind === "pdf"
    ? generateStampedPdf(envelope)
    : generateSignedPdf(envelope);
}
