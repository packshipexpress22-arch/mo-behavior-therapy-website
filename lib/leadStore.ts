import { nanoid } from "nanoid";
import { promises as fs } from "fs";
import path from "path";
import { prisma, ensureLeadSchema } from "./prisma";
import type { Lead as PrismaLead } from "@prisma/client";
import { dynamoLeadsConfigured, putLead, type FlatLead } from "./dynamoLeads";

// Pluggable lead storage, tried in this order:
//   1. DynamoDB (LEADS_TABLE set) — the AWS Lambda deploy path, see
//      lib/dynamoLeads.ts and sst.config.ts.
//   2. Prisma/Postgres (DATABASE_URL set) — the Vercel production path.
//   3. A gitignored local JSON file — local dev / demo only. Never usable on
//      Lambda (read-only filesystem outside /tmp) or on any other
//      serverless host with an ephemeral filesystem.
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
  "organization",
  "role",
  "positionAppliedFor",
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

function fromFlatLead(row: FlatLead): LeadRecord {
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
    kind: row.kind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
      timestamp: row.consentTimestamp,
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
  // AWS Lambda deploys (sst.config.ts links a DynamoDB table and sets
  // LEADS_TABLE): this takes priority whenever it's configured, since a
  // Lambda deploy never has a working file-store fallback (read-only fs)
  // and may or may not also have DATABASE_URL set.
  if (dynamoLeadsConfigured()) {
    const d = input.data as Record<string, string | undefined>;
    const now = new Date().toISOString();
    const flat: FlatLead = {
      id: `LEAD-${nanoid(10)}`,
      kind: input.kind,
      status: "NEW",
      assignedTo: null,
      notes: "",
      language: input.language,
      contactName: d.contactName ?? null,
      clientFirstName: d.clientFirstName ?? null,
      relationship: d.relationship ?? null,
      clientAge: d.clientAge ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      city: d.city ?? null,
      zip: d.zip ?? null,
      county: d.county ?? null,
      setting: d.setting ?? null,
      insurance: d.insurance ?? null,
      previousAba: d.previousAba ?? null,
      hasReferral: d.hasReferral ?? null,
      hasEvaluation: d.hasEvaluation ?? null,
      hasIep: d.hasIep ?? null,
      contactMethod: d.contactMethod ?? null,
      contactTime: d.contactTime ?? null,
      howHeard: d.howHeard ?? null,
      message: d.message ?? null,
      organization: d.organization ?? null,
      role: d.role ?? null,
      positionAppliedFor: d.positionAppliedFor ?? null,
      consentGiven: input.consent.given,
      consentTextVersion: input.consent.textVersion,
      consentTimestamp: input.consent.timestamp,
      consentIp: input.consent.ip,
      sourcePage: input.source.page || null,
      utmSource: input.source.utm.utm_source || null,
      utmMedium: input.source.utm.utm_medium || null,
      utmCampaign: input.source.utm.utm_campaign || null,
      referrer: input.source.referrer || null,
      createdAt: now,
      updatedAt: now,
    };
    await putLead(flat);
    return fromFlatLead(flat);
  }

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
