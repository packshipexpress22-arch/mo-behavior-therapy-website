import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// DynamoDB-backed lead storage, used only when LEADS_TABLE is set (AWS
// Lambda deploys via sst.config.ts, which links a sst.aws.Dynamo table and
// grants the Lambda role least-privilege access to it). The Vercel/Prisma
// path (lib/prisma.ts) is untouched and remains the production backend for
// mobehaviortherapy.com until a cutover is explicitly decided.
//
// Item shape mirrors prisma/schema.prisma's Lead model exactly (flat
// top-level attributes, all optional fields as string | null) so
// app/api/admin/leads/* can return DynamoDB items directly to the existing
// admin dashboard UI with zero changes there — see
// app/admin/AdminDashboard.tsx's local `Lead` type for the authoritative
// shape this must match.
//
// gsi1pk/gsi1sk exist only to support "list newest first": every item gets
// gsi1pk="LEAD" (a single logical partition — fine at this table's expected
// volume, a therapy practice's lead intake, not a high-throughput system)
// and gsi1sk=createdAt (ISO string, so lexicographic order == chronological
// order), queried with ScanIndexForward:false.

const TABLE_NAME = process.env.LEADS_TABLE;

export function dynamoLeadsConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

export type FlatLead = {
  id: string;
  kind: "family" | "referral" | "career";
  status: string;
  assignedTo: string | null;
  notes: string;
  language: string;
  contactName: string | null;
  clientFirstName: string | null;
  relationship: string | null;
  clientAge: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  zip: string | null;
  county: string | null;
  setting: string | null;
  insurance: string | null;
  previousAba: string | null;
  hasReferral: string | null;
  hasEvaluation: string | null;
  hasIep: string | null;
  contactMethod: string | null;
  contactTime: string | null;
  howHeard: string | null;
  message: string | null;
  organization: string | null;
  role: string | null;
  positionAppliedFor: string | null;
  consentGiven: boolean;
  consentTextVersion: string;
  consentTimestamp: string;
  consentIp: string | null;
  sourcePage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
};

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("dynamoLeads: LEADS_TABLE is not configured");
  }
  return client;
}

export async function putLead(item: FlatLead): Promise<void> {
  const c = requireClient();
  await c.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...item, gsi1pk: "LEAD", gsi1sk: item.createdAt },
    })
  );
}

export async function getLead(id: string): Promise<FlatLead | null> {
  const c = requireClient();
  const res = await c.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));
  return (res.Item as FlatLead) ?? null;
}

export async function listLeads(opts: {
  status?: string | null;
  kind?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<FlatLead[]> {
  const c = requireClient();
  const res = await c.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "LEAD" },
      ScanIndexForward: false,
      Limit: 500,
    })
  );
  let items = (res.Items as FlatLead[]) ?? [];
  if (opts.status) items = items.filter((i) => i.status === opts.status);
  if (opts.kind) items = items.filter((i) => i.kind === opts.kind);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter((i) =>
      [i.contactName, i.clientFirstName, i.email, i.phone, i.city, i.zip]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }
  return items.slice(0, opts.limit ?? 200);
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<FlatLead, "status" | "notes" | "assignedTo">>
): Promise<FlatLead> {
  const c = requireClient();
  const existing = await getLead(id);
  if (!existing) throw new Error("not_found");

  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
  const sets = ["#updatedAt = :updatedAt"];

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = value;
    sets.push(`#${key} = :${key}`);
  }

  const res = await c.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes as FlatLead;
}

export async function deleteLead(id: string): Promise<void> {
  const c = requireClient();
  await c.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}
