"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { isOwnBlobUrl } from "@/lib/media";
import { isOwnerTipPage } from "@/lib/owner-page";
import { cleanMusicTitle, musicPathPrefix } from "@/lib/page-music";
import { readPageMusic } from "@/lib/page-music-store";

export type PageMusicResult = { status: "ok" } | { status: "error"; message: string };

async function who() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  const db = getDb();
  if (!googleId || !db) return null;
  const [row] = await db<{ id: number; handle: string }[]>`select id, handle from users where google_id = ${googleId} and handle is not null`;
  if (!row || !isOwnerTipPage(row.handle, googleId)) return null;
  return { db, row };
}

async function dropFile(creatorId: number, url: string | null | undefined) {
  if (!url || !isOwnBlobUrl(url, musicPathPrefix(creatorId))) return;
  try {
    await del(url);
  } catch (err) {
    console.error("Could not delete a music file", err);
  }
}

function refresh(handle: string) {
  revalidatePath("/dashboard/effects");
  revalidatePath(`/${handle}`);
}

// Saves the uploaded track (replacing any earlier one, whose file is then deleted). The URL must be
// under the owner's own music folder; anything else is refused.
export async function savePageMusic(input: { url: string; title: string }): Promise<PageMusicResult> {
  const ctx = await who();
  if (!ctx) return { status: "error", message: "Sign in again to change the music." };
  const { db, row } = ctx;
  if (typeof input?.url !== "string" || !isOwnBlobUrl(input.url, musicPathPrefix(row.id))) {
    return { status: "error", message: "That file did not come from the upload." };
  }
  const before = await readPageMusic(row.id);
  const value = { url: input.url, title: cleanMusicTitle(input.title) || "Now playing" };
  try {
    await (db as unknown as LedgerDb)`update users set page_music = ${value as unknown as Record<string, string>}::jsonb where id = ${row.id}`;
  } catch (err) {
    console.error("Could not save the page music (migration 0061 run?)", err);
    return { status: "error", message: "Could not save the track, try again shortly" };
  }
  if (before && before.url !== value.url) await dropFile(row.id, before.url);
  refresh(row.handle);
  return { status: "ok" };
}

export async function removePageMusic(): Promise<PageMusicResult> {
  const ctx = await who();
  if (!ctx) return { status: "error", message: "Sign in again to change the music." };
  const { db, row } = ctx;
  const before = await readPageMusic(row.id);
  try {
    await db`update users set page_music = null where id = ${row.id}`;
  } catch (err) {
    console.error("Could not remove the page music (migration 0061 run?)", err);
    return { status: "error", message: "Could not remove the track, try again shortly" };
  }
  await dropFile(row.id, before?.url);
  refresh(row.handle);
  return { status: "ok" };
}
