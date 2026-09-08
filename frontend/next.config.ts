import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:
    !process.env.VERCEL && process.env.NODE_ENV === "production"
      ? "standalone"
      : undefined,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
