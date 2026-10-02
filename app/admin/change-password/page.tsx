"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// useSearchParams() requires a Suspense boundary in the App Router (it
// opts the subtree out of static rendering) - this page is always rendered
// dynamically anyway (it reads a live session cookie upstream in
// app/admin/page.tsx), but Next's build still needs the boundary present.
export default function ChangePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordForm />
    </Suspense>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forced = searchParams.get("reason") === "expired";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    if (newPassword.length < 12) {
      setError("Use at least 12 characters for the new password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        if (body.error === "unauthorized") {
          router.push("/admin/login");
          return;
        }
        setError("Current password is incorrect.");
      } else {
        const body = await res.json().catch(() => ({}) as { error?: string });
        if (body.error === "weak_password") {
          setError("Use at least 12 characters for the new password.");
        } else if (body.error === "same_password") {
          setError("The new password must be different from the current one.");
        } else {
          setError("Couldn't change the password. Please try again.");
        }
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
        <h1 className="mb-1 text-xl font-semibold text-ink-900">Change password</h1>
        <p className="mb-6 text-sm text-ink-500">
          {forced
            ? "Your password is more than 6 months old. Please set a new one to continue."
            : "Set a new password for the admin login."}
        </p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-ink-900" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>

        {error && <p className="mb-4 text-sm text-brand-coral">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand-blue px-6 py-3 text-center text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save new password"}
        </button>

        {!forced && (
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="mt-3 w-full text-center text-xs font-medium text-ink-500 hover:underline"
          >
            Cancel
          </button>
        )}
      </form>
    </main>
  );
}
