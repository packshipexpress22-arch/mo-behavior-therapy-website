import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

// Runtime-mutable admin credentials. ADMIN_USER / ADMIN_PASSWORD_HASH (see
// sst.config.ts: the "AdminUser" / "AdminPasswordHash" SST secrets) are
// baked in at *build* time - fine for the very first setup, but they can't
// be updated by the running app itself (a Lambda can't redeploy itself),
// which is what a self-service "change password" button needs. So the
// live/current credentials are instead kept in the same DynamoDB table
// already used for leads (LEADS_TABLE), under a single fixed sentinel item
// - no new table, no sst.config.ts change required.
//
// The env vars remain the bootstrap source: the first time this is ever
// read, if no DynamoDB item exists yet, one is created from
// ADMIN_USER/ADMIN_PASSWORD_HASH so an existing deployment keeps working
// with zero manual migration step. After that, the DynamoDB item is the
// single source of truth - changing the env var secrets again would have
// no effect unless the DynamoDB item were deleted.

const TABLE_NAME = process.env.LEADS_TABLE;
const ADMIN_CREDENTIALS_ID = "ADMIN_CREDENTIALS";

// ~6 months. Using 182 days rather than a calendar-month calculation -
// simple, and close enough for a security-hygiene reminder rather than a
// contractual deadline.
export const PASSWORD_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 182;

export type AdminCredentials = {
  id: string;
  username: string;
  passwordHash: string;
  passwordChangedAt: string; // ISO timestamp
};

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

function requireClient() {
  if (!client || !TABLE_NAME) {
    throw new Error("adminCredentials: LEADS_TABLE is not configured");
  }
  return client;
}

/** Reads the live admin credentials, bootstrapping a DynamoDB record from
 * the ADMIN_USER / ADMIN_PASSWORD_HASH env vars the first time this is
 * called if no record exists yet. Returns null if the admin panel isn't
 * configured at all (no DynamoDB table AND no env vars). */
export async function getAdminCredentials(): Promise<AdminCredentials | null> {
  if (!TABLE_NAME) {
    // No DynamoDB table linked (e.g. local dev without LEADS_TABLE) - fall
    // back to the env vars directly, with no persisted "last changed" date
    // (treated as always-expired, which only matters if someone wires up
    // the forced-rotation check in an environment like this).
    const username = process.env.ADMIN_USER;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!username || !passwordHash) return null;
    return {
      id: ADMIN_CREDENTIALS_ID,
      username,
      passwordHash,
      passwordChangedAt: new Date(0).toISOString(),
    };
  }

  const c = requireClient();
  const res = await c.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: ADMIN_CREDENTIALS_ID } }));
  if (res.Item) return res.Item as AdminCredentials;

  const username = process.env.ADMIN_USER;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !passwordHash) return null;

  // Bootstrap: the moment the currently-live build-time password hash is
  // first read is the best available signal for "when it was set" - using
  // it (rather than, say, the epoch) avoids forcing an immediate
  // surprise password change right after a fresh credentials rotation.
  const bootstrapped: AdminCredentials = {
    id: ADMIN_CREDENTIALS_ID,
    username,
    passwordHash,
    passwordChangedAt: new Date().toISOString(),
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: bootstrapped }));
  return bootstrapped;
}

/** Updates the live password hash (and bumps passwordChangedAt to now).
 * Requires the DynamoDB table - there's nowhere else to durably persist a
 * runtime-initiated change. */
export async function updateAdminPassword(newPasswordHash: string): Promise<void> {
  if (!TABLE_NAME) {
    throw new Error("adminCredentials: LEADS_TABLE is not configured, cannot persist a password change");
  }
  const creds = await getAdminCredentials();
  if (!creds) {
    throw new Error("adminCredentials: admin panel is not configured");
  }
  const c = requireClient();
  const updated: AdminCredentials = {
    ...creds,
    passwordHash: newPasswordHash,
    passwordChangedAt: new Date().toISOString(),
  };
  await c.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
}

export function isPasswordExpired(passwordChangedAt: string): boolean {
  const changed = new Date(passwordChangedAt).getTime();
  if (!Number.isFinite(changed)) return true;
  return Date.now() - changed > PASSWORD_MAX_AGE_MS;
}
