import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../globals.css";

// app/admin lives outside app/[locale], so — same as app/[locale]/layout.tsx
// does for the public site — this is the layout that actually renders
// <html>/<body> for this subtree (the real root layout, app/layout.tsx, is
// an intentional passthrough; see the comment there). Kept deliberately
// separate from the public site: English-only, not localized, not indexed.

export const metadata: Metadata = {
  title: "Admin — MO Behavior Therapy",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-100 font-sans text-ink-900">{children}</body>
    </html>
  );
}
