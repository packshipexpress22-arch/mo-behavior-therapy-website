import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Small, generic DynamoDB-backed store (SST-managed table, see
// SecurityTable in sst.config.ts) for the two durability gaps the
// 2026-10-10 security audit flagged as needing a real database rather than
// Lambda-instance memory (mo-security-audit.md findings #6 and #7):
//
//   1. claimOnce() — marks a one-time token (e.g. a magic-link nonce) as
//      used, atomically, so it can never be redeemed twice even if two
//      requests race each other.
//   2. durableRateLimit() — a per-key request counter with a fixed time
//      window, shared across every concurrent Lambda instance (unlike
//      lib/rateLimit.ts's in-memory Map, which only ever sees one warm
//      instance's own traffic).
//
// Everything here degrades gracefully when SECURITY_TABLE isn't configured
// (same pattern as every other optional feature in this app) — callers get
// a safe default (claim "succeeds", rate limit "not limited") rather than a
// thrown error, so nothing regresses before this table is deployed.
//
// One partition-key-only table, items prefixed by what they're for
// ("once#...", "rl#...") rather than a separate table per use — this data
// is all small, short-lived, and TTL-expired automatically (see the `ttl`
// attribute below), so there's no reason to provision more than one table.

const TABLE_NAME = process.env.SECURITY_TABLE;

export function securityStoreConfigured(): boolean {
  return Boolean(TABLE_NAME);
}

const client = TABLE_NAME
  ? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    })
  : null;

/**
 * Atomically claims `key` for the first and only time within `ttlSeconds`.
 * Returns true the first time a given key is claimed, false every
 * subsequent time (including a concurrent race — the conditional write
 * only ever lets one caller win). If the table isn't configured yet,
 * returns true unconditionally (graceful degrade — same as the rest of
 * this app's optional-feature pattern) so single-use enforcement is simply
 * not active until the table is deployed, rather than breaking sign-in.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  if (!client || !TABLE_NAME) return true;

  const expireAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  try {
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { pk: `once#${key}`, expireAt },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return false;
    }
    // A transient DynamoDB error shouldn't itself lock a legitimate visitor
    // out of a link they haven't actually used yet — log and allow through,
    // same fail-open posture as the rest of this function's degrade path.
    // eslint-disable-next-line no-console
    console.error(`[securityStore] claimOnce failed for key (not applied):`, err);
    return true;
  }
}

/**
 * Durable per-key rate limiter: `max` requests per fixed `windowMs` window,
 * shared across every Lambda instance (not just whichever one happens to
 * handle a given request). `bucket` namespaces independent limiters sharing
 * this one table (e.g. "admin-login", "portal-request-link"). Returns true
 * when the caller should be rejected as rate-limited.
 *
 * Fixed windows (not sliding) — same coarseness as a token-bucket reset,
 * simpler to make atomic with a single UpdateCommand. A caller right at a
 * window boundary could in principle get ~2x the configured rate across
 * the boundary; that's an accepted tradeoff for simplicity here, not a
 * meaningful weakening of what this replaces (an in-memory counter that
 * could already be bypassed entirely by hitting a cold Lambda instance).
 *
 * If the table isn't configured, returns false unconditionally (graceful
 * degrade — callers should pair this with lib/rateLimit.ts's in-memory
 * limiter as a fallback so there's still *some* protection before this
 * table is deployed; see app/api/admin/login/route.ts).
 */
export async function durableRateLimit(bucket: string, key: string, max: number, windowMs: number): Promise<boolean> {
  if (!client || !TABLE_NAME) return false;

  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const pk = `rl#${bucket}#${key}#${windowStart}`;
  const expireAt = Math.floor((windowStart + windowMs) / 1000) + 60; // small buffer past the window's own end

  try {
    const res = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk },
        UpdateExpression: "ADD #c :incr SET expireAt = if_not_exists(expireAt, :exp)",
        ExpressionAttributeNames: { "#c": "count" },
        ExpressionAttributeValues: { ":incr": 1, ":exp": expireAt },
        ReturnValues: "UPDATED_NEW",
      })
    );
    const count = Number(res.Attributes?.count ?? 0);
    return count > max;
  } catch (err) {
    // Same fail-open posture as claimOnce() — a DynamoDB hiccup shouldn't
    // lock out every legitimate login attempt.
    // eslint-disable-next-line no-console
    console.error(`[securityStore] durableRateLimit failed for bucket "${bucket}" (not enforced this call):`, err);
    return false;
  }
}
