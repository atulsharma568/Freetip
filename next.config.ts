import type { NextConfig } from "next";
import { hostRedirects, LEGACY_HOSTS } from "./src/lib/redirects";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const sameSiteFrame = [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];

const nextConfig: NextConfig = {
  images: {
    // Creator avatars are Google account photos; a creator's YouTube banner is on the same hosts.
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.ggpht.com" },
    ],
  },
  // Old and alternate addresses go to the main domain (empty until it is set).
  async redirects() {
    return hostRedirects(process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, LEGACY_HOSTS);
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Later rules win for the same header. The owner's editor shows the tip page in a frame of
      // its own site; nothing else may be framed, and this page is owner-only.
      { source: "/page-preview/:path*", headers: sameSiteFrame },
      // The test-only copy of the preview (404 unless PAGE_FIXTURES=1).
      { source: "/dev-fixtures/preview", headers: sameSiteFrame },
    ];
  },
};

export default nextConfig;
