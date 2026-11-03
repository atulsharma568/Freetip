"use server";

import { revalidatePath } from "next/cache";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import type { AdminActionState } from "@/lib/admin/action-state";
import { defaultDocFor } from "@/app/[handle]/tip-page-data";
import { copyPageFrom, discardDraft, publishDraft, resetPage, restorePrevious, saveDraft, type PageResult, type SaveResult } from "@/lib/page-doc/store";

// The owner's controls for a creator's custom tip page: put the previous version back, go back
// to the normal page (page builder phase 1, from the console) and, for the editor (phase 2), save
// the draft, publish it, or throw it away. Each one re-checks the owner, the id and the creator's "Custom tip page" switch (in the store)
// itself: a hidden button is not a lock. Publish, restore and reset each write one audit row in
// the same transaction (creator.page_published, creator.page_restored, creator.page_reset);
// saving a draft does not.
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

  await refresh(creatorId);
  return ok(result.message);
}

// Tells the pages that show this change to read it again.
async function refresh(creatorId: number) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin/audit");
  const db = getDb();
  if (!db) return;
  try {
    // The public page is read fresh on every visit today; this keeps it right if that changes.
    const [row] = await db<{ handle: string | null }[]>`select handle from users where id = ${creatorId}`;
    if (row?.handle) revalidatePath(`/${row.handle}`);
  } catch {
    // The change is saved; only the cache nudge was skipped.
  }
}

// Bound to a creator and handed to ConfirmAction (an AdminAction): the form carries nothing, so the
// previous state and the form data are not taken.
export async function restoreCreatorPage(creatorId: number): Promise<AdminActionState> {
  return run(creatorId, restorePrevious, "Could not restore. Has migration 0051 been run?");
}

export async function resetCreatorPage(creatorId: number): Promise<AdminActionState> {
  return run(creatorId, resetPage, "Could not reset. Has migration 0051 been run?");
}

// Copies another creator's tip page into this creator's draft, as a template (see copyPageFrom).
// The source comes from the form; it is checked as untrusted. Bound to the target creator and
// handed to ConfirmAction.
export async function copyCreatorPage(creatorId: number, _prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireOwner();
  const raw = formData.get("source");
  const sourceId = typeof raw === "string" && /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!validId(creatorId) || !validId(sourceId) || sourceId > 2147483647) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail("The database is not set up.");

  let result: PageResult;
  try {
    const [source] = await db<{ handle: string | null; google_id: string }[]>`select handle, google_id from users where id = ${sourceId}`;
    if (!source) return fail("The creator to copy from was not found.");
    result = await copyPageFrom(db as unknown as LedgerDb, sourceId, creatorId, defaultDocFor(source.handle ?? "", source));
  } catch (err) {
    console.error("Admin: could not copy the tip page (migration 0051 run?)", err);
    return fail("Could not copy the page. Has migration 0051 been run?");
  }
  if (!result.ok) return fail(result.message);

  await refresh(creatorId);
  return ok(result.message);
}

// The editor's own actions return plain data to the editor (not form state): the saved document
// and what the parser changed, or a message, or a conflict.

// Saves the draft. `base` is the draft the editor last received and `next` the new one (both come
// from the browser, so they are checked as untrusted: the store parses `next` and matches `base`).
export async function savePageDraft(creatorId: number, base: unknown, next: unknown): Promise<SaveResult> {
  await requireOwner();
  if (!validId(creatorId)) return { ok: false, message: "That request is not valid.", conflict: false };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not set up.", conflict: false };
  try {
    return await saveDraft(db as unknown as LedgerDb, creatorId, base ?? null, next);
  } catch (err) {
    console.error("Admin: could not save the tip page draft (migration 0051 run?)", err);
    return { ok: false, message: "Could not save. Has migration 0051 been run?", conflict: false };
  }
}

// Publishes the saved draft. What fans see changes at once.
export async function publishPage(creatorId: number): Promise<PageResult> {
  await requireOwner();
  if (!validId(creatorId)) return { ok: false, message: "That request is not valid." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not set up." };
  try {
    const result = await publishDraft(db as unknown as LedgerDb, creatorId);
    if (result.ok) await refresh(creatorId);
    return result;
  } catch (err) {
    console.error("Admin: could not publish the tip page (migration 0051 run?)", err);
    return { ok: false, message: "Could not publish. Has migration 0051 been run?" };
  }
}

// Throws the saved draft away, so the editor starts again from the published page.
export async function discardPageDraft(creatorId: number): Promise<PageResult> {
  await requireOwner();
  if (!validId(creatorId)) return { ok: false, message: "That request is not valid." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not set up." };
  try {
    return await discardDraft(db as unknown as LedgerDb, creatorId);
  } catch (err) {
    console.error("Admin: could not discard the tip page draft (migration 0051 run?)", err);
    return { ok: false, message: "Could not discard the draft. Has migration 0051 been run?" };
  }
}
