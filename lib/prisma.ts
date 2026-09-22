import { PrismaClient } from "@prisma/client";

// One PrismaClient reused across hot reloads in dev and across invocations
// of the same serverless function instance in production — creating a new
// client per request would exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let schemaEnsured = false;

/**
 * One-time, idempotent schema bootstrap for the Lead table.
 *
 * LEAD_STORE=prisma points at a real Postgres database (DATABASE_URL), but
 * this project has no prisma/migrations folder yet and nothing else creates
 * the table, so the very first write would otherwise fail with "relation
 * \"Lead\" does not exist". This mirrors exactly what `prisma db push`
 * would generate for the current prisma/schema.prisma, expressed as plain
 * SQL run through the app's own already-configured database connection at
 * request time — every statement is guarded (IF NOT EXISTS / duplicate_object)
 * so it's safe to run more than once, and a module-level flag keeps it to a
 * single attempt per warm serverless instance.
 */
export async function ensureLeadSchema() {
  if (schemaEnsured) return;

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LeadKind" AS ENUM ('family', 'referral', 'career');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LeadStatus" AS ENUM (
        'NEW', 'CONTACT_ATTEMPTED', 'CONTACTED', 'INSURANCE_VERIFICATION',
        'DOCUMENTS_NEEDED', 'ASSESSMENT_PENDING', 'WAITLIST',
        'SERVICES_STARTED', 'NOT_ELIGIBLE_OUTSIDE_AREA', 'CLOSED'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Lead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "kind" "LeadKind" NOT NULL,
      "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
      "assignedTo" TEXT,
      "notes" TEXT NOT NULL DEFAULT '',
      "language" TEXT NOT NULL DEFAULT 'en',
      "contactName" TEXT,
      "clientFirstName" TEXT,
      "relationship" TEXT,
      "clientAge" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "city" TEXT,
      "zip" TEXT,
      "county" TEXT,
      "setting" TEXT,
      "insurance" TEXT,
      "previousAba" TEXT,
      "hasReferral" TEXT,
      "hasEvaluation" TEXT,
      "hasIep" TEXT,
      "contactMethod" TEXT,
      "contactTime" TEXT,
      "howHeard" TEXT,
      "message" TEXT,
      "organization" TEXT,
      "role" TEXT,
      "positionAppliedFor" TEXT,
      "consentGiven" BOOLEAN NOT NULL,
      "consentTextVersion" TEXT NOT NULL,
      "consentTimestamp" TIMESTAMP(3) NOT NULL,
      "consentIp" TEXT,
      "sourcePage" TEXT,
      "utmSource" TEXT,
      "utmMedium" TEXT,
      "utmCampaign" TEXT,
      "referrer" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );
  `);

  // ADD COLUMN IF NOT EXISTS covers the case where "Lead" already existed
  // from before these three columns were added (this project's production
  // table was bootstrapped by an earlier version of this function) — the
  // CREATE TABLE IF NOT EXISTS above is a no-op once the table exists, so
  // new columns need their own explicit, idempotent migration step here.
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "organization" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "role" TEXT;`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "positionAppliedFor" TEXT;`
  );

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Lead_kind_idx" ON "Lead"("kind");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");`
  );

  schemaEnsured = true;
}
