// The site's public address, for metadata, the sitemap and robots.txt. Set
// NEXT_PUBLIC_SITE_URL once the real domain is chosen; until then Vercel's
// production address is used (and locally, localhost).
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercel ? `https://${vercel}` : "http://localhost:3000");

// Search engines are kept out until the real domain is set, so the
// placeholder name and the vercel.app address don't end up in results.
export const INDEXABLE = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
