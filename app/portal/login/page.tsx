"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

// useSearchParams() requires a Suspense boundary in the app router (Next.js
// bails this component out of static prerendering at build time otherwise)
// — see LoginForm below.
export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "expired_link";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally ignored — see the note below and in
      // app/api/portal/request-link/route.ts: this screen always shows the
      // same "check your email" confirmation, whether or not the request
      // actually succeeded, so it can't be used to enumerate valid emails.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl3 border border-ink-100 bg-white p-8 shadow-card">
        <h1 className="mb-1 text-xl font-semibold text-ink-900">MO Behavior Therapy</h1>
        <p className="mb-6 text-sm text-ink-500">Patient portal</p>

        {sent ? (
          <div className="rounded-xl bg-brand-blue/10 p-4 text-sm text-ink-900">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-ink-500">
              If an account exists for that address, we've sent a secure sign-in link. It expires in
              15 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-4 text-sm text-ink-500">
              Enter your email and we'll send you a secure one-time link to sign in — no password
              needed.
            </p>

            {linkExpired && (
              <p className="mb-4 rounded-xl bg-brand-coral/10 p-3 text-sm text-brand-coral">
                That link has expired or was already used. Request a new one below.
              </p>
            )}

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-brand-blue px-6 py-3 text-center text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send me a secure link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
