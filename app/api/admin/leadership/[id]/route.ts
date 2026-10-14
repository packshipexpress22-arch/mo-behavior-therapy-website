import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getPerson, updatePerson, deletePerson } from "@/lib/leadership";
import { isValidLeadershipPhotoKey, leadershipPhotoUrl, deleteLeadershipPhoto } from "@/lib/leadershipPhotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await getPerson(params.id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (body.bio === null) patch.bio = null;
  else if (typeof body.bio === "string") patch.bio = body.bio.trim() || null;
  if (typeof body.order === "number") patch.order = body.order;

  let oldPhotoKeyToClean: string | null = null;
  if (body.photoKey === null) {
    // Explicit removal of the photo.
    if (existing.photoKey) oldPhotoKeyToClean = existing.photoKey;
    patch.photoKey = null;
    patch.photoUrl = null;
  } else if (typeof body.photoKey === "string" && body.photoKey && body.photoKey !== existing.photoKey) {
    if (!isValidLeadershipPhotoKey(body.photoKey)) {
      return NextResponse.json({ error: "invalid_photo_key" }, { status: 422 });
    }
    if (existing.photoKey) oldPhotoKeyToClean = existing.photoKey;
    patch.photoKey = body.photoKey;
    patch.photoUrl = leadershipPhotoUrl(body.photoKey);
  }

  const updated = await updatePerson(params.id, patch);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (oldPhotoKeyToClean) {
    // Best-effort — never blocks the response on S3 cleanup succeeding.
    void deleteLeadershipPhoto(oldPhotoKeyToClean);
  }

  return NextResponse.json({ person: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await getPerson(params.id);
  await deletePerson(params.id);
  if (existing?.photoKey) {
    void deleteLeadershipPhoto(existing.photoKey);
  }
  return NextResponse.json({ ok: true });
}
