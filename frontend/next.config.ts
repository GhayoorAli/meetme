import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone is for Docker only. On Vercel (Next 16.3+) it breaks the build:
  // ENOENT .next/next-server.js.nft.json — vercel/next.js#96646
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
