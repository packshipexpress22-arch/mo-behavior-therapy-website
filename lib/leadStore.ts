import { nanoid } from "nanoid";
import { promises as fs } from "fs";
import path from "path";

// Pluggable lead storage. LEAD_STORE=file (default, for local dev / demo)
// appends to a gitignored JSON file. LEAD_STORE=prisma should be wired to
// prisma/schema.prisma's Lead model for production — see README "Where to
// edit" and prisma/schema.prisma for the recommended production shape.
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

export async function storeLead(input: {
  kind: LeadKind;
  data: Record<string, unknown>;
  consent: LeadRecord["consent"];
  source: LeadRecord["source"];
  language: string;
}): Promise<LeadRecord> {
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

  if (process.env.LEAD_STORE === "prisma") {
    // Production path — see prisma/schema.prisma. Left as a clear extension
    // point rather than a hard dependency so this project runs with zero
    // external services out of the box.
    //
    //   const { prisma } = await import("./prisma");
    //   await prisma.lead.create({ data: { ...record, data: record.data as any } });
    //
    throw new Error(
      "LEAD_STORE=prisma is set but the Prisma client wiring in lib/leadStore.ts is commented out — connect it to your database before enabling this in production."
    );
  }

  const records = await readFileStore();
  records.push(record);
  await writeFileStore(records);
  return record;
}
