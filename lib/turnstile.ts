// Server-side verification for Cloudflare Turnstile tokens (POST /api/leads,
// /api/referrals, /api/careers). If TURNSTILE_SECRET_KEY isn't configured,
// verification is skipped (returns true) so those endpoints keep working
// with just the honeypot until a Turnstile site is actually set up — see
// .env.example and README section 8b. Once the secret is set, a missing or
// invalid token fails the request.
export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

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
