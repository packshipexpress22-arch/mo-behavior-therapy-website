import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

// Minimal, dependency-free admin auth: scrypt for password hashing (Node's
// built-in, no bcrypt package needed) and an HMAC-signed, expiring session
// token stored in an httpOnly cookie. No external service, no extra
// dependency — just ADMIN_USER / ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET
// (see .env.example) already reserved for exactly this in the original spec.

export const ADMIN_COOKIE_NAME = "mo_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return secret;
}
/** Produces a self-contained "scrypt$<saltHex>$<hashHex>" string suitable
 * for ADMIN_PASSWORD_HASH. Not called at runtime by the app itself — used
 * offline to generate the value that goes in the env var. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [scheme, saltHex, hashHex] = parts;
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;

  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}
/** username must not contain "." — the token format uses it as a delimiter.
 * ADMIN_USER is an operator-controlled env var, not visitor input, so this
 * is a safety check rather than something that needs a friendly error. */
export function createSessionToken(username: string): string {
  if (username.includes(".")) {
    throw new Error("ADMIN_USER must not contain '.'");
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${username}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): { username: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [username, expiresAtStr, sig] = parts;
  if (!username || !expiresAtStr || !sig) return null;

  const payload = `${username}.${expiresAtStr}`;
  let expectedSig: string;
  try {
    expectedSig = sign(payload);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return { username };
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USER && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET
  );
}
