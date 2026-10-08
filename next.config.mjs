import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withNextIntl(nextConfig);

