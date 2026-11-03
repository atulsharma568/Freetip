"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import type { LedgerDb } from "@/lib/accrual";
import { FAN_NOTE_MAX, deleteFan } from "@/lib/fan-profiles";

export type FanActionResult = { status: "ok" } | { status: "error"; message: string };

const DB_DOWN: FanActionResult = { status: "error", message: "Database unavailable — try again shortly" };

async function currentCreator() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  return row ? { id: Number(row.id), row } : null;
}

const KEY = /^[0-9a-f]{64}$/;

// A private note on one of the creator's own fans.
export async function saveFanNote(fanKey: string, note: string): Promise<FanActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to save." };
  if (!hasFeature(creator.row, "fanCrm")) return { status: "error", message: "The fan list is not switched on for your account." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (typeof fanKey !== "string" || !KEY.test(fanKey) || typeof note !== "string") {
    return { status: "error", message: "That fan was not found." };
  }
  const cleaned = note.trim();
  if (cleaned.length > FAN_NOTE_MAX) return { status: "error", message: `Keep the note under ${FAN_NOTE_MAX} characters.` };
  try {
    const rows = await db<{ fan_key: string }[]>`
      update fan_profiles set note = ${cleaned || null}
       where creator_id = ${creator.id} and fan_key = ${fanKey} returning fan_key
    `;
    if (!rows.length) return { status: "error", message: "That fan was not found." };
  } catch (err) {
    console.error("Fan note: could not save (migration 0038 run?)", err);
    return DB_DOWN;
  }
  revalidatePath("/dashboard/fans");
  return { status: "ok" };
}

// Deletes a fan's profile, the tips counted for them and .
export async function deleteFanProfile(fanKey: string): Promise<FanActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to delete." };
  if (!hasFeature(creator.row, "fanCrm")) return { status: "error", message: "The fan list is not switched on for your account." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (typeof fanKey !== "string" || !KEY.test(fanKey)) return { status: "error", message: "That fan was not found." };
  try {
    const { deleted } = await deleteFan(db as unknown as LedgerDb, creator.id, fanKey);
    if (!deleted) return { status: "error", message: "That fan was not found." };
  } catch (err) {
    console.error("Fan delete failed (migration 0038 run?)", err);
    return DB_DOWN;
  }
  revalidatePath("/dashboard/fans");
  return { status: "ok" };
}
