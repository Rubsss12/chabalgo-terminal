import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isVercel = !!process.env.VERCEL;
const isGithubPages = isProd && !isVercel;

const nextConfig: NextConfig = {
  // GitHub Pages: static export with basePath. Vercel: dynamic Next.js.
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/chabalgo-terminal",
        assetPrefix: "/chabalgo-terminal/",
        trailingSlash: true,
      }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
