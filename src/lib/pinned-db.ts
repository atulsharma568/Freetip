import type { LedgerDb, Query } from "./accrual";
import { hasFeature } from "./plans";
import { PIN_AGAIN_WINDOW_HOURS, clampSeconds, resolvePinned, type PinnedCard } from "./pinned";

// The database half of paid highlighted messages (migration 0040). No site imports, so the
// tests run it against an in-memory Postgres. Every function re-checks the creator's switch
// itself: a hidden button is not a lock.
//
// Rules in one place:
//   - A pin starts only when the creator approves the message (`pinApprovedTip`), never when
//     the tip is paid, and never in a tip whose fan did not ask for it.
//   - Pinning a message ends any other pinned message of that creator at once, so a newer one
//     replaces the older and an older one can never reappear.
//   - `unpinAll` ends whatever is pinned now. Nothing brings it back except the creator
//     pinning that message again (`pinAgain`, within a day of the tip).

type Fail = { ok: false; message: string };
type Done = { ok: true };

async function creatorPinSettings(db: Query, creatorId: number) {
  const [row] = await db<{ paid_features: string[] | null; highlight_seconds: number | null }[]>`
    select paid_features, highlight_seconds from users where id = ${creatorId}
  `;
  return row && hasFeature(row, "highlightedMessages") ? { seconds: clampSeconds(row.highlight_seconds) } : null;
}

// Starts the pinned time for an approved tip that asked for it. Own try: a missing migration
// or a database blip logs and leaves the approval alone. Returns whether a pin was started.
export async function pinApprovedTip(db: LedgerDb, creatorId: number, tipId: number): Promise<boolean> {
  try {
    const settings = await creatorPinSettings(db, creatorId);
    if (!settings) return false;
    return await db.begin(async (tx) => {
      const [tipRow] = await tx<{ id: number }[]>`
        select id::int as id from tip_orders
        where id = ${tipId} and creator_id = ${creatorId} and highlight and status = 'captured'
          and message_status = 'approved' and btrim(coalesce(fan_message, '')) <> ''
        for update
      `;
      if (!tipRow) return false;
      await tx`
        update tip_orders set highlight_until = now()
        where creator_id = ${creatorId} and highlight and highlight_until > now() and id <> ${tipId}
      `;
      await tx`
        update tip_orders set highlight_until = now() + make_interval(secs => ${settings.seconds})
        where id = ${tipId}
      `;
      return true;
    });
  } catch (err) {
    console.error("Pinned message: could not start the pin (migration 0040 run?).", err);
    return false;
  }
}

// Takes down whatever is pinned right now. Returns how many were pinned.
export async function unpinAll(db: Query, creatorId: number): Promise<{ ok: true; count: number } | Fail> {
  try {
    if (!(await creatorPinSettings(db, creatorId))) return { ok: false, message: "Pinned messages are not switched on for your account." };
    const rows = await db<{ id: number }[]>`
      update tip_orders set highlight_until = now()
      where creator_id = ${creatorId} and highlight and highlight_until > now()
      returning id::int as id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    console.error("Pinned message: could not take it down.", err);
    return { ok: false, message: "Could not do that. Try again shortly." };
  }
}

// Pins a message again for the creator's pinned time. Only a tip that asked for it, was
// captured, was approved, has text, and was paid within the last day.
export async function pinAgain(db: LedgerDb, creatorId: number, tipId: number): Promise<Done | Fail> {
  try {
    const settings = await creatorPinSettings(db, creatorId);
    if (!settings) return { ok: false, message: "Pinned messages are not switched on for your account." };
    return await db.begin(async (tx): Promise<Done | Fail> => {
      const [tipRow] = await tx<{ id: number }[]>`
        select id::int as id from tip_orders
        where id = ${tipId} and creator_id = ${creatorId} and highlight and status = 'captured'
          and message_status = 'approved' and btrim(coalesce(fan_message, '')) <> ''
          and captured_at > now() - make_interval(hours => ${PIN_AGAIN_WINDOW_HOURS})
        for update
      `;
      if (!tipRow) return { ok: false, message: "That message can no longer be pinned." };
      await tx`
        update tip_orders set highlight_until = now()
        where creator_id = ${creatorId} and highlight and highlight_until > now() and id <> ${tipId}
      `;
      await tx`
        update tip_orders set highlight_until = now() + make_interval(secs => ${settings.seconds})
        where id = ${tipId}
      `;
      return { ok: true };
    });
  } catch (err) {
    console.error("Pinned message: could not pin it again.", err);
    return { ok: false, message: "Could not do that. Try again shortly." };
  }
}

// What the OBS overlay draws now: the newest message still inside its pinned time, or null.
// Empty while the creator's switch is off. Banned words are checked now, not at payment.
export async function loadPinned(db: Query, creatorId: number, bannedWords: readonly string[]): Promise<PinnedCard | null> {
  const settings = await creatorPinSettings(db, creatorId);
  if (!settings) return null;
  const [row] = await db<
    {
      id: number;
      fan_name: string | null;
      fan_message: string | null;
      gross_amount_minor: string;
      status: string;
      message_status: string;
      highlight_until: Date | null;
      db_now: Date;
    }[]
  >`
    select id::int as id, fan_name, fan_message, gross_amount_minor, status, message_status,
           highlight_until, now() as db_now
    from tip_orders
    where creator_id = ${creatorId} and highlight and highlight_until > now()
    order by highlight_until desc
    limit 1
  `;
  return resolvePinned(row, bannedWords, row?.db_now ?? new Date());
}

export type PinnedTipView = {
  id: number;
  name: string;
  amountPaise: number;
  message: string;
  capturedAt: Date;
  // "live": pinned now; "ended": was pinned, can be pinned again; "waiting": paid, not approved yet.
  state: "live" | "ended" | "waiting";
  secondsLeft: number;
};

// The dashboard list: this creator's tips from the last day whose fan asked for a pin.
// A rejected message's text is never returned.
export async function loadPinnedPanel(db: Query, creatorId: number): Promise<PinnedTipView[]> {
  const rows = await db<
    {
      id: number;
      fan_name: string | null;
      fan_message: string | null;
      gross_amount_minor: string;
      message_status: "pending" | "approved" | "rejected";
      captured_at: Date;
      secs_left: string | null;
    }[]
  >`
    select id::int as id, fan_name, fan_message, gross_amount_minor, message_status, captured_at,
           extract(epoch from (highlight_until - now()))::text as secs_left
    from tip_orders
    where creator_id = ${creatorId} and highlight and status = 'captured'
      and message_status <> 'rejected'
      and captured_at > now() - make_interval(hours => ${PIN_AGAIN_WINDOW_HOURS})
      and btrim(coalesce(fan_message, '')) <> ''
    order by captured_at desc
    limit 20
  `;
  return rows.map((r) => {
    const left = r.secs_left === null ? 0 : Math.ceil(Number(r.secs_left));
    return {
      id: r.id,
      name: r.fan_name?.trim() || "Anonymous",
      amountPaise: Number(r.gross_amount_minor),
      message: r.fan_message!.trim(),
      capturedAt: r.captured_at,
      state: r.message_status === "pending" ? "waiting" : left > 0 ? "live" : "ended",
      secondsLeft: Math.max(0, left),
    };
  });
}
