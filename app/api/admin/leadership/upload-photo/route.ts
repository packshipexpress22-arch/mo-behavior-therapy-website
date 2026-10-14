import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { leadershipPhotoKey, leadershipPhotoUrl, uploadLeadershipPhoto, leadershipPhotosConfigured } from "@/lib/leadershipPhotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin uploads a headshot for a Clinical Leadership entry — same
// authenticated-multipart-form pattern as
// app/api/admin/signature-templates/upload-pdf/route.ts (the uploader is
// already a logged-in staff member, so no need for a direct-to-S3
// presigned PUT like the patient portal's untrusted client uploads).

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — generous for a phone/camera headshot, small enough to read fully into Lambda memory
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Confirms the bytes actually look like the claimed image type — a
 * Content-Type header alone is just what the browser said about the file,
 * never trustworthy on its own for something about to be served publicly. */
function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      bytes.length > 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!leadershipPhotosConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "missing_file" }, { status: 422 });
  }
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 422 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeImage(bytes, file.type)) {
    return NextResponse.json({ error: "invalid_image" }, { status: 422 });
  }

  const s3Key = leadershipPhotoKey(file.name || "photo");
  await uploadLeadershipPhoto({ s3Key, bytes, contentType: file.type });

  return NextResponse.json({ photoKey: s3Key, photoUrl: leadershipPhotoUrl(s3Key) });
}
