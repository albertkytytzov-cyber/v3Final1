import type { NextConfig } from "next";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const apiProxyBase = apiBaseUrl.endsWith("/api/v1") ? apiBaseUrl : `${apiBaseUrl}/api/v1`;

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
