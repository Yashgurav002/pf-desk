import type { NextConfig } from "next";

const config: NextConfig = {
  // local Gemma calls can take ~60s on a laptop (cold model load); default proxy timeout is 30s
  experimental: { proxyTimeout: 180_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL || "http://localhost:8787"}/:path*` }];
  },
};

export default config;
