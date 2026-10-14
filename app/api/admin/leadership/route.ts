import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { createPerson, listLeadership, leadershipConfigured } from "@/lib/leadership";
import { isValidLeadershipPhotoKey, leadershipPhotoUrl } from "@/lib/leadershipPhotos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only CRUD for the Clinical Leadership roster shown on /about — see
// app/admin/LeadershipPanel.tsx for the UI, lib/leadership.ts for the data
// layer. Mirrors app/api/admin/signature-templates/route.ts's shape.

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!leadershipConfigured()) {
    return NextResponse.json({ error: "not_configured", people: [] }, { status: 503 });
  }

  const people = await listLeadership();
  return NextResponse.json({ people });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!leadershipConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "missing_name" }, { status: 422 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "missing_title" }, { status: 422 });
  }

  let photoKey: string | null = null;
  let photoUrl: string | null = null;
  if (typeof body.photoKey === "string" && body.photoKey) {
    if (!isValidLeadershipPhotoKey(body.photoKey)) {
      return NextResponse.json({ error: "invalid_photo_key" }, { status: 422 });
    }
      const key: string = body.photoKey;
   photoKey = key;
   photoUrl = leadershipPhotoUrl(key);
  }

  const person = await createPerson({
    name: body.name.trim(),
    title: body.title.trim(),
    bio: typeof body.bio === "string" && body.bio.trim() ? body.bio.trim() : null,
    photoKey,
    photoUrl,
    order: typeof body.order === "number" ? body.order : 0,
  });

  return NextResponse.json({ person });
}
