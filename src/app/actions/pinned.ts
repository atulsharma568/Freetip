"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { parsePinSettings } from "@/lib/pinned";
import { pinAgain, unpinAll } from "@/lib/pinned-db";
import type { LedgerDb } from "@/lib/accrual";

// Dashboard actions for paid highlighted messages. The creator's switch is checked here on
// the server each time, not only where the buttons are drawn.

export type PinnedActionResult = { status: "ok"; message: string } | { status: "error"; message: string };

async function creatorWithFeature() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { ok: false, error: "Sign in again to do that." } as const;
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable — try again shortly" } as const;
  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  if (!row) return { ok: false, error: "Sign in again to do that." } as const;
  if (!hasFeature(row, "highlightedMessages")) return { ok: false, error: "Pinned messages are not switched on for your account." } as const;
  return { ok: true, db, id: Number(row.id) } as const;
}

// The smallest tip that can pin a message (empty turns the offer off) and how long it stays.
export async function savePinSettings(rupees: string, seconds: string): Promise<PinnedActionResult> {
  const who = await creatorWithFeature();
  if (!who.ok) return { status: "error", message: who.error };
  const parsed = parsePinSettings(rupees, seconds);
  if (!parsed.ok) return { status: "error", message: parsed.message };
  try {
    await who.db`
      update users set highlight_min_paise = ${parsed.minPaise}, highlight_seconds = ${parsed.seconds}
      where id = ${who.id}
    `;
  } catch (err) {
    console.error("Could not save the pinned message settings (migration 0040 run?)", err);
    return { status: "error", message: "Could not save — try again shortly" };
  }
  revalidatePath("/dashboard/pinned");
  return {
    status: "ok",
    message: parsed.minPaise === null ? "Saved. Fans are no longer offered pinned messages." : "Saved. Fans can now pin a message.",
  };
}

// Takes the pinned message down at once. The OBS card clears on its next check (a few
// seconds). The tip stays final.
export async function unpinNow(): Promise<PinnedActionResult> {
  const who = await creatorWithFeature();
  if (!who.ok) return { status: "error", message: who.error };
  const res = await unpinAll(who.db as unknown as LedgerDb, who.id);
  if (!res.ok) return { status: "error", message: res.message };
  revalidatePath("/dashboard/pinned");
  return {
    status: "ok",
    message: res.count ? "Taken down. The card clears in OBS within a few seconds." : "Nothing was pinned.",
  };
}

export async function pinMessageAgain(tipId: number): Promise<PinnedActionResult> {
  const who = await creatorWithFeature();
  if (!who.ok) return { status: "error", message: who.error };
  if (!Number.isSafeInteger(tipId)) return { status: "error", message: "That message can no longer be pinned." };
  const res = await pinAgain(who.db as unknown as LedgerDb, who.id, tipId);
  if (!res.ok) return { status: "error", message: res.message };
  revalidatePath("/dashboard/pinned");
  return { status: "ok", message: "Pinned again. It shows in OBS within a few seconds." };
}
