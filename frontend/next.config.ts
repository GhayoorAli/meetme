import type { NextConfig } from "next";

/**
 * On Vercel, set BACKEND_URL to your Railway API (e.g. https://xxx.up.railway.app)
 * and NEXT_PUBLIC_API_URL=same-origin so the browser talks to this app's domain.
 * Cookies then work (same site). Locally, leave BACKEND_URL unset.
 */
const backendUrl = (process.env.BACKEND_URL ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Standalone is for Docker only. On Vercel (Next 16.3+) it breaks the build:
  // ENOENT .next/next-server.js.nft.json — vercel/next.js#96646
  output: process.env.VERCEL ? undefined : "standalone",

  async rewrites() {
    if (!backendUrl) return [];

    return [
      { source: "/sanctum/:path*", destination: `${backendUrl}/sanctum/:path*` },
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/login", destination: `${backendUrl}/login` },
      { source: "/register", destination: `${backendUrl}/register` },
      { source: "/logout", destination: `${backendUrl}/logout` },
      { source: "/forgot-password", destination: `${backendUrl}/forgot-password` },
      { source: "/reset-password", destination: `${backendUrl}/reset-password` },
    ];
  },
};

export default nextConfig;
