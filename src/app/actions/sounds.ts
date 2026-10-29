"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  MAX_SOUNDS_PER_CREATOR,
  MAX_SOUND_BYTES_PER_CREATOR,
  SOUND_MAX_BYTES,
  cleanSoundEmoji,
  cleanSoundName,
  isOwnSoundUrl,
  parseMinRupees,
  parseVolume,
  parseWav,
} from "@/lib/sounds";

export type SoundActionResult = { status: "ok" } | { status: "error"; message: string };

const DB_DOWN: SoundActionResult = { status: "error", message: "Database unavailable — try again shortly" };

async function currentCreator(): Promise<{ id: number } | null> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: number }[]>`
    select id from users where google_id = ${googleId} and handle is not null
  `;
  return row ?? null;
}

// Best effort: a file we could not remove costs a little storage, nothing else.
async function dropBlob(url: string) {
  try {
    await del(url);
  } catch (err) {
    console.error("Could not delete sound file", err);
  }
}

// Saves a sound after the browser has uploaded its repaired WAV. The file is
// fetched and its header checked again here, and the length comes from that
// header, so nothing the page claims is trusted.
export async function addSound(input: {
  url: string;
  name: string;
  emoji: string;
  minRupees: number;
  volume: number;
  makeDefault: boolean;
}): Promise<SoundActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to add sounds." };
  const db = getDb();
  if (!db) return DB_DOWN;

  // Not our file or not this creator's folder: leave it alone, it may not be theirs to delete.
  if (typeof input.url !== "string" || !isOwnSoundUrl(input.url, creator.id)) {
    return { status: "error", message: "That upload is not valid." };
  }

  const reject = async (message: string): Promise<SoundActionResult> => {
    await dropBlob(input.url);
    return { status: "error", message };
  };

  const name = cleanSoundName(input.name);
  const minRupees = parseMinRupees(input.minRupees);
  const volume = parseVolume(input.volume);
  if (!name) return reject("Give the sound a name.");
  if (minRupees === null) return reject("Minimum tip must be a whole number from ₹0 to ₹10,000.");
  if (volume === null) return reject("Volume must be between 10 and 100.");

  let bytes: Uint8Array;
  try {
    const res = await fetch(input.url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return reject("The uploaded file could not be read back. Try again.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > SOUND_MAX_BYTES) return reject("The file is over 8 MB.");
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return reject("The uploaded file could not be read back. Try again.");
  }
  const wav = parseWav(bytes);
  if (!wav.ok) return reject(wav.reason);

  try {
    const [totals] = await db<{ n: number; bytes: string }[]>`
      select count(*)::int as n, coalesce(sum(size_bytes), 0)::text as bytes
      from creator_sounds where creator_id = ${creator.id}
    `;
    if (totals.n >= MAX_SOUNDS_PER_CREATOR) {
      return reject(`You can keep up to ${MAX_SOUNDS_PER_CREATOR} sounds. Delete one first.`);
    }
    if (Number(totals.bytes) + bytes.length > MAX_SOUND_BYTES_PER_CREATOR) {
      return reject("You have used all your sound storage. Delete a sound first.");
    }

    await db.begin(async (tx) => {
      const [row] = await tx<{ id: number }[]>`
        insert into creator_sounds
          (creator_id, name, emoji, min_paise, volume, blob_url, duration_ms, size_bytes)
        values
          (${creator.id}, ${name}, ${cleanSoundEmoji(input.emoji)}, ${minRupees * 100}, ${volume},
           ${input.url}, ${wav.info.durationMs}, ${bytes.length})
        returning id
      `;
      if (input.makeDefault) {
        await tx`update users set default_sound_id = ${row.id} where id = ${creator.id}`;
      }
    });
  } catch (err) {
    console.error("Could not save sound", err);
    return reject("Could not save the sound — try again shortly");
  }

  revalidatePath("/dashboard/sounds");
  return { status: "ok" };
}

export async function updateSound(
  soundId: number,
  input: { name: string; emoji: string; minRupees: number; volume: number; enabled: boolean },
): Promise<SoundActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change sounds." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(soundId)) return { status: "error", message: "Sound not found." };

  const name = cleanSoundName(input.name);
  const minRupees = parseMinRupees(input.minRupees);
  const volume = parseVolume(input.volume);
  if (!name) return { status: "error", message: "Give the sound a name." };
  if (minRupees === null) {
    return { status: "error", message: "Minimum tip must be a whole number from ₹0 to ₹10,000." };
  }
  if (volume === null) return { status: "error", message: "Volume must be between 10 and 100." };

  try {
    const rows = await db`
      update creator_sounds set
        name = ${name}, emoji = ${cleanSoundEmoji(input.emoji)},
        min_paise = ${minRupees * 100}, volume = ${volume}, enabled = ${!!input.enabled}
      where id = ${soundId} and creator_id = ${creator.id}
      returning id
    `;
    if (!rows.length) return { status: "error", message: "Sound not found." };
  } catch {
    return { status: "error", message: "Could not save the change — try again shortly" };
  }
  revalidatePath("/dashboard/sounds");
  return { status: "ok" };
}

export async function deleteSound(soundId: number): Promise<SoundActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to delete sounds." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(soundId)) return { status: "error", message: "Sound not found." };

  let url: string | undefined;
  try {
    const rows = await db<{ blob_url: string }[]>`
      delete from creator_sounds where id = ${soundId} and creator_id = ${creator.id}
      returning blob_url
    `;
    url = rows[0]?.blob_url;
  } catch {
    return { status: "error", message: "Could not delete the sound — try again shortly" };
  }
  if (!url) return { status: "error", message: "Sound not found." };
  await dropBlob(url);
  revalidatePath("/dashboard/sounds");
  return { status: "ok" };
}

// null = no default: alerts stay silent unless the fan picks a sound.
export async function setDefaultSound(soundId: number | null): Promise<SoundActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change sounds." };
  const db = getDb();
  if (!db) return DB_DOWN;

  try {
    if (soundId === null) {
      await db`update users set default_sound_id = null where id = ${creator.id}`;
    } else {
      if (!Number.isSafeInteger(soundId)) return { status: "error", message: "Sound not found." };
      const rows = await db`
        update users set default_sound_id = ${soundId}
        where id = ${creator.id}
          and exists (select 1 from creator_sounds where id = ${soundId} and creator_id = ${creator.id})
        returning id
      `;
      if (!rows.length) return { status: "error", message: "Sound not found." };
    }
  } catch {
    return { status: "error", message: "Could not save the change — try again shortly" };
  }
  revalidatePath("/dashboard/sounds");
  return { status: "ok" };
}
