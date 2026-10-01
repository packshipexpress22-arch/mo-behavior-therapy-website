import { randomBytes, timingSafeEqual, createHmac } from "crypto";

// Patient portal auth: passwordless "magic link" sign-in, deliberately
// separate from lib/adminAuth.ts (different secret, different cookie, and a
// patient session must never satisfy an admin route or vice versa).
//
// Identity model for this MVP: a patient's identity IS their verified email
// address (lowercased/trimmed), used directly as `patientId` — the same
// partition key lib/phiDocuments.ts writes to. There is no separate patient
// registry/signup step; anyone with access to an inbox can request a link
// for that inbox and see only documents filed under that email. This keeps
// the portal simple for a small practice's intake volume. A future version
// could add a dedicated patient registry with opaque IDs if needed.
//
// Two distinct signed tokens, both dependency-free HMAC (same technique as
// adminAuth.ts — no external session-store dependency):
//   1. "magic link" token — short-lived (15 min), emailed as a URL param,
//      exchanged exactly once (by hitting /api/portal/verify) for #2.
//   2. "session" token — longer-lived (7 days), stored in an httpOnly
//      cookie after verification, checked on every /portal/* request.

export const PATIENT_COOKIE_NAME = "mo_patient_session";
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes — interactive /portal/login request
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// A document-upload invite is emailed once, right after a lead submits the
// contact form, with no one sitting at /portal/login waiting for it — unlike
// the 15-minute interactive sign-in link above, a caregiver may reasonably
// open that email hours later. 24h balances that against a magic link still
// being a bearer credential for sign-in: if a link expires before they get
// to it, /portal/login lets them request a fresh one with the same email at
// any time, so this isn't the only way in.
export const DOCUMENT_INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.PATIENT_SESSION_SECRET;
  if (!secret) {
    throw new Error("PATIENT_SESSION_SECRET is not configured");
  }
  return secret;
}

export function isPatientPortalConfigured(): boolean {
  return Boolean(process.env.PATIENT_SESSION_SECRET);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** patientId is just the normalized email — see file header. Exported so
 * callers (API routes) derive it the same way instead of duplicating the
 * normalization logic. */
export function patientIdFromEmail(email: string): string {
  return normalizeEmail(email);
}

/** email must not contain "|" — the token format uses it as a delimiter.
 * ttlMs defaults to the 15-minute interactive window; pass
 * DOCUMENT_INVITE_TTL_MS for an emailed invite instead. The chosen TTL is
 * baked into the signed payload itself (see verifyMagicLinkToken), so callers
 * never need to track which TTL a given token used. */
export function createMagicLinkToken(email: string, ttlMs: number = MAGIC_LINK_TTL_MS): string {
  const normalized = normalizeEmail(email);
  if (normalized.includes("|")) {
    throw new Error("email must not contain '|'");
  }
  const nonce = randomBytes(9).toString("base64url");
  const expiresAt = Date.now() + ttlMs;
  const payload = `${normalized}|${expiresAt}|${nonce}`;
  return `${payload}|${sign(payload)}`;
}

export function verifyMagicLinkToken(token: string | undefined | null): { email: string } | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 4) return null;
  const [email, expiresAtStr, nonce, sig] = parts;
  if (!email || !expiresAtStr || !nonce || !sig) return null;

  const payload = `${email}|${expiresAtStr}|${nonce}`;
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

  return { email };
}

export function createPatientSessionToken(email: string): string {
  const normalized = normalizeEmail(email);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${normalized}|${expiresAt}`;
  return `${payload}|${sign(payload)}`;
}

export function verifyPatientSessionToken(
  token: string | undefined | null
): { email: string; patientId: string } | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, expiresAtStr, sig] = parts;
  if (!email || !expiresAtStr || !sig) return null;

  const payload = `${email}|${expiresAtStr}`;
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

  return { email, patientId: patientIdFromEmail(email) };
}
