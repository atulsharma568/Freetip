"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { del } from "@vercel/blob";
import { isOwnBlobUrl } from "@/lib/media";
import { checkPicture } from "@/lib/upload-rules";
import { cleanItemName, createDecorItem, isLibraryFile, removeOwnItem, usableBanner } from "@/lib/decor-library";
import type { LedgerDb, Query } from "@/lib/accrual";
import { parsePlacement } from "@/lib/page-doc/decor";
import {
  BANNER_MAX_BYTES,
  bannerPathPrefix,
  fetchChannelBanner,
  fetchChannelPhoto,
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
async function dropBlob(db: Query, url: string | null | undefined) {
  if (!isUploadedBannerUrl(url)) return;
  try {
    // A banner saved in the library stays: the creator may wear it again and it may be shared.
    if (await isLibraryFile(db, url)) return;
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
  await dropBlob(ctx.db as unknown as Query, before);
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
  await dropBlob(ctx.db as unknown as Query, before);
  refresh(ctx.row.handle);
  return { status: "ok", url: null };
}

// Saves a banner the browser has uploaded. The file is fetched and its first bytes checked
// again here, so nothing the page claims about its type or size is trusted: a still picture or
// an animated GIF or WebP, at most 6 MB.
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
    await dropBlob(ctx.db as unknown as Query, input.url);
    return { status: "error", message };
  };

  let bytes: Uint8Array;
  try {
    const res = await fetch(input.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return reject("The uploaded file could not be read back. Try again.");
    if (Number(res.headers.get("content-length") ?? 0) > BANNER_MAX_BYTES) return reject("The picture is over 6 MB.");
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return reject("The uploaded file could not be read back. Try again.");
  }
  const checked = checkPicture("banner", bytes, bytes.length);
  if (!checked.ok) return reject(checked.reason);

  const before = await currentBanner(ctx.db, ctx.row.id);
  // Keep the upload in the creator's library (migration 0063) so it can be worn again and shared. If the
  // library is not there yet the banner still works, as before the library existed.
  try {
    await createDecorItem(ctx.db as unknown as Query, ctx.row.id, {
      kind: "banner",
      name: cleanItemName("Banner"),
      blobUrl: input.url,
      posterUrl: null,
      mime: checked.picture.mime,
      sizeBytes: bytes.length,
      width: checked.picture.width,
      height: checked.picture.height,
      animated: checked.picture.animated,
      placement: parsePlacement(null),
    });
  } catch (err) {
    console.error("Could not add the banner to the library (migration 0063 run?)", err);
  }
  try {
    await ctx.db`update users set tip_banner_url = ${input.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the uploaded banner (migration 0048 run?)", err);
    return reject("Could not save your banner, try again shortly");
  }
  if (before !== input.url) await dropBlob(ctx.db as unknown as Query, before);
  refresh(ctx.row.handle);
  return { status: "ok", url: input.url };
}

// Copies the creator's YouTube channel photo for the tip page, kept apart from the Google
// account photo so signing in again does not undo it.
export async function copyYouTubePhoto(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page photo." };
  if (!hasFeature(ctx.row, "tipBanner")) {
    return { status: "error", message: "The tip page banner is not switched on for your account." };
  }
  const found = await fetchChannelPhoto(ctx.row.yt_channel_id);
  if (!found.ok) {
    const message = {
      "not-configured": "Reading your YouTube photo is not set up on this site yet. Please try again later.",
      "no-channel": "We could not find your YouTube channel. Sign out and sign in again with the channel you stream on.",
      "no-photo": "Your YouTube channel has no profile photo we can use.",
      failed: "Could not reach YouTube just now. Please try again in a minute.",
    }[found.reason];
    return { status: "error", message };
  }
  try {
    await ctx.db`update users set tip_photo_url = ${found.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the tip page photo (migration 0050 run?)", err);
    return { status: "error", message: "Could not save your photo, try again shortly" };
  }
  refresh(ctx.row.handle);
  return { status: "ok", url: found.url };
}

// Goes back to the Google account photo. Allowed even if the switch was turned off since.
export async function removeTipPhoto(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page photo." };
  try {
    await ctx.db`update users set tip_photo_url = null where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not reset the tip page photo (migration 0050 run?)", err);
    return { status: "error", message: "Could not change your photo, try again shortly" };
  }
  refresh(ctx.row.handle);
  return { status: "ok", url: null };
}

// Wears a banner from the library: one the creator uploaded, or one the owner shared with them (an
// active grant). Needs the same paid switch as any banner.
export async function wearBannerItem(input: { itemId: number }): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  if (!hasFeature(ctx.row, "tipBanner")) {
    return { status: "error", message: "The tip page banner is not switched on for your account." };
  }
  if (!Number.isSafeInteger(input.itemId) || input.itemId < 1) return { status: "error", message: "That banner is not valid." };
  const item = await usableBanner(ctx.db as unknown as Query, ctx.row.id, input.itemId).catch(() => null);
  if (!item || !item.url) return { status: "error", message: "That banner is no longer available." };
  const before = await currentBanner(ctx.db, ctx.row.id);
  try {
    await ctx.db`update users set tip_banner_url = ${item.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the tip page banner (migration 0048 run?)", err);
    return { status: "error", message: "Could not save your banner, try again shortly" };
  }
  if (before !== item.url) await dropBlob(ctx.db as unknown as Query, before);
  refresh(ctx.row.handle);
  return { status: "ok", url: item.url };
}

// Deletes one of the creator's own saved banners for good: it stops showing on every page that wears it
// (this one and any it was shared with) and its file is erased.
export async function deleteBannerItem(input: { itemId: number }): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  if (!Number.isSafeInteger(input.itemId) || input.itemId < 1) return { status: "error", message: "That banner is not valid." };
  let urls: string[] = [];
  try {
    const res = await removeOwnItem(ctx.db as unknown as LedgerDb, ctx.row.id, input.itemId);
    if (!res.ok) return { status: "error", message: res.message };
    urls = res.urls;
  } catch (err) {
    console.error("Could not delete the banner (migration 0063 run?)", err);
    return { status: "error", message: "Could not delete that banner, try again shortly" };
  }
  const worn = await currentBanner(ctx.db, ctx.row.id);
  if (worn && urls.includes(worn)) {
    try {
      await ctx.db`update users set tip_banner_url = null where id = ${ctx.row.id}`;
    } catch (err) {
      console.error("Could not clear the deleted banner", err);
    }
  }
  for (const url of urls) {
    try {
      if (isUploadedBannerUrl(url)) await del(url);
    } catch (err) {
      console.error("Could not delete banner file", err);
    }
  }
  refresh(ctx.row.handle);
  return { status: "ok", url: null };
}
