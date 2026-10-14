import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

// Storage for Clinical Leadership headshots — a separate, PUBLIC-read S3
// bucket (LeadershipPhotosBucket in sst.config.ts, access: "public"),
// deliberately distinct from the PHI bucket in lib/phiStorage.ts. These
// photos are meant to be shown directly on the public /about page via a
// plain <img src>, so there's no presigned-URL dance here — upload is the
// only thing that needs an authenticated admin session; reading the result
// is just a normal public HTTPS GET.
//
// NEVER store anything containing PHI in this bucket.

const BUCKET_NAME = process.env.LEADERSHIP_PHOTOS_BUCKET;
const BUCKET_DOMAIN = process.env.LEADERSHIP_PHOTOS_BUCKET_DOMAIN;

export function leadershipPhotosConfigured(): boolean {
  return Boolean(BUCKET_NAME && BUCKET_DOMAIN);
}

const client = BUCKET_NAME ? new S3Client({}) : null;

function requireClient() {
  if (!client || !BUCKET_NAME) {
    throw new Error("leadershipPhotos: LEADERSHIP_PHOTOS_BUCKET is not configured");
  }
  return client;
}

/** Strips anything unsafe in an S3 key, same approach as
 * lib/phiStorage.ts's sanitizeFileName. */
function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-120);
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned || "photo";
}

export function leadershipPhotoKey(fileName: string): string {
  return `leadership/${nanoid(12)}/${sanitizeFileName(fileName)}`;
}

/** Only ever accept keys actually shaped like leadershipPhotoKey() produces
 * — same defensive reasoning as lib/phiStorage.ts's
 * isValidSignatureSourcePdfKey: without this, a compromised admin session
 * could point a person record at an arbitrary S3 key. */
export function isValidLeadershipPhotoKey(key: string): boolean {
  return /^leadership\/[A-Za-z0-9_-]{1,32}\/[A-Za-z0-9._-]{1,150}$/.test(key);
}

export function leadershipPhotoUrl(key: string): string {
  if (!BUCKET_DOMAIN) {
    throw new Error("leadershipPhotos: LEADERSHIP_PHOTOS_BUCKET_DOMAIN is not configured");
  }
  return `https://${BUCKET_DOMAIN}/${key}`;
}

export async function uploadLeadershipPhoto(args: {
  s3Key: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<void> {
  const c = requireClient();
  await c.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: args.s3Key,
      Body: args.bytes,
      ContentType: args.contentType,
    })
  );
}

/** Best-effort cleanup when a person's photo is replaced or they're
 * deleted — never throws, since losing the old object is harmless (it's
 * already been swapped for a new photoKey, or the person record itself is
 * gone) and shouldn't fail the admin's actual request. */
export async function deleteLeadershipPhoto(s3Key: string): Promise<void> {
  try {
    const c = requireClient();
    await c.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[leadershipPhotos] failed to delete ${s3Key}:`, err);
  }
}
