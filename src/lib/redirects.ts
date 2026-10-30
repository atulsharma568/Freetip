// 301 redirects to the main domain, switched on by NEXT_PUBLIC_SITE_URL. Until
// the real domain is set there is nothing to redirect to, so this is empty.
// API routes are left alone: payment webhooks and the Google sign-in callback
// must keep working on whichever address they were registered with.

export type HostRedirect = {
  source: string;
  has: { type: "host"; value: string }[];
  destination: string;
  statusCode: 301;
};

// Once a custom domain is attached, VERCEL_PROJECT_PRODUCTION_URL becomes that
// domain, so the original vercel.app address has to be named explicitly.
export const LEGACY_HOSTS = ["tipsite.vercel.app"];

export function hostRedirects(siteUrl?: string, productionHost?: string, extraHosts: string[] = []): HostRedirect[] {
  if (!siteUrl) return [];
  let main: URL;
  try {
    main = new URL(siteUrl);
  } catch {
    return [];
  }

  const hosts = new Set<string>();
  // The vercel.app address, and the other of www / no-www.
  if (productionHost) hosts.add(productionHost.toLowerCase());
  for (const host of extraHosts) hosts.add(host.toLowerCase());
  hosts.add(main.hostname.startsWith("www.") ? main.hostname.slice(4) : `www.${main.hostname}`);
  hosts.delete(main.hostname);

  const origin = main.origin;
  return [...hosts].flatMap((host) => [
    { source: "/", has: [{ type: "host" as const, value: host }], destination: `${origin}/`, statusCode: 301 as const },
    {
      source: "/:path((?!api/).+)",
      has: [{ type: "host" as const, value: host }],
      destination: `${origin}/:path`,
      statusCode: 301 as const,
    },
  ]);
}
