import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/url";

// Apps that only fetch a page to draw a link preview when someone shares it.
// They don't put pages in search results, and Meta's (WhatsApp, Instagram,
// Facebook) skips the preview entirely if robots.txt turns it away.
const LINK_PREVIEWS = [
  "facebookexternalhit",
  "Facebot",
  "WhatsApp",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
];

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    return {
      rules: [
        { userAgent: LINK_PREVIEWS, allow: "/", disallow: ["/api/", "/overlay/"] },
        { userAgent: "*", disallow: "/" },
      ],
    };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/overlay/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
