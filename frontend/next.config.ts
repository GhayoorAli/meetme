import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:
    !process.env.VERCEL && process.env.NODE_ENV === "production"
      ? "standalone"
      : undefined,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
