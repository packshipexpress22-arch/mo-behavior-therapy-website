import { PrismaClient } from "@prisma/client";

// One PrismaClient reused across hot reloads in dev and across invocations
// of the same serverless function instance in production — creating a new
// client per request would exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
