import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_STATUSES = [
  "NEW",
  "CONTACT_ATTEMPTED",
  "CONTACTED",
  "INSURANCE_VERIFICATION",
  "DOCUMENTS_NEEDED",
  "ASSESSMENT_PENDING",
  "WAITLIST",
  "SERVICES_STARTED",
  "NOT_ELIGIBLE_OUTSIDE_AREA",
  "CLOSED",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "no_database" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (typeof body.status === "string") {
    if (!(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 422 });
    }
    data.status = body.status;
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.slice(0, 5000);
  }
  if (typeof body.assignedTo === "string") {
    data.assignedTo = body.assignedTo.slice(0, 120) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[admin/leads] update failed:", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
