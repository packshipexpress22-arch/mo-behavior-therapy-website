import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../globals.css";

// app/portal lives outside app/[locale], same reasoning as app/admin/layout.tsx:
// this is the real root layout for this subtree (renders <html>/<body>).
// English-only for this first version — see claude/mo-hipaa-baa-setup-steps.md
// Paso 6 for the localization note. Not indexed: this is a private patient
// area, never meant to appear in search results.

export const metadata: Metadata = {
  title: "Patient Portal — MO Behavior Therapy",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-100 font-sans text-ink-900">{children}</body>
    </html>
  );
}
