import type { LedgerDb, Query } from "../accrual";
import { hasFeature } from "../plans";
import { safeFont, safeTheme } from "../overlay-themes";
import {
  OVERLAY_DRAFT_MAX_JSON,
  checkDraft,
  draftFromLive,
  liveAsValues,
  overlayParts,
  parseOverlayDraft,
  sameValues,
  type LiveOverlay,
  type OverlayDraft,
  type OverlayParts,
} from "./draft";

// The database half of the owner's overlay editor (migration 0053). No site imports, so the tests
// run it against an in-memory Postgres. Every change re-checks the creator's "Custom tip page"
// switch itself: a hidden button is not a lock.
//
// Rules in one place:
//   - A draft is only ever saved from the draft the editor last saw (compare-and-swap), so a second
//     tab cannot overwrite the first. Saving writes nothing the stream can see.
//   - Publish reads the whole draft back through the real parsers (the same ones the creator's own
//     pages use), and writes the live columns in ONE statement together with the old live values as
//     "previous". One bad part refuses the whole Publish and writes nothing. A part whose paid switch
//     is off is not written (it is named in the message). A draft that changes nothing is refused.
//   - Swap puts the previous values live and keeps what was live as the new previous, so doing it
//     again swaps back.
//   - Publish and Swap each write one audit row against the creator.
//   - The alert code is never touched: it reads the same live columns it always did.

export type OverlayResult = { ok: true; message: string } | { ok: false; message: string };
const fail = (message: string): OverlayResult => ({ ok: false, message });
const ok = (message: string): OverlayResult => ({ ok: true, message });

const SWITCH_OFF = 'Switch on "Custom tip page" for this creator first.';

type Columns = {
  paid_features: string[] | null;
  accent: string | null;
  alert_text: unknown;
  alert_motion: unknown;
  alert_layout: unknown;
  overlay_theme: string | null;
  overlay_font: string | null;
  goal_bar_style: unknown;
  overlay_draft: unknown;
  overlay_previous: unknown;
};

const liveOf = (row: Columns): LiveOverlay => ({
  alertText: row.alert_text,
  alertMotion: row.alert_motion,
  alertLayout: row.alert_layout,
  theme: row.overlay_theme,
  font: row.overlay_font,
  goalBar: row.goal_bar_style,
});

async function lockRow(tx: Query, creatorId: number): Promise<Columns | undefined> {
  const [row] = await tx<Columns[]>`select paid_features, accent, alert_text, alert_motion, alert_layout, overlay_theme, overlay_font, goal_bar_style, overlay_draft, overlay_previous from users where id = ${creatorId} for update`;
  return row;
}

async function audit(tx: Query, action: string, creatorId: number, after: Record<string, unknown>) {
  await tx`
    insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
    values (null, 'owner', ${action}, 'user', ${String(creatorId)}, ${after}::jsonb, 'set by the owner')
  `;
}

function asJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// What the editor opens with.
//   doc        the draft to edit: the saved draft, else the live values written out as fields
//   base       the draft exactly as stored (null when there is none); sent back with every save
//   live       the live values as a draft, to tell what is unpublished and to revert to
//   parts      which parts the creator's switches allow
export interface OverlayState {
  switchOn: boolean;
  parts: OverlayParts;
  accent: string | null;
  doc: OverlayDraft;
  base: unknown;
  live: OverlayDraft;
  source: "draft" | "live";
  hasPrevious: boolean;
}

// Throws when the columns are missing, so the page can say "run migration 0053".
export async function loadOverlayState(db: Query, creatorId: number): Promise<OverlayState | null> {
  const [row] = await db<Columns[]>`
    select paid_features, accent, alert_text, alert_motion, alert_layout, overlay_theme, overlay_font, goal_bar_style, overlay_draft, overlay_previous
    from users where id = ${creatorId}
  `;
  if (!row) return null;
  const parts = overlayParts(row);
  const live = draftFromLive(liveOf(row), row.accent, parts);
  const saved = parseOverlayDraft(row.overlay_draft);
  return {
    switchOn: hasFeature(row, "pageBuilder"),
    parts,
    accent: row.accent,
    doc: saved ?? live,
    base: asJson(row.overlay_draft),
    live,
    source: saved ? "draft" : "live",
    hasPrevious: row.overlay_previous != null,
  };
}

export type SaveResult =
  | { ok: true; doc: OverlayDraft }
  // `conflict` means the draft in the database is no longer the one the editor started from.
  | { ok: false; message: string; conflict: boolean };

