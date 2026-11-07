"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { checkMediaFile, isOwnBlobUrl } from "@/lib/media";
import { createDecorItem, listCreatorDecor, removeOwnItem, updateOwnItem, usableItem, type DecorItem } from "@/lib/decor-library";
import { checkPicture, type UploadRuleKind } from "@/lib/upload-rules";
import { isOwnerTipPage } from "@/lib/owner-page";
import {
  DECOR_POSTER_MAX_BYTES,
  DECOR_UPLOAD_KINDS,
  DECOR_UPLOAD_MAX_BYTES,
  clampFrameScale,
  decorPathPrefix,
  isTipTemplate,
  mayPickTipDecor,
  mayUseTemplate,
  parsePlacement,
  parseTipDecor,
  safeDecorUrl,
  type DecorUploadKind,
} from "@/lib/page-doc/decor";
import { readTipDecor } from "@/lib/tip-decor-store";

export type TipDecorActionResult = { status: "ok" } | { status: "error"; message: string };
export type DecorUploadResult = { status: "ok"; item: DecorItem } | { status: "error"; message: string };
export type DecorLibraryResult = { status: "ok"; mine: DecorItem[]; shared: DecorItem[] } | { status: "error"; message: string };

const SIGN_IN = "Sign in again to change your photo and banner effects.";

async function who() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { ok: false, error: SIGN_IN } as const;
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable, try again shortly" } as const;
  const [row] = await db<{ id: number; handle: string; paid_features: string[] | null }[]>`select id, handle, paid_features from users where google_id = ${googleId} and handle is not null`;
  if (!row) return { ok: false, error: SIGN_IN } as const;
  if (!mayPickTipDecor(isOwnerTipPage(row.handle, googleId), row)) return { ok: false, error: "Photo and banner effects are not switched on for your account." } as const;
  return { ok: true, db, row, googleId } as const;
}

// The driver writes an object as jsonb. Only the keys given are changed: the rest of what is stored
// (the uploads, when a pick is saved; the pick, when an upload is saved) stays as it is.
async function mergeDecor(db: NonNullable<ReturnType<typeof getDb>>, id: number, patch: Record<string, unknown>) {
  await (db as unknown as LedgerDb)`update users set tip_decor = coalesce(tip_decor, '{}'::jsonb) || ${patch as unknown as Record<string, string>}::jsonb where id = ${id}`;
}

function refresh(handle: string) {
  revalidatePath("/dashboard/effects");
  revalidatePath(`/${handle}`);
}

// Best effort: a file we could not remove costs a little storage, nothing else.
async function dropBlobs(creatorId: number, ...urls: (string | null | undefined)[]) {
  for (const u of urls) {
    if (!u || !isOwnBlobUrl(u, decorPathPrefix(creatorId))) continue;
    try {
      await del(u);
    } catch (err) {
      console.error("Could not delete a decor file", err);
    }
  }
}

// Saves the pick of the profile picture, the frame over the photo, the effect over the banner and the
// animated banner picture. Checked here, not only in the page: only the owner's own page and a creator
// with "Photo frame and banner effects" switched on have it, and each choice must be one of the
// ready-made looks (anything else would be stored as "none", so it is refused instead). The pictures
// the creator uploaded are not touched.
export async function saveTipDecor(input: { avatar: string; frame: string; bannerFx: string; bannerPic: string; frameScale?: number }): Promise<TipDecorActionResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const { db, row } = ctx;

  const parsed = parseTipDecor(input);
  if (!parsed || parsed.avatar !== input.avatar || parsed.frame !== input.frame || parsed.bannerFx !== input.bannerFx || parsed.bannerPic !== input.bannerPic) {
    return { status: "error", message: "That is not one of the looks on offer." };
  }
  try {
    await mergeDecor(db, row.id, {
      avatar: parsed.avatar,
      frame: parsed.frame,
      bannerFx: parsed.bannerFx,
      bannerPic: parsed.bannerPic,
      ...(input.frameScale === undefined ? {} : { frameScale: clampFrameScale(input.frameScale) }),
    });
  } catch (err) {
    console.error("Could not save the photo frame and banner effect (migration 0058 run?)", err);
    return { status: "error", message: "Could not save your choice, try again shortly" };
  }
  refresh(row.handle);
  return { status: "ok" };
}

