import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

// Security headers, applied via next.config's headers() rather than
// middleware.ts — middleware.ts's matcher intentionally skips /admin,
// /portal, /sign and /api (it only does locale routing), but these headers
// need to cover every route, those included, since the admin panel and the
// PHI patient portal are exactly the pages most worth hardening against
// clickjacking (frame-ancestors/X-Frame-Options) and script injection (CSP).
//
// script-src/style-src still allow 'unsafe-inline' because Next.js App
// Router's hydration bootstrap script and its inlined critical CSS need it
// without a per-request nonce wired through middleware (which would also
// require widening middleware's matcher). This still meaningfully narrows
// the attack surface: no inline-script CSP would allow literally anything;
// this at least pins script-src to 'self' + the one third-party script this
// site actually loads (Cloudflare Turnstile), blocking exfiltration to or
// execution from any other origin. A nonce-based CSP (dropping
// 'unsafe-inline' from script-src) would be the next hardening step.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
   "img-src 'self' data: blob: https://*.s3.amazonaws.com",
      "font-src 'self' data:",
      // https://mo-behavior-therapy-phi-documents.s3.us-east-1.amazonaws.com
      // is the PHI S3 bucket (see sst.config.ts's phiBucketName / lib/phiStorage.ts).
      // pdf.js (app/admin/PdfFieldEditor.tsx, app/sign/[envelopeId]/
      // SignatureSigningClient.tsx) fetches the source PDF directly from the
      // browser via a presigned S3 URL (pdfjsLib.getDocument(viewUrl)) —
      // without this host here, that fetch is silently blocked by CSP and
      // both the admin's "upload existing PDF" template preview and the
      // parent-facing signing page fail with a generic "couldn't load the
      // PDF" error, even though the upload itself succeeded. Missed when
      // connect-src was first scoped down in the 2026-10-10 security pass,
      // since the e-signature PDF-upload flow wasn't exercised against the
      // new CSP until now.
      "connect-src 'self' https://challenges.cloudflare.com https://mo-behavior-therapy-phi-documents.s3.us-east-1.amazonaws.com",
      // https://www.google.com is the footer's embedded Google Maps iframe
      // (components/layout/Footer.tsx, mapsEmbedSrc()).
      "frame-src https://challenges.cloudflare.com https://www.google.com",
      // pdf.js (Phase 2 e-signature PDF viewer, app/admin/PdfFieldEditor.tsx
      // and app/sign/[envelopeId]/SignatureSigningClient.tsx) loads its
      // worker as a same-origin bundled asset, but some bundler/browser
      // combinations wrap that in a blob: URL — allow both.
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // Legacy/defense-in-depth alongside frame-ancestors above, for older
  // browsers that don't honor CSP's frame-ancestors directive.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Add real asset hosts here (e.g. your CMS or S3 bucket) once the
      // official logo / photography assets are provided.
    ],
  },
  experimental: {
    optimizePackageImports: ["next-intl"],
  },
  // pdfjs-dist (Phase 2 e-signature: rendering PDFs in the browser — see
  // app/admin/PdfFieldEditor.tsx and app/sign/[envelopeId]/SignatureSigningClient.tsx)
  // has an optional Node `canvas` fallback path that webpack otherwise
  // tries to resolve even though it's never reached in the browser bundle.
  // This is the standard fix recommended by pdfjs-dist for webpack/Next.js.
  //
  // Note on the worker file itself (pdf.worker.min.mjs): an earlier version
  // of this config tried to fix a Terser build failure
  // ("'import.meta' cannot be used outside of module code") by pushing a
  // `type: "asset/resource"` module rule here. That did NOT work in
  // production (confirmed by a real deploy run still failing on it) —
  // `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` is
  // handled by webpack's built-in URL-dependency parsing before module
  // rules like this one get a say, so Terser still minified it. The actual
  // fix was to stop bundling the worker through webpack at all: the
  // "prebuild" npm script (package.json) copies it into public/, and both
  // components now point workerSrc at that plain public path instead.
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
 };

export default withNextIntl(nextConfig);
