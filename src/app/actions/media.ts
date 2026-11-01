"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import {
  MEDIA_MAX_SIDE,
  MEDIA_WEBM_MAX_BYTES,
  MEDIA_WEBM_MAX_MS,
  checkAllowance,
  checkMediaFile,
  cleanDimension,
  cleanMediaName,
  initialReviewState,
  isOwnBlobUrl,
  mediaPathPrefix,
  parsePlacement,
} from "@/lib/media";

export type MediaActionResult =
  | { status: "ok"; held?: boolean }
  | { status: "error"; message: string };

const DB_DOWN: MediaActionResult = { status: "error", message: "Database unavailable — try again shortly" };
const FEATURE_OFF: MediaActionResult = { status: "error", message: "Custom alert media is not switched on for your account." };

// Whoever is signed in with a claimed handle, with the paid switches that decide
// whether they may add or change files (checked here, not only in the page).
async function currentCreator(): Promise<{ id: number; mediaOn: boolean } | null> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  return row ? { id: Number(row.id), mediaOn: hasFeature(row, "customAlertMedia") } : null;
}

// Best effort: a file we could not remove costs a little storage, nothing else.
async function dropBlob(url: string) {
  try {
    await del(url);
  } catch (err) {
    console.error("Could not delete media file", err);
  }
}

// Saves a file after the browser has uploaded it. The file is fetched and its first
// bytes checked again here, so nothing the page claims about its type or size is
// trusted. A creator's first file waits for the owner's approval; after that, new
// files go live straight away.
export async function addMedia(input: {
  url: string;
  name: string;
  placement: string;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
}): Promise<MediaActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to add files." };
  if (!creator.mediaOn) return FEATURE_OFF;
  const db = getDb();
  if (!db) return DB_DOWN;

  // Not our file or not this creator's folder: leave it alone, it may not be theirs to delete.
  if (typeof input.url !== "string" || !isOwnBlobUrl(input.url, mediaPathPrefix(creator.id))) {
    return { status: "error", message: "That upload is not valid." };
  }

  const reject = async (message: string): Promise<MediaActionResult> => {
    await dropBlob(input.url);
    return { status: "error", message };
  };

  const name = cleanMediaName(input.name);
  const placement = parsePlacement(input.placement);
  if (!name) return reject("Give the file a name.");
  if (!placement) return reject("Pick where it shows on the alert.");

  let bytes: Uint8Array;
  try {
    const res = await fetch(input.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return reject("The uploaded file could not be read back. Try again.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MEDIA_WEBM_MAX_BYTES) return reject("The file is over 8 MB.");
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return reject("The uploaded file could not be read back. Try again.");
  }
  const checked = checkMediaFile(bytes, bytes.length);
  if (!checked.ok) return reject(checked.reason);
  const { sniffed } = checked;

  // A WebM's length cannot be read cheaply here, so the browser's measurement is kept
  // when it is sane, a claim over the cap is turned down, and the overlay stops
  // playback at the cap whatever the file says.
  let durationMs: number | null = null;
  if (sniffed.kind === "webm") {
    if (typeof input.durationMs === "number" && input.durationMs > MEDIA_WEBM_MAX_MS) {
      return reject("A WebM can be at most 10 seconds.");
    }
    durationMs = cleanDimension(input.durationMs, MEDIA_WEBM_MAX_MS + 50);
  }
  const width = sniffed.width ?? cleanDimension(input.width, MEDIA_MAX_SIDE);
  const height = sniffed.height ?? cleanDimension(input.height, MEDIA_MAX_SIDE);

  try {
    const [have] = await db<{ files: number; bytes: string; approved: number }[]>`
      select count(*)::int as files, coalesce(sum(size_bytes), 0)::text as bytes,
             count(*) filter (where review_state = 'approved')::int as approved
      from creator_media
      where creator_id = ${creator.id} and review_state <> 'removed'
    `;
    const full = checkAllowance({ files: have.files, bytes: Number(have.bytes) }, bytes.length);
    if (full) return reject(`${full} Delete a file first.`);

    const state = initialReviewState(have.approved);
    await db`
      insert into creator_media
        (creator_id, kind, name, blob_url, mime, size_bytes, duration_ms, width, height, placement, review_state)
      values
        (${creator.id}, ${sniffed.kind}, ${name}, ${input.url}, ${sniffed.mime}, ${bytes.length},
         ${durationMs}, ${width}, ${height}, ${placement}, ${state})
    `;
    revalidatePath("/dashboard/media");
    return { status: "ok", held: state === "new" };
  } catch (err) {
    console.error("Could not save media", err);
    return reject("Could not save the file — try again shortly");
  }
}

export async function updateMedia(
  mediaId: number,
  input: { name: string; placement: string; enabled: boolean },
): Promise<MediaActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change files." };
  if (!creator.mediaOn) return FEATURE_OFF;
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(mediaId)) return { status: "error", message: "File not found." };

  const name = cleanMediaName(input.name);
  const placement = parsePlacement(input.placement);
  if (!name) return { status: "error", message: "Give the file a name." };
  if (!placement) return { status: "error", message: "Pick where it shows on the alert." };

  try {
    // A file the owner took down stays down: it cannot be switched back on.
    const rows = await db`
      update creator_media set name = ${name}, placement = ${placement}, enabled = ${!!input.enabled}
      where id = ${mediaId} and creator_id = ${creator.id} and review_state <> 'removed'
      returning id
    `;
    if (!rows.length) return { status: "error", message: "File not found." };
  } catch {
    return { status: "error", message: "Could not save the change — try again shortly" };
  }
  revalidatePath("/dashboard/media");
  return { status: "ok" };
}

// Always allowed, even when the feature is switched off, so a creator can clear their files.
export async function deleteMedia(mediaId: number): Promise<MediaActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to delete files." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(mediaId)) return { status: "error", message: "File not found." };

  let url: string | undefined;
  try {
    const rows = await db<{ blob_url: string }[]>`
      delete from creator_media where id = ${mediaId} and creator_id = ${creator.id}
      returning blob_url
    `;
    url = rows[0]?.blob_url;
  } catch {
    return { status: "error", message: "Could not delete the file — try again shortly" };
  }
  if (!url) return { status: "error", message: "File not found." };
  await dropBlob(url);
  revalidatePath("/dashboard/media");
  return { status: "ok" };
}
