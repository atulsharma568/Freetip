import type { LedgerDb, Query } from "../accrual";
import { hasFeature } from "../plans";
import { pageDocOrDefault, validateForPublish } from "./parse";
import type { PageDoc } from "./types";

// The database half of the tip page document (migration 0051). No site imports, so the tests run
// it against an in-memory Postgres. Publishing and restoring re-check the creator's
// "Custom tip page" switch themselves: a hidden button is not a lock.
//
// Rules in one place:
//   - A published document is shown only while the creator's `pageBuilder` switch is on.
//   - Publish copies the draft to published and the old published to previous, in ONE statement.
//     A draft that is not a page, or hides or drops a pay block, is refused.
//   - Restore swaps published and previous. Reset empties all three (the normal page).
//   - Publish, restore and reset each write one audit row against the creator.

// A type alias, not an interface: the query helper only accepts rows that have an index signature.
export type PageRow = {
  paid_features: string[] | null;
  page_published: unknown;
};

// The page to draw: the creator's published document while the switch is on and it is a page,
// otherwise `fallback` (the normal page, or the owner's own page for the owner).
export function resolvePageDoc(row: PageRow | null, fallback: PageDoc): PageDoc {
  if (!row || !hasFeature(row, "pageBuilder")) return fallback;
  return pageDocOrDefault(row.page_published, fallback);
}

// Read apart from the creator row so the tip page still loads before migration 0051 is run: any
// error is logged and the page is the normal one.
export async function loadPageRow(db: Query, handle: string): Promise<PageRow | null> {
  try {
    const [row] = await db<PageRow[]>`select paid_features, page_published from users where handle = ${handle}`;
    return row ?? null;
  } catch (err) {
    console.error("Tip page: could not read the page document (migration 0051 run?).", err);
    return null;
  }
}

export type PageResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (message: string): PageResult => ({ ok: false, message });
const ok = (message: string): PageResult => ({ ok: true, message });

const SWITCH_OFF = 'Switch on "Custom tip page" for this creator first.';

type Columns = {
  paid_features: string[] | null;
  page_draft: unknown;
  page_published: unknown;
  page_previous: unknown;
};

async function lockRow(tx: Query, creatorId: number): Promise<Columns | undefined> {
  const [row] = await tx<Columns[]>`
    select paid_features, page_draft, page_published, page_previous from users where id = ${creatorId} for update
  `;
  return row;
}

async function audit(tx: Query, action: string, creatorId: number, after: { published: boolean; previous: boolean }) {
  await tx`
    insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
    values (null, 'owner', ${action}, 'user', ${String(creatorId)}, ${after}::jsonb, 'set by the owner')
  `;
}

export interface PageSummary {
  switchOn: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  hasPrevious: boolean;
}

// What the owner console shows for a creator. Throws when the columns are missing, so the page can
// say "run migration 0051".
export async function getPageSummary(db: Query, creatorId: number): Promise<PageSummary> {
  const [row] = await db<(Pick<Columns, "paid_features"> & { has_draft: boolean; has_published: boolean; has_previous: boolean })[]>`
    select paid_features,
           page_draft is not null as has_draft,
           page_published is not null as has_published,
           page_previous is not null as has_previous
    from users where id = ${creatorId}
  `;
  return {
    switchOn: !!row && hasFeature(row, "pageBuilder"),
    hasDraft: !!row?.has_draft,
    hasPublished: !!row?.has_published,
    hasPrevious: !!row?.has_previous,
  };
}

export async function publishDraft(db: LedgerDb, creatorId: number): Promise<PageResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return fail(SWITCH_OFF);
    if (row.page_draft == null) return fail("There is no draft to publish.");
    const checked = validateForPublish(row.page_draft);
    if (!checked.ok) return fail(checked.message);
    await tx`update users set page_previous = page_published, page_published = page_draft where id = ${creatorId}`;
    await audit(tx, "creator.page_published", creatorId, { published: true, previous: row.page_published != null });
    return ok("Published.");
  });
}

export async function restorePrevious(db: LedgerDb, creatorId: number): Promise<PageResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return fail(SWITCH_OFF);
    if (row.page_previous == null) return fail("There is no earlier version to restore.");
    await tx`update users set page_published = page_previous, page_previous = page_published where id = ${creatorId}`;
    await audit(tx, "creator.page_restored", creatorId, { published: true, previous: row.page_published != null });
    return ok("Restored the previous version.");
  });
}

// Back to the normal page: draft, published and previous all emptied. Allowed whatever the
// switch says, so the owner can always clean up.
export async function resetPage(db: LedgerDb, creatorId: number): Promise<PageResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (row.page_draft == null && row.page_published == null && row.page_previous == null) return ok("Already the normal page.");
    await tx`update users set page_draft = null, page_published = null, page_previous = null where id = ${creatorId}`;
    await audit(tx, "creator.page_reset", creatorId, { published: false, previous: false });
    return ok("Back to the normal page.");
  });
}
