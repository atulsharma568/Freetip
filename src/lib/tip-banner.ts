// The banner behind the creator's photo on the tip page (paid feature `tipBanner`): either their
// YouTube channel banner or a picture they upload (a still image or an animated GIF or WebP).
// Pure except for `fetchChannelBanner`, which takes the fetch function so the
// tests can fake YouTube.
//
// Only an address on Google's image hosts (a YouTube banner) or in our own Blob store under the
// banner folder (an upload) is ever stored or drawn: it is checked again when the page is drawn,
// so a bad row can never point the tip page at someone else's server.
import { BLOB_HOST_SUFFIX, type MediaKind } from "./media";

// Bigger than an alert picture (3 MB) because an animated banner is a wide GIF or WebP.
export const BANNER_MAX_BYTES = 6 * 1024 * 1024;
export const BANNER_UPLOAD_KINDS: readonly MediaKind[] = ["gif", "image"];
export const BANNER_UPLOAD_TYPES = ["image/gif", "image/png", "image/jpeg", "image/webp"] as const;

// Where a creator's uploaded banners live; the upload route only issues a token under it.
export const bannerPathPrefix = (creatorId: number) => `banners/${creatorId}/`;

// An address in our own Blob store, under any creator's banner folder.
export function isUploadedBannerUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    return new URL(raw).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

const BANNER_HOST_SUFFIXES = [".googleusercontent.com", ".ggpht.com"] as const;
const MAX_URL_LENGTH = 600;
const API = "https://www.googleapis.com/youtube/v3/channels";
const TIMEOUT_MS = 12_000;

// The address to draw, or null when it is missing or not an allowed one.
export function safeBannerUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.hostname.endsWith(BLOB_HOST_SUFFIX)) {
    return /^\/banners\/\d+\/[\w.-]+$/.test(url.pathname) && !url.pathname.includes("..") ? url.toString() : null;
  }
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

// The channel photo is only ever one of Google's image hosts (never one of our uploads).
export function safePhotoUrl(raw: unknown): string | null {
  const url = safeBannerUrl(raw);
  if (!url) return null;
  return BANNER_HOST_SUFFIXES.some((s) => new URL(url).hostname.endsWith(s)) ? url : null;
}

export type PhotoResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not-configured" | "no-channel" | "no-photo" | "failed" };

// Reads the public profile picture of a channel (channels.list, snippet; one quota unit).
export async function fetchChannelPhoto(
  channelId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
  doFetch: typeof fetch = fetch,
): Promise<PhotoResult> {
  if (!env.YT_DATA_API_KEY) return { ok: false, reason: "not-configured" };
  if (!channelId || !/^[\w-]{10,64}$/.test(channelId)) return { ok: false, reason: "no-channel" };
  try {
    const url = new URL(API);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", channelId);
    url.searchParams.set("key", env.YT_DATA_API_KEY);
    const res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`YouTube: channels.list (photo) answered ${res.status}.`);
      return { ok: false, reason: "failed" };
    }
    const json = (await res.json()) as {
      items?: { snippet?: { thumbnails?: Record<string, { url?: string }> } }[];
    };
    const found = json.items?.[0];
    if (!found) return { ok: false, reason: "no-channel" };
    const t = found.snippet?.thumbnails;
    const photo = safePhotoUrl(t?.high?.url ?? t?.medium?.url ?? t?.default?.url);
    return photo ? { ok: true, url: photo } : { ok: false, reason: "no-photo" };
  } catch (err) {
    console.error("YouTube: channels.list (photo) failed.", err);
    return { ok: false, reason: "failed" };
  }
}
