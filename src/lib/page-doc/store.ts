import type { LedgerDb, Query } from "../accrual";
import { hasFeature } from "../plans";
import { usedAssetIds } from "./assets";
import { LIMITS } from "./blocks";
import { pageDocOrDefault, parsePageDoc, validateForPublish } from "./parse";
import type { PageDoc } from "./types";

// The database half of the tip page document (migration 0051). No site imports, so the tests run
// it against an in-memory Postgres. Publishing and restoring re-check the creator's
// "Custom tip page" switch themselves: a hidden button is not a lock.
//
// Rules in one place:
//   - A published document is shown only while the creator's `pageBuilder` switch is on.
//   - Saving a draft stores the document as the parser cleaned it, and only if the draft in the
//     database is still the one the editor last saw (see saveDraft).
//   - Publish stores the cleaned draft as published and the old published as previous, in ONE
//     statement. A draft that is not a page, or hides or drops a protected block, is refused, and
//     so is a draft that is already the published page (a double click would otherwise push the
//     real previous version out).
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
  // A published document is stored but the parser cannot read it, so fans see the normal page.
  publishedUnreadable: boolean;
  // When the owner last published, restored or reset this creator's page (from the audit log).
  lastChange: Date | null;
}

// What the owner console shows for a creator. Throws when the columns are missing, so the page can
// say "run migration 0051".
export async function getPageSummary(db: Query, creatorId: number): Promise<PageSummary> {
  const [row] = await db<(Pick<Columns, "paid_features" | "page_published"> & { has_draft: boolean; has_previous: boolean })[]>`
    select paid_features, page_published,
           page_draft is not null as has_draft,
           page_previous is not null as has_previous
    from users where id = ${creatorId}
  `;
  const [change] = await db<{ at: Date | null }[]>`
    select max(created_at) as at from audit_events
    where entity_type = 'user' and entity_ref = ${String(creatorId)}
      and action in ('creator.page_published', 'creator.page_restored', 'creator.page_reset')
  `;
  const hasPublished = row?.page_published != null;
  return {
    switchOn: !!row && hasFeature(row, "pageBuilder"),
    hasDraft: !!row?.has_draft,
    hasPublished,
    hasPrevious: !!row?.has_previous,
    publishedUnreadable: hasPublished && parsePageDoc(row?.page_published) === null,
    lastChange: change?.at ?? null,
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
    // A picture the draft names must still be a live file of this creator (it may have been taken
    // down, or removed from a stale tab), otherwise the page would publish plain without a word.
    const ids = usedAssetIds(checked.doc);
    if (ids.length > 0) {
      const live = await tx<{ id: string }[]>`select id::text as id from page_assets where creator_id = ${creatorId} and review_state = 'approved'`;
      if (ids.some((id) => !live.some((r) => Number(r.id) === id))) {
        return fail("A picture in this draft is no longer in the library. Pick another one, or take the picture off, then publish.");
      }
    }
    // The cleaned document is what is published, not the raw draft.
    const [same] = await tx<{ same: boolean }[]>`select page_published is not distinct from ${checked.doc}::jsonb as same from users where id = ${creatorId}`;
    if (same?.same) return fail("The published page is already this draft.");
    await tx`update users set page_previous = page_published, page_published = ${checked.doc}::jsonb where id = ${creatorId}`;
    await audit(tx, "creator.page_published", creatorId, { published: true, previous: row.page_published != null });
    return ok("Published.");
  });
}

// What the editor opens with.
//   doc       the page to edit: the saved draft, else the published page, else `fallback`
//   base      the draft exactly as stored (null when there is none); the editor sends it back with
//             every save, and a save goes through only if the stored draft still equals it
//   published the published page as the parser reads it, or null (nothing, or not readable)
export interface DraftState {
  switchOn: boolean;
  doc: PageDoc;
  base: unknown;
  published: PageDoc | null;
  source: "draft" | "published" | "default";
}

function asJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Throws when the columns are missing, so the page can say "run migration 0051".
export async function loadDraft(db: Query, creatorId: number, fallback: PageDoc): Promise<DraftState | null> {
  const [row] = await db<Pick<Columns, "paid_features" | "page_draft" | "page_published">[]>`
    select paid_features, page_draft, page_published from users where id = ${creatorId}
  `;
  if (!row) return null;
  const draft = parsePageDoc(row.page_draft);
  const published = parsePageDoc(row.page_published);
  return {
    switchOn: hasFeature(row, "pageBuilder"),
    doc: draft?.doc ?? published?.doc ?? fallback,
    base: asJson(row.page_draft),
    published: published?.doc ?? null,
    source: draft ? "draft" : published ? "published" : "default",
  };
}

export type SaveResult =
  | { ok: true; doc: PageDoc; notes: string[] }
  // `conflict` means the draft in the database is no longer the one the editor started from.
  | { ok: false; message: string; conflict: boolean };

const saveFail = (message: string, conflict = false): SaveResult => ({ ok: false, message, conflict });

const isJsonObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Saves the draft. `base` is the draft the editor last received (null if there was none) and
// `next` is the new one. The cleaned document is stored and sent back with what was changed. If
// the stored draft is no longer `base` (another tab saved, or an old tab is open) nothing is
// written and `conflict` is true. No audit row: only publish, restore and reset are audited.
export async function saveDraft(db: LedgerDb, creatorId: number, base: unknown, next: unknown): Promise<SaveResult> {
  if (base !== null && !isJsonObject(base)) return saveFail("This draft could not be matched with the saved one. Reload the page.", true);
  const size = JSON.stringify(next ?? null)?.length ?? 0;
  if (size > LIMITS.raw) return saveFail("This draft is too big.");
  const parsed = parsePageDoc(next);
  if (!parsed) return saveFail("This draft is not a page.");
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return saveFail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return saveFail(SWITCH_OFF);
    const updated = await tx<{ id: number }[]>`
      update users set page_draft = ${parsed.doc}::jsonb
      where id = ${creatorId} and page_draft is not distinct from ${base}::jsonb
      returning id
    `;
    if (updated.length === 0) return saveFail("This page was changed somewhere else. Reload to see the latest draft.", true);
    return { ok: true as const, doc: parsed.doc, notes: parsed.notes };
  });
}

// Throws away the unsaved-to-published draft: no draft means "the same as the published page".
// Allowed whatever the switch says, like reset.
export async function discardDraft(db: LedgerDb, creatorId: number): Promise<PageResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (row.page_draft == null) return ok("There was no draft.");
    await tx`update users set page_draft = null where id = ${creatorId}`;
    return ok("The draft is gone.");
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
