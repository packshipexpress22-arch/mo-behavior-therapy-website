// Server-side verification for Cloudflare Turnstile tokens (POST /api/leads,
// /api/referrals, /api/careers). If TURNSTILE_SECRET_KEY isn't configured,
// verification is skipped (returns true) so those endpoints keep working
// with just the honeypot until a Turnstile site is actually set up — see
// .env.example and README section 8b. Once the secret is set, a missing or
// invalid token fails the request.
// Tracks whether the once-per-cold-start misconfiguration warning below has
// already fired, so a busy Lambda instance doesn't spam CloudWatch with the
// same message on every request.
let warnedAboutMissingSecret = false;

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // The widget key is public-safe to ship to the browser, so a site that
    // means to run with Turnstile OFF simply never sets either env var —
    // that's indistinguishable from this exact state (site key set, secret
    // not) at the code level, which is exactly why this was flagged as a
    // silent fail-open risk rather than an active bug (security audit
    // finding #13, mo-security-audit.md): nothing here can safely assume
    // "secret missing" means "Turnstile intentionally disabled" and start
    // rejecting requests, since for most of this project's life so far that
    // actually was the intended state. A loud one-time log is the safe
    // middle ground — surfaces a real misconfiguration (site key shipped,
    // secret forgotten) in CloudWatch without breaking forms outright the
    // moment someone sets the site key before the secret.
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      // eslint-disable-next-line no-console
      console.error(
        "[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not — " +
          "the widget renders in the browser but the server accepts every submission unchecked. " +
          "Neither var is wired into sst.config.ts yet (Turnstile isn't provisioned there today) — " +
          "add TURNSTILE_SECRET_KEY as an sst.Secret alongside the site key to actually enforce it."
      );
    }
    return true;
  }

  if (typeof token !== "string" || !token) return false;

  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", token);
    if (remoteIp && remoteIp !== "unknown") params.set("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification request failed:", err);
    return false;
  }
}