// Saves the look template (Classic, Deadpool, ...). Only this key is written, so the picks and uploads
// of the Classic look stay exactly as they were and come back when Classic is chosen again.
export async function saveTipTemplate(input: { template: string }): Promise<TipDecorActionResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  if (!isTipTemplate(input.template)) return { status: "error", message: "That is not one of the templates on offer." };
  // Deadpool is the owner's (AcePressure) template, or a paid feature the owner switched on for the creator.
  if (!mayUseTemplate(isOwnerTipPage(ctx.row.handle, ctx.googleId), ctx.row, input.template)) return { status: "error", message: "That template is not available for your account yet." };
  try {
    await mergeDecor(ctx.db, ctx.row.id, { template: input.template });
  } catch (err) {
    console.error("Could not save the template (migration 0058 run?)", err);
    return { status: "error", message: "Could not save your choice, try again shortly" };
  }
  refresh(ctx.row.handle);
  return { status: "ok" };
}

async function fetchBytes(url: string, limit: number): Promise<Uint8Array | string> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return "The uploaded file could not be read back. Try again.";
    if (Number(res.headers.get("content-length") ?? 0) > limit) return "That file is too big.";
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return "The uploaded file could not be read back. Try again.";
  }
}

// Saves a profile picture or a decoration the browser has uploaded into the creator's library. The file
// is fetched and checked again here against the same rules the page showed (src/lib/upload-rules.ts:
// format, 3 MB, size in pixels, shape, see-through for a decoration), so nothing the page claims about
// its type or size is trusted. It is only saved to the library: the creator then places it and presses
// "Save to my tip page" (wearDecorItem) to wear it.
export async function saveDecorUpload(input: { kind: string; url: string; posterUrl?: string | null; name?: string }): Promise<DecorUploadResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const { db, row } = ctx;
  const kind = DECOR_UPLOAD_KINDS.find((k) => k === input.kind) as DecorUploadKind | undefined;
  if (!kind) return { status: "error", message: "That upload is not valid." };

  const prefix = decorPathPrefix(row.id);
  const own = (u: unknown, name: string) => typeof u === "string" && isOwnBlobUrl(u, prefix) && !!safeDecorUrl(u) && new URL(u).pathname.slice(prefix.length + 1).startsWith(`${name}-`);  // the store adds "-<random>" to the name the browser chose
  if (!own(input.url, kind)) return { status: "error", message: "That upload is not valid." };
  const posterUrl = input.posterUrl && own(input.posterUrl, "poster") ? input.posterUrl : null;
  const reject = async (message: string): Promise<DecorUploadResult> => {
    await dropBlobs(row.id, input.url, posterUrl);
    return { status: "error", message };
  };

  const bytes = await fetchBytes(input.url, DECOR_UPLOAD_MAX_BYTES);
  if (typeof bytes === "string") return reject(bytes);
  const rule: UploadRuleKind = kind === "frame" ? "decorFrame" : "decorAvatar";
  const checked = checkPicture(rule, bytes, bytes.length);
  if (!checked.ok) return reject(checked.reason);
  const { picture } = checked;

  let poster: string | null = null;
  if (posterUrl) {
    const pb = await fetchBytes(posterUrl, DECOR_POSTER_MAX_BYTES);
    const pc = typeof pb === "string" ? null : checkMediaFile(pb, pb.length, DECOR_POSTER_MAX_BYTES);
    if (pc && pc.ok && pc.sniffed.kind === "image") poster = posterUrl;
    else await dropBlobs(row.id, posterUrl);
  }

  try {
    const id = await createDecorItem(db as unknown as LedgerDb, row.id, {
      kind,
      name: input.name ?? new URL(input.url).pathname.split("/").pop() ?? "Picture",
      blobUrl: input.url,
      posterUrl: poster,
      mime: picture.mime,
      sizeBytes: bytes.length,
      width: picture.width,
      height: picture.height,
      animated: picture.animated,
      placement: parsePlacement(null),
    });
    const item = await usableItem(db as unknown as LedgerDb, row.id, id);
    if (!item) return reject("Could not save your picture, try again shortly");
    revalidatePath("/dashboard/effects");
    return { status: "ok", item };
  } catch (err) {
    console.error("Could not save the uploaded picture (migration 0062 run?)", err);
    return reject("Could not save your picture, try again shortly");
  }
}

