"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}) as { error?: string });
      if (body.error === "rate_limited") {
        setError("Too many attempts. Please wait a minute and try again.");
      } else if (body.error === "not_configured") {
        setError("Admin login isn't configured yet.");
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-brand-blue";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl3 border border-ink-100 bg-white p-8 shadow-card"
      >
        <h1 className="mb-1 text-xl font-semibold text-ink-900">MO Behavior Therapy</h1>
        <p className="mb-6 text-sm text-ink-500">Staff admin</p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="mb-4 text-sm text-brand-coral">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand-blue px-6 py-3 text-center text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
