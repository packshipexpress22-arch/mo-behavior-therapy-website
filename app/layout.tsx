import type { ReactNode } from "react";

// Root layout is intentionally minimal: with localePrefix "as-needed", the
// real <html>/<body> shell lives in app/[locale]/layout.tsx so it has
// access to the resolved locale for lang/dir attributes.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

