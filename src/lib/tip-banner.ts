// The creator's YouTube channel banner, shown behind their photo on the tip page (paid feature
// `tipBanner`). Pure except for `fetchChannelBanner`, which takes the fetch function so the
// tests can fake YouTube.
//
// Only an address on Google's image hosts is ever stored or drawn: the value comes from the
// YouTube API, but it is checked again when the page is drawn so a bad row can never point the
// tip page at someone else's server.

const BANNER_HOST_SUFFIXES = [".googleusercontent.com", ".ggpht.com"] as const;
const MAX_URL_LENGTH = 600;
const API = "https://www.googleapis.com/youtube/v3/channels";
const TIMEOUT_MS = 12_000;

// The address to draw, or null when it is missing or not a Google image address.
export function safeBannerUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!BANNER_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s))) return null;
  return url.toString();
}

export type BannerResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not-configured" | "no-channel" | "no-banner" | "failed" };

// Reads the public banner address of a channel (channels.list, brandingSettings; one quota unit).
export async function fetchChannelBanner(
  channelId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
  doFetch: typeof fetch = fetch,
): Promise<BannerResult> {
  if (!env.YT_DATA_API_KEY) return { ok: false, reason: "not-configured" };
  if (!channelId || !/^[\w-]{10,64}$/.test(channelId)) return { ok: false, reason: "no-channel" };
  try {
    const url = new URL(API);
    url.searchParams.set("part", "brandingSettings");
    url.searchParams.set("id", channelId);
    url.searchParams.set("key", env.YT_DATA_API_KEY);
    const res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`YouTube: channels.list (banner) answered ${res.status}.`);
      return { ok: false, reason: "failed" };
    }
    const json = (await res.json()) as {
      items?: { brandingSettings?: { image?: { bannerExternalUrl?: string } } }[];
    };
    const found = json.items?.[0];
    if (!found) return { ok: false, reason: "no-channel" };
    const banner = safeBannerUrl(found.brandingSettings?.image?.bannerExternalUrl);
    return banner ? { ok: true, url: banner } : { ok: false, reason: "no-banner" };
  } catch (err) {
    console.error("YouTube: channels.list (banner) failed.", err);
    return { ok: false, reason: "failed" };
  }
}
