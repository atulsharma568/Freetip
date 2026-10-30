"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/owner-auth";
import { getDb } from "@/lib/db";
import type { LedgerDb, SweepResult } from "@/lib/accrual";
import { syncBooks } from "@/lib/books-sync";
import { del } from "@vercel/blob";

type CreatorStatus = "pending" | "active" | "suspended";

export async function setCreatorStatus(
  creatorId: number,
  status: CreatorStatus,
): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;
  if (!(["pending", "active", "suspended"] as const).includes(status)) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  // Sync onboarding_state when changing creator_status:
  //   active   → onboarding_state = 'active'  (completed the gate)
  //   pending  → onboarding_state = 'not_started'  (reset the gate)
  //   suspended → leave onboarding_state unchanged
  if (status === "active") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'active'
      where id = ${creatorId}
    `;
  } else if (status === "pending") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'not_started'
      where id = ${creatorId}
    `;
  } else {
    await db`
      update users set creator_status = ${status} where id = ${creatorId}
    `;
  }

  revalidatePath("/admin/creators");
}

export async function rejectCreatorOnboarding(creatorId: number): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update users set onboarding_state = 'rejected'
    where id = ${creatorId}
      and creator_status = 'pending'
  `;

  revalidatePath("/admin/creators");
}

export async function setMessageHandled(messageId: number, handled: boolean): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(messageId) || messageId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update contact_messages set status = ${handled ? "handled" : "new"} where id = ${messageId}
  `;
  revalidatePath("/admin/messages");
}

// Owner removal of any creator's sound (for example one that breaks the rules).
export async function adminDeleteSound(soundId: number): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(soundId) || soundId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  const rows = await db<{ blob_url: string }[]>`
    delete from creator_sounds where id = ${soundId} returning blob_url
  `;
  if (rows[0]) {
    try {
      await del(rows[0].blob_url);
    } catch (err) {
      console.error("Could not delete sound file", err);
    }
  }
  revalidatePath("/admin/sounds");
}

// Marks a logged word as dealt with (added to the dictionary, or fine as English) so
// it stops showing in /admin/tts-words.
export async function reviewTtsWord(word: string): Promise<void> {
  await requireOwner();

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`update tts_unknown_words set reviewed = true where word = ${word}`;
  revalidatePath("/admin/tts-words");
}

// Removes a word the voice learned by itself, and stops it being learned again.
export async function removeLearnedWord(word: string): Promise<void> {
  await requireOwner();

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`delete from tts_learned_words where word = ${word}`;
  await db`
    insert into tts_unknown_words (word, reviewed, outcome) values (${word}, true, 'removed')
    on conflict (word) do update set reviewed = true, outcome = 'removed'
  `;
  revalidatePath("/admin/tts-words");
}

// What the page shows after the owner presses Sync. Plain data only (it crosses
// from the server to the browser), so dates are ISO strings.
export interface SyncProblem {
  paymentId: string;
  orderId: string | null;
  amountPaise: number;
  method: string | null;
  createdAt: string;
  kind: "unknown_order" | "not_marked_captured";
}

export type SyncReport = {
  check:
    | { ran: true; checked: number; truncated: boolean; problems: SyncProblem[]; backfillable: number }
    | { ran: false; reason: string; detail?: string };
  backfilled: number;
  sweep: SweepResult | null;
};

export type SyncState =
  | { status: "idle" }
  | { status: "done"; report: SyncReport }
  | { status: "error"; message: string };

// The same three steps the daily job runs, on demand: ask Razorpay what it captured
// recently, fill in what the site failed to save for payments it did capture, then
// post every captured live tip that is not on the books yet. Safe to press as often
// as wanted: a tip is posted once, keyed by its Razorpay payment id. It is a
// button (a POST), not a link, because it calls Razorpay and changes the books.
export async function syncBooksNow(): Promise<SyncState> {
  await requireOwner();

  const db = getDb();
  if (!db) return { status: "error", message: "The database is not set up." };

  try {
    const r = await syncBooks(db as unknown as LedgerDb, {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/finance/creators");
    revalidatePath("/admin/finance/payments");
    revalidatePath("/admin/reconciliation");
    const check: SyncReport["check"] = r.check.ok
      ? {
          ran: true,
          checked: r.check.checked,
          truncated: r.check.truncated,
          backfillable: r.check.backfill.length,
          problems: r.check.problems.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
        }
      : { ran: false, reason: r.check.reason, detail: r.check.detail };
    return { status: "done", report: { check, backfilled: r.backfilled, sweep: r.sweep } };
  } catch (err) {
    console.error("Admin: syncing the books failed", err);
    return { status: "error", message: "Could not sync. Has migration 0023 been run?" };
  }
}
