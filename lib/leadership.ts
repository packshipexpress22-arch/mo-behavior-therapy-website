import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

// Clinical Leadership — admin-managed content for /about's "Clinical
// Leadership" section (added 2026-10-14, at the user's request: "dame una
// opcion donde pueda agregar personas al clinical leadership"). DynamoDB
// only (SST-managed table, see LeadershipTable in sst.config.ts — same
// "link grants CRUD automatically" pattern as SignatureTemplatesTable, see
// lib/signatureTemplates.ts for the sibling implementation this mirrors).
//
// A person is pure admin-authored data: name, title, an optional bio (never
// invented — see data/company.ts's long-standing note on this), and an
// optional photo stored in the separate public LeadershipPhotosBucket (see
// lib/leadershipPhotos.ts). `order` controls display order on the public
// page (ascending; ties broken by createdAt).
//
// app/[locale]/about/page.tsx falls back to data/company.ts's static
// `leadership` array whenever this table is empty or not configured for
// the current stage, so the page never regresses to showing nobody.

const TABLE_NAME = process.env.LEADERSHIP_TABLE;

export function leadershipConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

export type LeadershipPerson = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  photoKey: string | null; // S3 key in LeadershipPhotosBucket, see lib/leadershipPhotos.ts
  photoUrl: string | null; // public URL derived from photoKey at write time, stored for convenience
  order: number;
  createdAt: string;
  updatedAt: string;
};

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("leadership: LEADERSHIP_TABLE is not configured");
  }
  return client;
}

function normalizePerson(item: Record<string, unknown>): LeadershipPerson {
  return {
    id: item.id as string,
    name: (item.name as string) ?? "",
    title: (item.title as string) ?? "",
    bio: typeof item.bio === "string" ? item.bio : null,
    photoKey: typeof item.photoKey === "string" ? item.photoKey : null,
    photoUrl: typeof item.photoUrl === "string" ? item.photoUrl : null,
    order: typeof item.order === "number" ? item.order : 0,
    createdAt: (item.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (item.updatedAt as string) ?? new Date().toISOString(),
  };
}

export async function createPerson(args: {
  name: string;
  title: string;
  bio?: string | null;
  photoKey?: string | null;
  photoUrl?: string | null;
  order?: number;
}): Promise<LeadershipPerson> {
  const c = requireClient();
  const now = new Date().toISOString();
  const person: LeadershipPerson = {
    id: nanoid(12),
    name: args.name,
    title: args.title,
    bio: args.bio ?? null,
    photoKey: args.photoKey ?? null,
    photoUrl: args.photoUrl ?? null,
    order: typeof args.order === "number" ? args.order : 0,
    createdAt: now,
    updatedAt: now,
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: person }));
  return person;
}

export async function getPerson(id: string): Promise<LeadershipPerson | null> {
  const c = requireClient();
  const res = await c.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }));
  return res.Item ? normalizePerson(res.Item as Record<string, unknown>) : null;
}

export async function updatePerson(
  id: string,
  patch: Partial<Pick<LeadershipPerson, "name" | "title" | "bio" | "photoKey" | "photoUrl" | "order">>
): Promise<LeadershipPerson | null> {
  const c = requireClient();
  const existing = await getPerson(id);
  if (!existing) return null;
  const updated: LeadershipPerson = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
  return updated;
}

export async function deletePerson(id: string): Promise<void> {
  const c = requireClient();
  await c.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
}

/**
 * Lists everyone, sorted for display (ascending `order`, ties broken by
 * oldest first). A full table Scan is fine here — same tiny-table
 * justification as lib/signatureTemplates.ts's listTemplates(): this table
 * only ever holds a small clinic's own leadership roster. Called from both
 * the admin panel (app/admin/LeadershipPanel.tsx, via
 * app/api/admin/leadership/route.ts) and the public About page directly
 * (no auth needed to just read names/titles/photos that are already shown
 * publicly on the page).
 */
export async function listLeadership(): Promise<LeadershipPerson[]> {
  const c = requireClient();
  const items: LeadershipPerson[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await c.send(new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey }));
    items.push(...((res.Items as Record<string, unknown>[]) ?? []).map(normalizePerson));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1));
}
