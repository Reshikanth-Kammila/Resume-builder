import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  distDir: process.env.STUDIO_E2E === "1" ? ".next-e2e" : ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.STUDIO_BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
};
export default config;
