import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../globals.css";

// app/sign lives outside app/[locale], same reasoning as
// app/admin/layout.tsx and app/portal/layout.tsx: this is the real root
// layout for this subtree (renders <html>/<body>). English-only for this
// first version, same as the patient portal. Not indexed — each URL is a
// private, one-time signing link for a specific client/envelope.

export const metadata: Metadata = {
  title: "Sign Document — MO Behavior Therapy",
  robots: { index: false, follow: false },
};

export default function SignLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-100 font-sans text-ink-900">{children}</body>
    </html>
  );
}
