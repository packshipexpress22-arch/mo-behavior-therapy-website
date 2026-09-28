import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
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

const BUCKET_NAME = process.env.PHI_BUCKET;
const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutes — used immediately by the browser

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
