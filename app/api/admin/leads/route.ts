import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma, ensureLeadSchema } from "@/lib/prisma";
import { dynamoLeadsConfigured, listLeads } from "@/lib/dynamoLeads";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
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
]);
const VALID_KINDS = new Set(["family", "referral", "career"]);

export async function GET(req: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const kind = searchParams.get("kind");
  const q = searchParams.get("q")?.trim();

  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 422 });
  }
  if (kind && !VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 422 });
  }

  // Temporary diagnostic (2026-10-13): "Couldn't load leads" was reported
  // in production right after the missing-secrets fix; this pins down
  // whether dynamoLeadsConfigured() is actually true here, and surfaces the
  // real error if listLeads() itself is what's throwing (previously
  // uncaught, which would otherwise show up as a generic 500 with no
  // detail in CloudWatch). Remove once the root cause is confirmed.
  // eslint-disable-next-line no-console
  console.error(
    "[admin/leads] diag: dynamoLeadsConfigured=",
    dynamoLeadsConfigured(),
    "LEADS_TABLE set=",
    Boolean(process.env.LEADS_TABLE),
    "DATABASE_URL set=",
    Boolean(process.env.DATABASE_URL)
  );

  // AWS Lambda deploys: leads live in DynamoDB (see lib/dynamoLeads.ts),
  // returned in the same flat shape Prisma rows have below, so the admin
  // dashboard UI (app/admin/AdminDashboard.tsx) needs no changes.
  if (dynamoLeadsConfigured()) {
    try {
      const leads = await listLeads({ status, kind, q, limit: 200 });
      return NextResponse.json({ leads });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[admin/leads] diag: listLeads() threw:", err);
      return NextResponse.json({ error: "dynamo_error" }, { status: 500 });
    }
  }

  if (!process.env.DATABASE_URL) {
    // Admin dashboard only makes sense once leads are actually in a real
    // store — the local-JSON-file fallback (lib/leadStore.ts) is dev-only.
    return NextResponse.json({ error: "no_database", leads: [] }, { status: 503 });
  }

  await ensureLeadSchema();

  // Loosely typed on purpose: Prisma's generated WhereInput type is exact
  // about enum filter shapes in a way that's easy to get subtly wrong by
  // hand, and this object is fully validated above before it ever reaches
  // the query (status/kind checked against fixed allow-lists; q only ever
  // feeds a `contains` filter, never raw SQL).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (kind) where.kind = kind;
  if (q) {
    where.OR = [
      { contactName: { contains: q, mode: "insensitive" } },
      { clientFirstName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { zip: { contains: q, mode: "insensitive" } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ leads });
}
