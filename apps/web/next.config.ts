import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const apiInternalUrl = (process.env.API_INTERNAL_URL ?? "").replace(/\/+$/, "");

// Next.js blocks dev resources (notably /_next/hmr) when the page is opened
// from a non-localhost host. Allow the LAN origin configured for this checkout
// so client components hydrate when the browser is not on the dev machine.
const devAllowedOrigins = (() => {
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
    return hostname && hostname !== "localhost" && hostname !== "127.0.0.1" ? [hostname] : [];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: devAllowedOrigins,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.steamstatic.com" },
      { protocol: "https", hostname: "avatars.akamai.steamstatic.com" },
      { protocol: "https", hostname: "avatars.fastly.steamstatic.com" },
      { protocol: "https", hostname: "steamcommunity.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    // Local development uses the Next.js server as a same-origin proxy so the
    // browser never needs cross-origin API access. In production Nginx routes
    // /api/ directly to the API container before requests reach Next.js.
    if (!apiInternalUrl) {
      return [];
    }

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
