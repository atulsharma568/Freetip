"use server";

import { del } from "@vercel/blob";
import type { LedgerDb, Query } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { cleanDimension, cleanMediaName, isOwnBlobUrl, MEDIA_MAX_SIDE } from "@/lib/media";
import { requireOwner } from "@/lib/owner-auth";
import { ASSET_LIMITS, checkAssetFile, checkPosterFile, cleanDuration, needsPoster, pageAssetPrefix } from "@/lib/page-doc/assets";
import { insertAsset, listAssets, referencedUrls, removeAsset, type AssetListItem } from "@/lib/page-doc/asset-store";

// The owner's actions for the pictures of a creator's tip page (page builder phase 3). Each one
// re-checks the owner, the id and (in the store) the creator's "Custom tip page" switch itself: a
// hidden button is not a lock. Files go from the browser to Blob first; here they are read back and
// checked from their first bytes, so nothing the browser claims about a file is trusted, and a file
// that is refused is deleted.

export type PageAssetResult = { ok: true; assets: AssetListItem[]; id?: number } | { ok: false; message: string };

const fail = (message: string): PageAssetResult => ({ ok: false, message });
const validId = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= 2147483647;

// Best effort: a file we could not remove costs a little storage, nothing else. A file that a live
// row already points at is never deleted here (a retried or doubled upload names the same file as
// the first save), only files nobody points at.
async function dropBlobs(db: Query | null, urls: (string | null | undefined)[]) {
  let list = urls.filter((u): u is string => typeof u === "string" && u !== "");
  if (list.length === 0) return;
  try {
    if (db) {
      const keep = await referencedUrls(db, list);
      list = list.filter((u) => !keep.has(u));
    }
    if (list.length > 0) await del(list);
  } catch (err) {
    console.error("Could not delete page files", err);
  }
}

async function readBack(url: string, maxBytes: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > maxBytes) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > maxBytes ? null : bytes;
  } catch {
    return null;
  }
}

export async function addPageAsset(
  creatorId: number,
  input: { url: string; posterUrl?: string | null; name: string; durationMs?: number | null; width?: number | null; height?: number | null },
): Promise<PageAssetResult> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail("The database is not set up.");
  const query = db as unknown as Query;

  // Only an address in our own store under this creator's page folder is ever fetched or deleted:
  // anything else may not be ours to delete.
  const prefix = pageAssetPrefix(creatorId);
  const url = typeof input?.url === "string" && isOwnBlobUrl(input.url, prefix) ? input.url : null;
  const claimedPoster = typeof input?.posterUrl === "string" && input.posterUrl !== "" ? input.posterUrl : null;
  const posterUrl = claimedPoster && isOwnBlobUrl(claimedPoster, prefix) ? claimedPoster : null;
  if (!url || (claimedPoster && !posterUrl)) {
    await dropBlobs(query, [url, posterUrl]);
    return fail("That upload is not valid.");
  }
  const reject = async (message: string): Promise<PageAssetResult> => {
    await dropBlobs(query, [url, posterUrl]);
    return fail(message);
  };

  const name = cleanMediaName(input.name);
  if (!name) return reject("Give the file a name.");

  const bytes = await readBack(url, 8 * 1024 * 1024);
  if (!bytes) return reject("The uploaded file could not be read back, or it is over 8 MB. Try again.");
  const checked = checkAssetFile(bytes, bytes.length);
  if (!checked.ok) return reject(checked.reason);
  const { sniffed } = checked;

  // An animated file needs the still picture of its first frame, a picture does not want one.
  let posterBytes: number | null = null;
  let keepPoster: string | null = null;
  if (needsPoster(sniffed.kind)) {
    if (!posterUrl) return reject("The browser could not make a still picture of the first frame, so this file was not added.");
    const poster = await readBack(posterUrl, ASSET_LIMITS.posterBytes);
    if (!poster) return reject("The still picture of the first frame could not be read back or is too big. Try again.");
    const posterChecked = checkPosterFile(poster, poster.length);
    if (!posterChecked.ok) return reject(posterChecked.reason);
    posterBytes = poster.length;
    keepPoster = posterUrl;
  } else if (posterUrl) {
    await dropBlobs(query, [posterUrl]);
  }

  // A video's length cannot be read cheaply here: the browser measured it, a claim over the cap is
  // turned down, and a clip with no sane length is refused.
  let durationMs: number | null = null;
  if (sniffed.kind === "webm") {
    if (typeof input.durationMs === "number" && input.durationMs > ASSET_LIMITS.webmMs) {
      return reject(`A video can be at most ${ASSET_LIMITS.webmMs / 1000} seconds.`);
    }
    durationMs = cleanDuration(input.durationMs);
    if (durationMs === null) return reject("The length of the video could not be read.");
  }
  const width = sniffed.width ?? cleanDimension(input.width, MEDIA_MAX_SIDE);
  const height = sniffed.height ?? cleanDimension(input.height, MEDIA_MAX_SIDE);

  try {
    const saved = await insertAsset(db as unknown as LedgerDb, creatorId, {
      kind: sniffed.kind,
      name,
      blobUrl: url,
      posterUrl: keepPoster,
      mime: sniffed.mime,
      sizeBytes: bytes.length,
      posterBytes,
      width,
      height,
      durationMs,
    });
    if (!saved.ok) return reject(saved.message);
    return { ok: true, id: saved.id, assets: await listAssets(db as unknown as LedgerDb, creatorId) };
  } catch (err) {
    console.error("Admin: could not save a page file (migration 0052 run?)", err);
    return reject("Could not save the file. Has migration 0052 been run?");
  }
}

// Takes a file out of the library, refused while a stored page still uses it.
export async function removePageAsset(creatorId: number, assetId: number): Promise<PageAssetResult> {
  await requireOwner();
  if (!validId(creatorId) || !validId(assetId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail("The database is not set up.");
  try {
    const removed = await removeAsset(db as unknown as LedgerDb, creatorId, assetId);
    if (!removed.ok) return fail(removed.message);
    await dropBlobs(null, removed.urls);
    return { ok: true, assets: await listAssets(db as unknown as LedgerDb, creatorId) };
  } catch (err) {
    console.error("Admin: could not remove a page file (migration 0052 run?)", err);
    return fail("Could not remove the file. Has migration 0052 been run?");
  }
}
