import type { MetadataRoute } from "next";
import { LEGAL_DRAFT } from "@/lib/legal";
import { SITE_URL } from "@/lib/url";

// Policy pages join the sitemap once they are no longer drafts (they are
// marked noindex until then). /privacy and /terms are always indexable: Google's
// app verification needs to read them. /signup and /signin are noindex, so they stay out.
const LEGAL_PATHS = ["/about", "/pricing", "/contact", "/terms", "/privacy", "/refunds", "/delivery", "/community-guidelines"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...new Set(["", "/privacy", "/terms", ...(LEGAL_DRAFT ? [] : LEGAL_PATHS)])];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