// What the creator can pick from: their own saved pictures and those the owner granted them.
export async function listDecorLibrary(): Promise<DecorLibraryResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  try {
    return { status: "ok", ...(await listCreatorDecor(ctx.db as unknown as LedgerDb, ctx.row.id)) };
  } catch (err) {
    console.error("Could not list the saved pictures (migration 0062 run?)", err);
    return { status: "error", message: "Could not load your saved pictures, try again shortly" };
  }
}

// "Save to my tip page": wears one picture of the library (the creator's own or one granted to them) on
// their page, with the placement they chose. The item must be usable by this creator right now. A
// profile picture takes the photo's place; a decoration keeps its anchor, size and nudge. The choice
// replaces the ready-made look of the same layer.
export async function wearDecorItem(input: { itemId: number; placement?: unknown }): Promise<TipDecorActionResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const { db, row } = ctx;
  if (!Number.isSafeInteger(input.itemId) || input.itemId < 1) return { status: "error", message: "That picture was not found." };
  try {
    const item = await usableItem(db as unknown as LedgerDb, row.id, input.itemId);
    if (!item) return { status: "error", message: "That picture is not available to you." };
    const placement = parsePlacement(input.placement ?? item.placement);
    const worn = { url: item.url, posterUrl: item.posterUrl, animated: item.animated, itemId: item.id, placement };
    await mergeDecor(db, row.id, {
      [item.kind === "avatar" ? "avatarUpload" : "frameUpload"]: worn,
      [item.kind === "avatar" ? "avatar" : "frame"]: "none",
    });
    // Remember the placement on the creator's own item, so reusing it later starts where it was left.
    if (item.kind === "frame" && item.creatorId === row.id) await updateOwnItem(db as unknown as LedgerDb, row.id, item.id, { placement });
  } catch (err) {
    console.error("Could not save the chosen picture (migration 0062 run?)", err);
    return { status: "error", message: "Could not save your choice, try again shortly" };
  }
  refresh(row.handle);
  return { status: "ok" };
}

// Takes the worn profile picture or decoration off the page. The picture stays in the library.
export async function removeDecorUpload(input: { kind: string }): Promise<TipDecorActionResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const { db, row } = ctx;
  const kind = DECOR_UPLOAD_KINDS.find((k) => k === input.kind) as DecorUploadKind | undefined;
  if (!kind) return { status: "error", message: "That is not a picture you can remove." };
  try {
    await mergeDecor(db, row.id, { [kind === "avatar" ? "avatarUpload" : "frameUpload"]: null });
  } catch (err) {
    console.error("Could not take the picture off the page", err);
    return { status: "error", message: "Could not remove your picture, try again shortly" };
  }
  refresh(row.handle);
  return { status: "ok" };
}

// Deletes one of the creator's own saved pictures for good: it stops showing on every page that wears it
// (theirs, and any page the owner shared it with), and its files are erased. A shared picture that
// belongs to someone else cannot be deleted here (use "Take off my page").
export async function deleteDecorItem(input: { itemId: number }): Promise<TipDecorActionResult> {
  const ctx = await who();
  if (!ctx.ok) return { status: "error", message: ctx.error };
  const { db, row } = ctx;
  if (!Number.isSafeInteger(input.itemId) || input.itemId < 1) return { status: "error", message: "That picture was not found." };
  let urls: string[] = [];
  try {
    const res = await removeOwnItem(db as unknown as LedgerDb, row.id, input.itemId);
    if (!res.ok) return { status: "error", message: res.message };
    urls = res.urls;
    const before = await readTipDecor(row.id);
    for (const [key, up] of [["avatarUpload", before?.avatarUpload], ["frameUpload", before?.frameUpload]] as const) {
      if (up?.itemId === input.itemId) await mergeDecor(db, row.id, { [key]: null });
    }
  } catch (err) {
    console.error("Could not delete the saved picture (migration 0062 run?)", err);
    return { status: "error", message: "Could not delete your picture, try again shortly" };
  }
  await dropBlobs(row.id, ...urls);
  refresh(row.handle);
  return { status: "ok" };
}
