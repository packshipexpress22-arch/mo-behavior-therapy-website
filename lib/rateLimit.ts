// Shared in-memory, per-IP rate limiter for public form endpoints
// (leads, referrals, careers). Extracted from app/api/leads/route.ts so
// /api/referrals and /api/careers get the same protection instead of having
// none at all (they previously had zero request-volume control beyond the
// honeypot field).
//
// Known limitation, unchanged from the original leads/route.ts
// implementation: this app deploys to AWS Lambda via SST/OpenNext, so this
// counter lives in one Lambda execution environment's memory. It resets on
// every cold start and isn't shared across concurrent instances — the
// effective ceiling is "N per warm instance", not a true global N/minute.
// That's an acknowledged gap (see mo-security-audit.md, finding #6); a
// proper fix moves this to DynamoDB with a TTL. This module keeps the
// current behavior (better than nothing, consistent across all three
// routes) without taking on that larger change here.
export function createRateLimiter(max: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function rateLimited(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}
