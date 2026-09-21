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
};

export default withNextIntl(nextConfig);

