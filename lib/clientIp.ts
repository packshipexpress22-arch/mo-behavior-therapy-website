import { NextRequest } from "next/server";

// Shared helper for every route that reads the visitor's IP for rate
// limiting or (in the e-signature submit route) the audit trail — see
// mo-security-audit.md finding #10.
//
// `X-Forwarded-For` is a comma-separated hop chain the CLIENT can send any
// value for; AWS's edge (CloudFront / API Gateway / an ALB in front of this
// app's Lambda) appends the connection's own observed source IP as the
// LAST entry rather than replacing the header outright, so trusting the
// FIRST entry (what every route here used to do) lets a request simply
// claim to be any IP it likes by pre-populating the header itself. The last
// entry is the one hop closest to AWS's own network and isn't something an
// external client can forge — that's the one that should ever be trusted
// for rate-limiting or logged as "the" IP.
//
// This is still a best-effort identifier, not a verified one (shared
// NATs/corporate proxies mean several real visitors can share one IP, and a
// misconfigured edge could still forward something client-controlled as the
// last hop) — rate limiting and the audit trail should keep treating it as
// "best available signal", not as proof of identity.
export function getClientIp(req: NextRequest): string {
  const header = req.headers.get("x-forwarded-for");
  if (!header) return "unknown";
  const hops = header.split(",").map((h) => h.trim()).filter(Boolean);
 return hops.at(-1) ?? "unknown";
}
