import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// PHI file storage — S3 only, accessed exclusively via short-lived
// presigned URLs. The Lambda that runs this app's server code NEVER
// receives the file bytes: the browser uploads directly to S3 using a URL
// this module generates, and Claude (this chat/model) never sees the file
// at any point. Server-side encryption is inherited from the bucket's
// default SSE-KMS configuration (Paso 2) — no need to set it per-request.
//
// Bucket: created manually in Paso 2 (mo-behavior-therapy-phi-documents),
// NOT provisioned by SST — referenced here via the PHI_BUCKET env var (see
// the "PhiDocumentsBucket" Linkable in sst.config.ts).
//
// Update 2026-10-08: also used to store generated, signed e-signature PDFs
// (see signatureS3Key()/uploadGeneratedPdf() below, and lib/signaturePdf.ts)
// under a separate `signatures/` prefix in this same bucket — reusing the
// existing HIPAA-compliant, encrypted storage rather than standing up a
// second bucket for the same trust boundary.

const BUCKET_NAME = process.env.PHI_BUCKET;
const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes — used immediately by the browser
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes — generated on demand by an admin click, never stored/emailed
const VIEW_URL_TTL_SECONDS = 20 * 60; // 20 minutes — enough for an admin to place fields, or a client to read+sign, without needing a fresh URL mid-session (see createViewUrl)

export function phiStorageConfigured(): boolean {
  return Boolean(BUCKET_NAME);
}

const client = BUCKET_NAME ? new S3Client({}) : null;

function requireClient() {
  if (!client || !BUCKET_NAME) {
    throw new Error("phiStorage: PHI_BUCKET is not configured");
  }
  return client;
}

/** Strips anything that isn't safe in an S3 key or a Content-Disposition
 * filename — no path separators, no control characters. Keeps the original
 * extension where present. */
export function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-180); // guard against absurd lengths
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned || "document";
}

export function documentS3Key(patientId: string, documentId: string, fileName: string): string {
  // patientId is an email (see lib/phiAuth.ts) — safe to use directly as a
  // key segment since it's already validated by zod's email check before
  // this is ever called, but we still avoid raw "/" by construction (email
  // local/domain parts never contain "/").
  return `patients/${patientId}/${documentId}/${sanitizeFileName(fileName)}`;
}

/** Key for a generated, signed e-signature PDF — see lib/signatureEnvelopes.ts.
 * Deliberately a separate top-level prefix from `patients/...` so the two
 * features' objects never collide, even though envelopeId and documentId
 * are both nanoids drawn from the same alphabet. */
export function signatureS3Key(envelopeId: string, fileName: string): string {
  return `signatures/${envelopeId}/${sanitizeFileName(fileName)}`;
}

/** Key for a Phase 2 template's admin-uploaded SOURCE PDF (the document
 * being stamped on) — see lib/signatureTemplates.ts's `sourcePdfKey` and
 * app/api/admin/signature-templates/upload-pdf/route.ts. `uploadId` is a
 * fresh nanoid minted at upload time (before the template itself has an
 * id), so this gets its own top-level prefix, distinct from both
 * `patients/...` and `signatures/...`. */
export function signatureSourcePdfKey(uploadId: string, fileName: string): string {
  return `signature-sources/${uploadId}/${sanitizeFileName(fileName)}`;
}

export async function createUploadUrl(args: {
  s3Key: string;
  contentType: string;
}): Promise<string> {
  const c = requireClient();
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: args.s3Key,
    ContentType: args.contentType,
  });
  return getSignedUrl(c, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/**
 * Server-side upload of bytes we generated ourselves (a signed PDF) rather
 * than something a browser is uploading directly — used right after
 * lib/signaturePdf.ts renders a completed envelope. Unlike createUploadUrl,
 * this writes directly from the Lambda, since there's no untrusted client
 * upload step to keep out of our own server for content we produced.
 */
export async function uploadGeneratedPdf(args: { s3Key: string; bytes: Uint8Array }): Promise<void> {
  const c = requireClient();
  await c.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: args.s3Key,
      Body: args.bytes,
      ContentType: "application/pdf",
    })
  );
}

/**
 * Phase 2: fetches an object's raw bytes server-side — used by
 * lib/signaturePdf.ts's generateStampedPdf() to load the admin-uploaded
 * source PDF into pdf-lib so it can stamp the client's values/signature
 * directly onto it. Unlike every other function in this module, this
 * brings file bytes INTO the Lambda rather than keeping them on a presigned
 * URL path — acceptable here because the bytes never leave the Lambda
 * again as-is (they're merged into a new PDF via pdf-lib, then written
 * back out with uploadGeneratedPdf), the same trust boundary as PHI
 * documents this app already processes server-side elsewhere.
 */
export async function getObjectBytes(s3Key: string): Promise<Uint8Array> {
  const c = requireClient();
  const res = await c.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
  if (!res.Body) {
    throw new Error(`getObjectBytes: empty body for ${s3Key}`);
  }
  return res.Body.transformToByteArray();
}

/**
 * Phase 2: a presigned GET URL for VIEWING a PDF in the browser (via
 * pdf.js) rather than downloading it as an attachment — used by the
 * admin's field-placement editor (app/admin/PdfFieldEditor.tsx) and the
 * client-facing signing page for "pdf"-kind envelopes. Longer TTL than
 * createDownloadUrl since filling in / placing fields on a multi-page
 * document can take longer than a single admin click-to-download.
 */
export async function createViewUrl(args: { s3Key: string }): Promise<string> {
  const c = requireClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: args.s3Key,
    ResponseContentType: "application/pdf",
  });
  return getSignedUrl(c, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

/**
 * Admin-only: a short-lived presigned GET URL so a logged-in staff member
 * can download one document straight from S3 (see
 * app/api/admin/documents/[id]/download/route.ts, and, for signed PDFs,
 * app/api/admin/signature-envelopes/[id]/download/route.ts). The file bytes
 * never pass through this app's own response body, and this URL is
 * generated fresh on each click and never persisted or put in an email —
 * only a generic "go check the admin dashboard" link ever leaves this
 * system by email (see lib/email.ts's sendDocumentUploadedNotification /
 * sendSignatureCompletedNotification).
 */
export async function createDownloadUrl(args: {
  s3Key: string;
  fileName: string;
}): Promise<string> {
  const c = requireClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: args.s3Key,
    ResponseContentDisposition: `attachment; filename="${sanitizeFileName(args.fileName)}"`,
  });
  return getSignedUrl(c, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/** Confirms the object actually landed in S3 (guards against a client that
 * calls the "confirm" API without really uploading) and returns its size. */
export async function headUploadedObject(s3Key: string): Promise<{ sizeBytes: number } | null> {
  const c = requireClient();
  try {
    const res = await c.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
    return { sizeBytes: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}