const saveFail = (message: string, conflict = false): SaveResult => ({ ok: false, message, conflict });
const isJsonObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Saves the draft. `base` is the draft the editor last received (null if there was none) and `next`
// the new one. The cleaned draft is stored and sent back. If the stored draft is no longer `base`
// nothing is written and `conflict` is true. Not audited: only Publish and Swap are.
export async function saveOverlayDraft(db: LedgerDb, creatorId: number, base: unknown, next: unknown): Promise<SaveResult> {
  if (base !== null && !isJsonObject(base)) return saveFail("This draft could not be matched with the saved one. Reload the page.", true);
  if ((JSON.stringify(next ?? null)?.length ?? 0) > OVERLAY_DRAFT_MAX_JSON) return saveFail("This draft is too big.");
  const doc = parseOverlayDraft(next);
  if (!doc) return saveFail("This draft is not an overlay draft.");
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return saveFail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return saveFail(SWITCH_OFF);
    const updated = await tx<{ id: number }[]>`
      update users set overlay_draft = ${doc}::jsonb
      where id = ${creatorId} and overlay_draft is not distinct from ${base}::jsonb
      returning id
    `;
    if (updated.length === 0) return saveFail("The overlays were changed somewhere else. Reload to see the latest draft.", true);
    return { ok: true as const, doc };
  });
}

// Throws the saved draft away, so the editor starts again from what is live. Allowed whatever the
// switch says.
export async function discardOverlayDraft(db: LedgerDb, creatorId: number): Promise<OverlayResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (row.overlay_draft == null) return ok("There was no draft.");
    await tx`update users set overlay_draft = null where id = ${creatorId}`;
    return ok("The draft is gone.");
  });
}

// What each live column becomes: the new value where the part is written, else what it was.
type Final = {
  alertText: unknown;
  alertMotion: unknown;
  alertLayout: unknown;
  theme: string;
  font: string;
  goalBar: unknown;
};

async function writeLive(tx: Query, creatorId: number, final: Final, previous: LiveOverlay) {
  const snapshot = {
    alertText: previous.alertText ?? null,
    alertMotion: previous.alertMotion ?? null,
    alertLayout: previous.alertLayout ?? null,
    theme: safeTheme(previous.theme),
    font: safeFont(previous.font),
    goalBar: previous.goalBar ?? null,
  };
  await tx`
    update users set
      alert_text = ${(final.alertText ?? null) as Record<string, unknown> | null}::jsonb,
      alert_motion = ${(final.alertMotion ?? null) as Record<string, unknown> | null}::jsonb,
      alert_layout = ${(final.alertLayout ?? null) as Record<string, unknown> | null}::jsonb,
      overlay_theme = ${final.theme},
      overlay_font = ${final.font},
      goal_bar_style = ${(final.goalBar ?? null) as Record<string, unknown> | null}::jsonb,
      overlay_previous = ${snapshot}::jsonb
    where id = ${creatorId}
  `;
}

// Publishes the saved draft to the live overlays.
export async function publishOverlay(db: LedgerDb, creatorId: number): Promise<OverlayResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return fail(SWITCH_OFF);
    const draft = parseOverlayDraft(row.overlay_draft);
    if (!draft) return fail("There is no draft to publish.");
    const checked = checkDraft(draft, row);
    if (!checked.ok) return fail(checked.message);
    const live = liveOf(row);
    if (sameValues(checked.values, liveAsValues(live, row))) return fail("The live overlays are already this draft.");

    const v = checked.values;
    const final: Final = {
      alertText: v.alertText !== undefined ? v.alertText : live.alertText,
      alertMotion: v.alertMotion !== undefined ? v.alertMotion : live.alertMotion,
      alertLayout: v.alertLayout !== undefined ? v.alertLayout : live.alertLayout,
      theme: v.style ? v.style.theme : safeTheme(live.theme),
      font: v.style ? v.style.font : safeFont(live.font),
      goalBar: v.goalBar !== undefined ? v.goalBar : live.goalBar,
    };
    await writeLive(tx, creatorId, final, live);
    await audit(tx, "creator.overlay_published", creatorId, { skipped: checked.skipped });
    const note = checked.skipped.length > 0 ? ` Not changed, because their paid switch is off: ${checked.skipped.join(", ")}.` : "";
    return ok(`Published. The next alert and the goal bar use this now.${note}`);
  });
}

// Puts the previous live values back and keeps what was live as the new previous. A part whose
// switch is off keeps what is live (it has no effect either way).
export async function swapOverlay(db: LedgerDb, creatorId: number): Promise<OverlayResult> {
  return db.begin(async (tx) => {
    const row = await lockRow(tx, creatorId);
    if (!row) return fail("That creator was not found.");
    if (!hasFeature(row, "pageBuilder")) return fail(SWITCH_OFF);
    const prev = asJson(row.overlay_previous);
    if (!isJsonObject(prev)) return fail("There is no earlier version to swap with.");
    const parts = overlayParts(row);
    const live = liveOf(row);
    const final: Final = {
      alertText: parts.text ? (prev.alertText ?? null) : live.alertText,
      alertMotion: parts.motion ? (prev.alertMotion ?? null) : live.alertMotion,
      alertLayout: parts.layout ? (prev.alertLayout ?? null) : live.alertLayout,
      theme: parts.style ? safeTheme(prev.theme) : safeTheme(live.theme),
      font: parts.style ? safeFont(prev.font) : safeFont(live.font),
      goalBar: parts.goalBar ? (prev.goalBar ?? null) : live.goalBar,
    };
    await writeLive(tx, creatorId, final, live);
    await audit(tx, "creator.overlay_swapped", creatorId, {});
    return ok("Swapped with the previous version. Doing it again swaps back.");
  });
}
