import { postMissingAccruals, type LedgerDb, type SweepResult } from "./accrual";
import { applyBackfill, findMissedPayments, type SweepOutcome } from "./razorpay-sweep";

// The daily job and the owner's "Sync" button do the same three things, in this
// order: (1) ask Razorpay what it captured recently, (2) fill in what the site
// failed to save for payments it did capture (so a live payment is not left looking
// like test money), (3) post every captured live tip that is not yet on the books.
// Step 1 and 2 need live Razorpay keys; if they cannot run, step 3 still does. One
// step failing never stops the next.

export interface SyncResult {
  check: SweepOutcome | { ok: false; reason: "check_failed"; detail: string };
  backfilled: number;
  sweep: SweepResult | null;
}

export async function syncBooks(
  db: LedgerDb,
  env: { keyId: string | undefined; keySecret: string | undefined },
  fetchImpl?: typeof fetch,
): Promise<SyncResult> {
  let check: SyncResult["check"];
  let backfilled = 0;
  try {
    check = await findMissedPayments(db, { ...env, fetchImpl });
    if (check.ok && check.backfill.length > 0) backfilled = await applyBackfill(db, check.backfill);
  } catch (err) {
    console.error("Books sync: the Razorpay check failed", err);
    check = { ok: false, reason: "check_failed", detail: (err as Error).message };
  }

  let sweep: SweepResult | null = null;
  try {
    sweep = await postMissingAccruals(db);
  } catch (err) {
    console.error("Books sync: posting failed (migration 0023 run?)", err);
  }
  return { check, backfilled, sweep };
}
