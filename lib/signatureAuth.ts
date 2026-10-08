import { randomBytes, timingSafeEqual, createHmac } from "crypto";

// Signature-request auth: a one-time, envelope-scoped bearer token, the
// same dependency-free HMAC technique as lib/adminAuth.ts / lib/phiAuth.ts
// but deliberately a THIRD, separate secret (SIGNATURE_SESSION_SECRET) and
// token shape — a signature-request token must never double as an admin
// session or a patient-portal session, and vice versa.
//
// Unlike the patient portal (whose magic link signs the visitor into an
// open-ended account scoped to their email), a signature request is scoped
// to exactly one envelope: the token embeds both the envelopeId and the
// client's email, and every /api/sign/* route re-verifies it from scratch
// on each request rather than issuing a cookie session. This matches how a
// DocuSign-style "complete this one document" link behaves — it only ever
// grants access to the single envelope it was created for.

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — a signature request isn't time-boxed as tightly as an interactive login link; the admin can resend if it lapses.

function getSecret(): string {
  const secret = process.env.SIGNATURE_SESSION_SECRET;
  if (!secret) {
    throw new Error("SIGNATURE_SESSION_SECRET is not configured");
  }
  return secret;
}

export function isSignatureAuthConfigured(): boolean {
  return Boolean(process.env.SIGNATURE_SESSION_SECRET);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** envelopeId and email must not contain "|" — the token format uses it as
 * a delimiter. nanoid ids and normalized emails never do, but we guard
 * anyway since email is caller-supplied. */
export function createSignatureAccessToken(
  envelopeId: string,
  email: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const normalized = normalizeEmail(email);
  if (envelopeId.includes("|") || normalized.includes("|")) {
    throw new Error("envelopeId/email must not contain '|'");
  }
  const nonce = randomBytes(9).toString("base64url");
  const expiresAt = Date.now() + ttlMs;
  const payload = `${envelopeId}|${normalized}|${expiresAt}|${nonce}`;
  return `${payload}|${sign(payload)}`;
}

export function verifySignatureAccessToken(
  token: string | undefined | null
): { envelopeId: string; email: string } | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 5) return null;
  const [envelopeId, email, expiresAtStr, nonce, sig] = parts;
  if (!envelopeId || !email || !expiresAtStr || !nonce || !sig) return null;

  const payload = `${envelopeId}|${email}|${expiresAtStr}|${nonce}`;
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

  return { envelopeId, email };
}
