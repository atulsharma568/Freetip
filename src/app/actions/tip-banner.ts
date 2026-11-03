"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { del } from "@vercel/blob";
import { checkMediaFile, isOwnBlobUrl } from "@/lib/media";
import {
  BANNER_MAX_BYTES,
  BANNER_UPLOAD_KINDS,
  bannerPathPrefix,
  fetchChannelBanner,
  isUploadedBannerUrl,
  safeBannerUrl,
} from "@/lib/tip-banner";

export type TipBannerActionResult = { status: "ok"; url: string | null } | { status: "error"; message: string };

async function owner() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  const db = getDb();
  if (!googleId || !db) return null;
  const [row] = await db<
    { id: number; handle: string | null; yt_channel_id: string | null; paid_features: string[] | null }[]
  >`select id, handle, yt_channel_id, paid_features from users where google_id = ${googleId} and handle is not null`;
  return row ? { db, row } : null;
}

// Best effort: an uploaded banner we could not remove costs a little storage, nothing else.
async function dropBlob(url: string | null | undefined) {
  if (!isUploadedBannerUrl(url)) return;
  try {
    await del(url);
  } catch (err) {
    console.error("Could not delete banner file", err);
  }
}

async function currentBanner(db: NonNullable<ReturnType<typeof getDb>>, id: number): Promise<string | null> {
  try {
    const [row] = await db<{ tip_banner_url: string | null }[]>`select tip_banner_url from users where id = ${id}`;
    return row?.tip_banner_url ?? null;
  } catch {
    return null;
  }
}

function refresh(handle: string | null) {
  revalidatePath("/dashboard/banner");
  if (handle) revalidatePath(`/${handle}`);
}

// Copies the creator's current YouTube banner. Checked here, not only in the page: the switch,
// then the address through the same rules the tip page applies.
export async function copyYouTubeBanner(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  if (!hasFeature(ctx.row, "tipBanner")) {
    return { status: "error", message: "The tip page banner is not switched on for your account." };
  }
  const found = await fetchChannelBanner(ctx.row.yt_channel_id);
  if (!found.ok) {
    const message = {
      "not-configured": "Reading your YouTube banner is not set up on this site yet. Please try again later.",
      "no-channel": "We could not find your YouTube channel. Sign out and sign in again with the channel you stream on.",
      "no-banner":
        "Your YouTube channel has no banner yet. Add one in YouTube Studio (Customization, Branding), then press the button again.",
      failed: "Could not reach YouTube just now. Please try again in a minute.",
    }[found.reason];
    return { status: "error", message };
  }
  const before = await currentBanner(ctx.db, ctx.row.id);
  try {
    await ctx.db`update users set tip_banner_url = ${found.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the tip page banner (migration 0048 run?)", err);
    return { status: "error", message: "Could not save your banner, try again shortly" };
  }
  await dropBlob(before);
  refresh(ctx.row.handle);
  return { status: "ok", url: found.url };
}

// Takes the banner off the tip page. Allowed even if the switch was turned off since.
export async function removeTipBanner(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  const before = await currentBanner(ctx.db, ctx.row.id);
  try {
    await ctx.db`update users set tip_banner_url = null where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not remove the tip page banner (migration 0048 run?)", err);
    return { status: "error", message: "Could not remove your banner, try again shortly" };
  }
  await dropBlob(before);
  refresh(ctx.row.handle);
  return { status: "ok", url: null };
}

// Saves a banner the browser has uploaded. The file is fetched and its first bytes checked
// again here, so nothing the page claims about its type or size is trusted: a still picture or
// an animated GIF or WebP, at most 3 MB.
export async function saveUploadedBanner(input: { url: string }): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  if (!hasFeature(ctx.row, "tipBanner")) {
    return { status: "error", message: "The tip page banner is not switched on for your account." };
  }
  // Not our file or not this creator's folder: leave it alone, it may not be theirs to delete.
  if (typeof input.url !== "string" || !isOwnBlobUrl(input.url, bannerPathPrefix(ctx.row.id)) || !safeBannerUrl(input.url)) {
    return { status: "error", message: "That upload is not valid." };
  }
  const reject = async (message: string): Promise<TipBannerActionResult> => {
    await dropBlob(input.url);
    return { status: "error", message };
  };

  let bytes: Uint8Array;
  try {
    const res = await fetch(input.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return reject("The uploaded file could not be read back. Try again.");
    if (Number(res.headers.get("content-length") ?? 0) > BANNER_MAX_BYTES) return reject("The picture is over 3 MB.");
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return reject("The uploaded file could not be read back. Try again.");
  }
  const checked = checkMediaFile(bytes, bytes.length);
  if (!checked.ok) return reject(checked.reason);
  if (!BANNER_UPLOAD_KINDS.includes(checked.sniffed.kind)) return reject("A banner must be a picture or a GIF, not a video.");
  if (bytes.length > BANNER_MAX_BYTES) return reject("The picture is over 3 MB.");

  const before = await currentBanner(ctx.db, ctx.row.id);
  try {
    await ctx.db`update users set tip_banner_url = ${input.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the uploaded banner (migration 0048 run?)", err);
    return reject("Could not save your banner, try again shortly");
  }
  if (before !== input.url) await dropBlob(before);
  refresh(ctx.row.handle);
  return { status: "ok", url: input.url };
}
