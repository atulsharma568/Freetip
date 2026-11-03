"use server";

import { revalidatePath } from "next/cache";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import { discardOverlayDraft, publishOverlay, saveOverlayDraft, swapOverlay, type OverlayResult, type SaveResult } from "@/lib/overlay-doc/store";

// The owner's controls for a creator's OBS overlays (page builder phase 5, part two): save the
// draft, publish it to the live alert and goal bar, swap with the previous version, or throw the
// draft away. Each one re-checks the owner, the id and the creator's "Custom tip page" switch (in
// the store) itself: a hidden button is not a lock. Publish and swap each write one audit row in
// the same transaction (creator.overlay_published, creator.overlay_swapped); saving a draft does
// not. They return plain data to the editor, not form state.
const validId = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= 2147483647;
const MISSING = "Has migration 0053 been run?";

async function run(creatorId: number, change: (db: LedgerDb, id: number) => Promise<OverlayResult>, failure: string): Promise<OverlayResult> {
  await requireOwner();
  if (!validId(creatorId)) return { ok: false, message: "That request is not valid." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not set up." };
  try {
    const result = await change(db as unknown as LedgerDb, creatorId);
    if (result.ok) await refresh(creatorId);
    return result;
  } catch (err) {
    console.error("Admin: could not change the overlays (migration 0053 run?)", err);
    return { ok: false, message: failure };
  }
}

// Tells the pages that show this change to read it again. The overlays themselves read the
// database on every poll, so only the owner's own pages need the nudge.
async function refresh(creatorId: number) {
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath(`/admin/creators/${creatorId}/overlays`);
  revalidatePath("/admin/audit");
}

// Saves the draft. `base` is the draft the editor last received and `next` the new one (both come
// from the browser, so they are checked as untrusted: the store shapes `next` and matches `base`).
export async function saveOverlays(creatorId: number, base: unknown, next: unknown): Promise<SaveResult> {
  await requireOwner();
  if (!validId(creatorId)) return { ok: false, message: "That request is not valid.", conflict: false };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not set up.", conflict: false };
  try {
    return await saveOverlayDraft(db as unknown as LedgerDb, creatorId, base ?? null, next);
  } catch (err) {
    console.error("Admin: could not save the overlay draft (migration 0053 run?)", err);
    return { ok: false, message: `Could not save. ${MISSING}`, conflict: false };
  }
}

// Publishes the saved draft. The next alert and the goal bar use it at once.
export async function publishOverlays(creatorId: number): Promise<OverlayResult> {
  return run(creatorId, publishOverlay, `Could not publish. ${MISSING}`);
}

// Puts the previous live values back; doing it again swaps back.
export async function swapOverlays(creatorId: number): Promise<OverlayResult> {
  return run(creatorId, swapOverlay, `Could not swap. ${MISSING}`);
}

// Throws the saved draft away, so the editor starts again from what is live.
export async function discardOverlays(creatorId: number): Promise<OverlayResult> {
  return run(creatorId, discardOverlayDraft, `Could not discard the draft. ${MISSING}`);
}
