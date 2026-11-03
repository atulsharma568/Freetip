"use server";

import { revalidatePath } from "next/cache";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import type { AdminActionState } from "@/lib/admin/action-state";
import { resetPage, restorePrevious, type PageResult } from "@/lib/page-doc/store";

// The owner's controls for a creator's custom tip page (page builder phase 1): put the previous
// version back, or go back to the normal page. Publishing comes with the editor in phase 2.
// Each one re-checks the owner, the id and the creator's "Custom tip page" switch (in the store)
// itself: a hidden button is not a lock. Each change writes one audit row in the same
// transaction (creator.page_restored, creator.page_reset).
const ok = (message: string): AdminActionState => ({ status: "ok", message });
const fail = (message: string): AdminActionState => ({ status: "error", message });
const validId = (n: number) => Number.isSafeInteger(n) && n >= 1;

async function run(
  creatorId: number,
  change: (db: LedgerDb, creatorId: number) => Promise<PageResult>,
  failure: string,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail("The database is not set up.");

  let result: PageResult;
  try {
    result = await change(db as unknown as LedgerDb, creatorId);
  } catch (err) {
    console.error("Admin: could not change the tip page (migration 0051 run?)", err);
    return fail(failure);
  }
  if (!result.ok) return fail(result.message);

  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin/audit");
  try {
    // The public page is read fresh on every visit today; this keeps it right if that changes.
    const [row] = await db<{ handle: string | null }[]>`select handle from users where id = ${creatorId}`;
    if (row?.handle) revalidatePath(`/${row.handle}`);
  } catch {
    // The change is saved; only the cache nudge was skipped.
  }
  return ok(result.message);
}

// Bound to a creator and handed to ConfirmAction (an AdminAction): the form carries nothing, so the
// previous state and the form data are not taken.
export async function restoreCreatorPage(creatorId: number): Promise<AdminActionState> {
  return run(creatorId, restorePrevious, "Could not restore. Has migration 0051 been run?");
}

export async function resetCreatorPage(creatorId: number): Promise<AdminActionState> {
  return run(creatorId, resetPage, "Could not reset. Has migration 0051 been run?");
}
