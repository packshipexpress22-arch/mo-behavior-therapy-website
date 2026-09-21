import { nanoid } from "nanoid";
import { promises as fs } from "fs";
import path from "path";
import { prisma, ensureLeadSchema } from "./prisma";
import type { Lead as PrismaLead } from "@prisma/client";

// Pluggable lead storage. LEAD_STORE=file (default, for local dev / demo)
// appends to a gitignored JSON file. LEAD_STORE=prisma uses the Lead model
// in prisma/schema.prisma via lib/prisma.ts, backed by DATABASE_URL — this
// is the production path.
//
// Whatever backend is used, the contract is the same: storeLead() must
// succeed (or throw) BEFORE any email is sent, per spec ("store the lead
// first, then process notification delivery safely").

export type LeadStatus =
  | "NEW"
  | "CONTACT_ATTEMPTED"
  | "CONTACTED"
  | "INSURANCE_VERIFICATION"
  | "DOCUMENTS_NEEDED"
  | "ASSESSMENT_PENDING"
  | "WAITLIST"
  | "SERVICES_STARTED"
  | "NOT_ELIGIBLE_OUTSIDE_AREA"
  | "CLOSED";

export type LeadKind = "family" | "referral" | "career";

export type LeadRecord = {
  id: string;
  kind: LeadKind;
  createdAt: string;
  updatedAt: string;
  status: LeadStatus;
  assignedTo: string | null;
  notes: string;
  source: {
    page: string;
    utm: Record<string, string>;
    referrer: string;
  };
  consent: {
    given: boolean;
    textVersion: string;
    timestamp: string;
    ip: string | null;
  };
  language: string;
  data: Record<string, unknown>;
};

const DATA_FILE = path.join(process.cwd(), "data", "leads.local.json");

async function readFileStore(): Promise<LeadRecord[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeFileStore(records: LeadRecord[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf8");
}

// Fields on the Prisma Lead model that mirror LeadDraft / leadSchema's
// free-form intake data. Kept as a list so the mapping in both directions
// (storeLead's create() call and fromPrismaLead's readback) stays in sync.
const INTAKE_FIELDS = [
  "contactName",
  "clientFirstName",
  "relationship",
  "clientAge",
  "phone",
  "email",
  "city",
  "zip",
  "county",
  "setting",
  "insurance",
  "previousAba",
  "hasReferral",
  "hasEvaluation",
  "hasIep",
  "contactMethod",
  "contactTime",
  "howHeard",
  "message",
] as const;

function fromPrismaLead(row: PrismaLead): LeadRecord {
  const data: Record<string, unknown> = {};
  for (const key of INTAKE_FIELDS) {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (value !== null && value !== undefined && value !== "") data[key] = value;
  }

  const utm: Record<string, string> = {};
  if (row.utmSource) utm.utm_source = row.utmSource;
  if (row.utmMedium) utm.utm_medium = row.utmMedium;
  if (row.utmCampaign) utm.utm_campaign = row.utmCampaign;

  return {
    id: row.id,
    kind: row.kind as LeadKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status as LeadStatus,
    assignedTo: row.assignedTo,
    notes: row.notes,
    source: {
      page: row.sourcePage || "",
      utm,
      referrer: row.referrer || "",
    },
    consent: {
      given: row.consentGiven,
      textVersion: row.consentTextVersion,
      timestamp: row.consentTimestamp.toISOString(),
      ip: row.consentIp,
    },
    language: row.language,
    data,
  };
}

export async function storeLead(input: {
  kind: LeadKind;
  data: Record<string, unknown>;
  consent: LeadRecord["consent"];
  source: LeadRecord["source"];
  language: string;
}): Promise<LeadRecord> {
  // Prefer Prisma/Postgres whenever a database is actually configured — a
  // separate LEAD_STORE=prisma flag used to gate this, but its value can no
  // longer be verified (it was saved as a Vercel "Sensitive" variable, which
  // is write-only and can never be read back, by anyone, once saved) and
  // evidently isn't the literal string "prisma", so it silently fell back to
  // the file store on every deploy. Keying off DATABASE_URL's presence is
  // simpler and can't drift out of sync with what's actually configured.
  if (process.env.DATABASE_URL) {
    await ensureLeadSchema();
    const d = input.data as Record<string, string | undefined>;
    const intakeData: Record<string, string | undefined> = {};
    for (const key of INTAKE_FIELDS) {
      if (d[key] !== undefined && d[key] !== "") intakeData[key] = d[key];
    }

    const row = await prisma.lead.create({
      data: {
        kind: input.kind,
        language: input.language,
        ...intakeData,
        consentGiven: input.consent.given,
        consentTextVersion: input.consent.textVersion,
        consentTimestamp: new Date(input.consent.timestamp),
        consentIp: input.consent.ip,
        sourcePage: input.source.page || undefined,
        utmSource: input.source.utm.utm_source,
        utmMedium: input.source.utm.utm_medium,
        utmCampaign: input.source.utm.utm_campaign,
        referrer: input.source.referrer || undefined,
      },
    });
    return fromPrismaLead(row);
  }

  const record: LeadRecord = {
    id: `LEAD-${nanoid(10)}`,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "NEW",
    assignedTo: null,
    notes: "",
    source: input.source,
    consent: input.consent,
    language: input.language,
    data: input.data,
  };

  const records = await readFileStore();
  records.push(record);
  await writeFileStore(records);
  return record;
}
