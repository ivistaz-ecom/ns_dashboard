import type { NextConfig } from "next";

// The browser talks to /php-api on our own origin; Next forwards those requests
// to the PHP backend server-side, so the API's CORS allowlist never applies and
// preview deployments work without registering each new URL.
const API_ORIGIN = (
  process.env.NS_API_ORIGIN ??
  process.env.NEXT_PUBLIC_API_URL ??
  "https://merlin.crafttechhub.com"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/php-api/:path*",
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
