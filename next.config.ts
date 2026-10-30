import type { NextConfig } from "next";
import { hostRedirects, LEGACY_HOSTS } from "./src/lib/redirects";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    // Creator avatars are Google account photos.
    remotePatterns: [{ protocol: "https", hostname: "*.googleusercontent.com" }],
  },
  // Old and alternate addresses go to the main domain (empty until it is set).
  async redirects() {
    return hostRedirects(process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, LEGACY_HOSTS);
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
