import type { NextConfig } from "next";

const backendProxyTarget =
  process.env.BACKEND_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  images: {
    remotePatterns: [
      // Local backend dev server
      { protocol: "http", hostname: "127.0.0.1", port: "4000" },
      { protocol: "http", hostname: "localhost", port: "4000" },
      // Production / Render deploy
      { protocol: "https", hostname: "**.onrender.com" },
      { protocol: "https", hostname: "**.vercel.app" },
      // Any custom domain (catch-all for uploads CDN)
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      { source: "/signup", destination: "/login", permanent: true },
      { source: "/register", destination: "/login", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendProxyTarget}/api/:path*`,
      },
      {
        source: "/backend-uploads/:path*",
        destination: `${backendProxyTarget}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
