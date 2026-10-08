import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument } from "pdf-lib";
import { nanoid } from "nanoid";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { signatureSourcePdfKey, uploadGeneratedPdf, createViewUrl, phiStorageConfigured } from "@/lib/phiStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 2, step 1: the admin uploads an existing document (intake form,
// treatment plan, etc.) that they'll place fillable/signature fields onto
// in app/admin/PdfFieldEditor.tsx. This route just stores the PDF and
// reports its page count — the field-placement step and the final
// "Save template" (POST /api/admin/signature-templates) happen afterward.
//
// The upload comes through our own authenticated admin session as a
// multipart form (not a direct-to-S3 presigned PUT like the patient
// portal's untrusted client uploads) — simpler, and appropriate here since
// the uploader is already a logged-in staff member, not an anonymous site
// visitor.

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB — generous for a scanned/typed clinical form, small enough to read fully into Lambda memory

export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!phiStorageConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "missing_file" }, { status: 422 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "not_a_pdf" }, { status: 422 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let pageCount: number;
  try {
    const parsed = await PDFDocument.load(bytes);
    pageCount = parsed.getPageCount();
  } catch {
    return NextResponse.json({ error: "invalid_pdf" }, { status: 422 });
  }
  if (pageCount < 1) {
    return NextResponse.json({ error: "invalid_pdf" }, { status: 422 });
  }

  const uploadId = nanoid(12);
  const fileName = file.name || "document.pdf";
  const sourcePdfKey = signatureSourcePdfKey(uploadId, fileName);
  await uploadGeneratedPdf({ s3Key: sourcePdfKey, bytes });

  const viewUrl = await createViewUrl({ s3Key: sourcePdfKey });

  return NextResponse.json({
    sourcePdfKey,
    sourcePdfFileName: fileName,
    pageCount,
    viewUrl,
  });
}
