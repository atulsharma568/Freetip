import type { MetadataRoute } from "next";
import { LEGAL_DRAFT } from "@/lib/legal";
import { SITE_URL } from "@/lib/url";

// Policy pages join the sitemap once they are no longer drafts (they are
// marked noindex until then). /signin is left out while it is a stub.
const LEGAL_PATHS = ["/about", "/pricing", "/contact", "/terms", "/privacy", "/refunds", "/delivery"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/signup", ...(LEGAL_DRAFT ? [] : LEGAL_PATHS)];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
