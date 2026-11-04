import { randomBytes } from "node:crypto";
import type { LedgerDb, Query } from "./accrual";
import { PASS_FEATURE_KEYS } from "./plan-catalogue";
import { parsePayuAmount, replyHashIsValid, type PayuConfig, type PayuPayment, type PayuReply } from "./payu";
import { priceView, type PlanPrices } from "./pricing";

// Buying a pass, in the database (migration 0055). No site imports and no `server-only`, so the
// tests run all of it against an in-memory Postgres.
//
// What a pass is: a one-off 1 or 12 months of every feature the Paid features page offers. It is
// not renewed by itself. Paying adds the features to users.paid_features and remembers which keys
// it added (users.pass_keys), so when it ends only those are taken away and the owner's own
// ticks stay. Paying again before the end adds the new term after the current end.
//
// The rules that keep money safe (docs/payu-notes.md):
//  - An order is made first, with the amount fixed on our side. A reply is acted on only when its
//    hash matches, it names an order we made, the amount and our own order id agree, the mode
//    (live or test) agrees, and PayU's Verify Payment API, asked by our server, says the same
//    transaction succeeded for the same amount.
//  - pending -> paid happens once, in the same transaction as the switch-on, with both rows
//    locked. A second delivery finds the order paid and changes nothing. A failure only fills a
//    pending order: a paid order is never overwritten, and a failed one can still be paid (the
//    creator may retry in PayU's page under the same reference).
//  - One PayU payment id pays one order (unique index).

export type Term = 1 | 12;
export const TERMS: readonly Term[] = [1, 12];

// ---- Price ----------------------------------------------------------------------------------

// What a term costs now, in paise, and whether it is the early price. Null when the prices are not
// set. `earlyTaken` is how many early passes have been paid for already (live money only).
export function chooseAmount(prices: PlanPrices, term: Term, earlyTaken: number): { amountMinor: number; early: boolean } | null {
  const view = priceView(prices);
  if (!view) return null;
  const early = view.early && earlyTaken < view.early.seats ? view.early : null;
  const rupees = term === 12 ? (early ? early.yearly : view.yearly) : early ? early.monthly : view.monthly;
  if (!Number.isInteger(rupees) || rupees <= 0) return null;
  return { amountMinor: rupees * 100, early: early !== null };
}

// The reference sent to PayU as `txnid`: "FT" and 18 hex digits, 20 characters, unguessable.
export function newTxnid(): string {
  return `FT${randomBytes(9).toString("hex")}`;
}

// ---- Making an order ------------------------------------------------------------------------

export type CreateOrderResult =
  | { ok: true; order: { id: number; txnid: string; amountMinor: number; term: Term; early: boolean } }
  | { ok: false; reason: "no_price" | "not_active" | "test_not_allowed" | "too_many" | "bad_term" };

// At most this many unpaid orders per creator per hour, so the button cannot be used to fill the table.
const PENDING_PER_HOUR = 5;

export async function createPlanOrder(
  db: LedgerDb,
  o: {
    creatorId: number;
    term: number;
    prices: PlanPrices;
    // True when the order is made with PayU's live key.
    livemode: boolean;
    // A test-mode order may be made only for the owner's own account.
    isOwner: boolean;
    txnid?: string;
    now?: Date;
  },
): Promise<CreateOrderResult> {
  const term = TERMS.find((t) => t === o.term);
  if (!term) return { ok: false, reason: "bad_term" };
  if (!o.livemode && !o.isOwner) return { ok: false, reason: "test_not_allowed" };
  const now = (o.now ?? new Date()).toISOString();
  return db.begin(async (tx) => {
    const [creator] = await tx<{ creator_status: string }[]>`
      select creator_status from users where id = ${o.creatorId} for update
    `;
    if (!creator || creator.creator_status !== "active") return { ok: false, reason: "not_active" } as const;
    const [early] = await tx<{ n: string }[]>`
      select count(*)::text as n from plan_orders where status = 'paid' and early and livemode
    `;
    const chosen = chooseAmount(o.prices, term, Number(early?.n ?? "0"));
    if (!chosen) return { ok: false, reason: "no_price" } as const;
    const [recent] = await tx<{ n: string }[]>`
      select count(*)::text as n from plan_orders
       where creator_id = ${o.creatorId} and status = 'pending' and created_at > ${now}::timestamptz - interval '1 hour'
    `;
    if (Number(recent?.n ?? "0") >= PENDING_PER_HOUR) return { ok: false, reason: "too_many" } as const;
    const txnid = o.txnid ?? newTxnid();
    const [row] = await tx<{ id: string }[]>`
      insert into plan_orders (creator_id, txnid, term_months, amount_minor, early, livemode, created_at)
      values (${o.creatorId}, ${txnid}, ${term}, ${chosen.amountMinor}, ${chosen.early}, ${o.livemode}, ${now}::timestamptz)
      returning id::text
    `;
    return { ok: true, order: { id: Number(row.id), txnid, amountMinor: chosen.amountMinor, term, early: chosen.early } } as const;
  });
}

// ---- Settling a payment ---------------------------------------------------------------------

export type RejectReason =
  | "bad_hash"
  | "unknown_order"
  | "mode_mismatch"
  | "amount_mismatch"
  | "ref_mismatch"
  | "not_confirmed"
  | "payment_already_used";

export type SettleResult =
  // Switched on now (or the term added now).
  | { status: "activated"; orderId: number; creatorId: number; endsAt: string }
  // Delivered before: nothing changed.
  | { status: "already_paid"; orderId: number }
  // A failure was recorded on a pending or failed order.
  | { status: "failed"; orderId: number }
  // PayU has not decided yet; check again later.
  | { status: "pending"; orderId: number }
  // Could not reach PayU for the check: nothing changed, try again later.
  | { status: "unavailable"; reason: string }
  // Not believed. Nothing changed. Worth a log line.
  | { status: "rejected"; reason: RejectReason };

interface OrderRow extends Record<string, unknown> {
  id: string;
  creator_id: string;
  status: string;
  term_months: number;
  amount_minor: string;
  livemode: boolean;
}

export interface SettleDeps {
  config: PayuConfig;
  // Asks PayU's Verify Payment API about one txnid.
  fetchPayment: (txnid: string) => Promise<PayuPayment>;
  now?: () => Date;
}

export async function settlePlanPayment(db: LedgerDb, reply: PayuReply, deps: SettleDeps): Promise<SettleResult> {
  const { config } = deps;
  if (!replyHashIsValid(reply, config)) return { status: "rejected", reason: "bad_hash" };

  const [order] = await db<OrderRow[]>`
    select id::text, creator_id::text, status, term_months, amount_minor::text, livemode
      from plan_orders where txnid = ${reply.txnid}
  `;
  if (!order) return { status: "rejected", reason: "unknown_order" };
  const orderId = Number(order.id);
  if (order.livemode !== (config.mode === "live")) return { status: "rejected", reason: "mode_mismatch" };
  if (parsePayuAmount(reply.amount) !== Number(order.amount_minor)) return { status: "rejected", reason: "amount_mismatch" };
  // Our own order id travels in udf1 and is covered by the hash.
  if (reply.udf1 !== order.id) return { status: "rejected", reason: "ref_mismatch" };

  if (reply.status === "failure") {
    const reason = reply.error || reply.unmappedstatus || "payment failed";
    const changed = await db<{ id: string }[]>`
      update plan_orders set status = 'failed', failed_at = now(), failure_reason = ${reason.slice(0, 300)}
       where id = ${orderId} and status in ('pending', 'failed')
      returning id::text
    `;
    // A paid order is never touched; that case is "already paid", not a failure.
    return changed.length ? { status: "failed", orderId } : { status: "already_paid", orderId };
  }
  if (reply.status !== "success") return { status: "pending", orderId };

  if (order.status === "paid") return { status: "already_paid", orderId };

  // The reply says success. Ask PayU ourselves before believing it.
  const answer = await deps.fetchPayment(reply.txnid);
  if (answer.kind === "unavailable") return { status: "unavailable", reason: answer.reason };
  if (answer.kind === "pending") return { status: "pending", orderId };
  if (answer.kind !== "success" || answer.amountMinor !== Number(order.amount_minor)) return { status: "rejected", reason: "not_confirmed" };
  if (reply.mihpayid && reply.mihpayid !== answer.payuRef) return { status: "rejected", reason: "ref_mismatch" };

  return activate(db, orderId, answer.payuRef, (deps.now ?? (() => new Date()))());
}

// Pays the order and switches the features on, in one transaction with both rows locked.
async function activate(db: LedgerDb, orderId: number, payuRef: string, now: Date): Promise<SettleResult> {
  const stamp = now.toISOString();
  try {
    return await db.begin(async (tx: Query) => {
      const [order] = await tx<OrderRow[]>`
        select id::text, creator_id::text, status, term_months, amount_minor::text, livemode
          from plan_orders where id = ${orderId} for update
      `;
      if (order.status === "paid") return { status: "already_paid", orderId } as const;
      const creatorId = Number(order.creator_id);

      const [user] = await tx<{ paid_features: string[] | null; pass_keys: string[] | null; starts: string; ends: string }[]>`
        select paid_features, pass_keys,
               greatest(coalesce(pass_until, ${stamp}::timestamptz), ${stamp}::timestamptz)::text as starts,
               (greatest(coalesce(pass_until, ${stamp}::timestamptz), ${stamp}::timestamptz)
                  + make_interval(months => ${order.term_months}::int))::text as ends
          from users where id = ${creatorId} for update
      `;
      const have = new Set(user.paid_features ?? []);
      // Only keys not already on are the pass's to take away later; a key the owner ticked stays theirs.
      const added = PASS_FEATURE_KEYS.filter((k) => !have.has(k));
      const features = [...(user.paid_features ?? []), ...added];
      const passKeys = [...new Set([...(user.pass_keys ?? []), ...added])];

      await tx`
        update users set paid_features = ${features}::text[], pass_keys = ${passKeys}::text[],
                         pass_until = ${user.ends}::timestamptz
         where id = ${creatorId}
      `;
      await tx`
        update plan_orders set status = 'paid', payu_ref = ${payuRef}, paid_at = ${stamp}::timestamptz,
                               pass_starts_at = ${user.starts}::timestamptz, pass_ends_at = ${user.ends}::timestamptz,
                               added_keys = ${added}::text[], failed_at = null, failure_reason = null
         where id = ${orderId}
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
        values (null, 'system', 'plan.purchased', 'user', ${String(creatorId)},
                ${{ order_id: orderId, term_months: order.term_months, amount_minor: Number(order.amount_minor), pass_ends_at: user.ends, added_keys: added, livemode: order.livemode }}::jsonb,
                'PayU payment confirmed')
      `;
      return { status: "activated", orderId, creatorId, endsAt: user.ends } as const;
    });
  } catch (err) {
    // The same PayU payment id on another order: the unique index refused it, nothing changed.
    if ((err as { code?: string }).code === "23505" || /plan_orders_payu_ref/.test((err as Error).message ?? "")) {
      return { status: "rejected", reason: "payment_already_used" };
    }
    throw err;
  }
}

// ---- Checking orders that were left pending ------------------------------------------------

// Pending orders older than `minAgeMinutes` and younger than `maxAgeDays` are asked about at PayU,
// for the case the browser never came back and no notice reached us. Returns how each ended.
export async function reconcilePendingOrders(
  db: LedgerDb,
  deps: SettleDeps & { fetchPayment: (txnid: string) => Promise<PayuPayment> },
  opts: { minAgeMinutes?: number; maxAgeDays?: number; limit?: number } = {},
): Promise<{ looked: number; activated: number; failed: number; stillPending: number; unavailable: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const rows = await db<{ id: string; txnid: string; amount_minor: string; livemode: boolean }[]>`
    select id::text, txnid, amount_minor::text, livemode from plan_orders
     where status = 'pending'
       and created_at <= ${now.toISOString()}::timestamptz - make_interval(mins => ${opts.minAgeMinutes ?? 10}::int)
       and created_at >  ${now.toISOString()}::timestamptz - make_interval(days => ${opts.maxAgeDays ?? 3}::int)
     order by created_at limit ${opts.limit ?? 50}
  `;
  const out = { looked: rows.length, activated: 0, failed: 0, stillPending: 0, unavailable: 0 };
  for (const row of rows) {
    if (row.livemode !== (deps.config.mode === "live")) continue;
    const answer = await deps.fetchPayment(row.txnid);
    if (answer.kind === "unavailable") out.unavailable += 1;
    else if (answer.kind === "success" && answer.amountMinor === Number(row.amount_minor)) {
      const r = await activate(db, Number(row.id), answer.payuRef, now);
      if (r.status === "activated") out.activated += 1;
    } else if (answer.kind === "failure") {
      await db`
        update plan_orders set status = 'failed', failed_at = now(), failure_reason = ${answer.reason.slice(0, 300)}
         where id = ${Number(row.id)} and status = 'pending'
      `;
      out.failed += 1;
    } else out.stillPending += 1;
  }
  return out;
}

// ---- When a pass ends -----------------------------------------------------------------------

// Takes away the features a finished pass added, and only those, one creator at a time. Safe to run
// as often as wanted: a creator whose pass is already cleared is not found again.
export async function expirePasses(db: LedgerDb, now: Date = new Date(), limit = 200): Promise<{ expired: number }> {
  const due = await db<{ id: string }[]>`
    select id::text from users where pass_until is not null and pass_until <= ${now.toISOString()}::timestamptz
     order by pass_until limit ${limit}
  `;
  let expired = 0;
  for (const { id } of due) {
    const done = await db.begin(async (tx) => {
      const [u] = await tx<{ paid_features: string[] | null; pass_keys: string[] | null; pass_until: string }[]>`
        select paid_features, pass_keys, pass_until::text from users
         where id = ${Number(id)} and pass_until is not null and pass_until <= ${now.toISOString()}::timestamptz for update
      `;
      // Changed under us (a renewal came in): leave it.
      if (!u) return false;
      const gone = new Set(u.pass_keys ?? []);
      const kept = (u.paid_features ?? []).filter((k) => !gone.has(k));
      await tx`
        update users set paid_features = ${kept}::text[], pass_keys = '{}', pass_until = null, pass_reminded_until = null
         where id = ${Number(id)}
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'system', 'plan.expired', 'user', ${id},
                ${{ features: u.paid_features ?? [], pass_until: u.pass_until }}::jsonb, ${{ features: kept }}::jsonb,
                'The pass ended')
      `;
      return true;
    });
    if (done) expired += 1;
  }
  return { expired };
}

// ---- The owner's own feature box ------------------------------------------------------------

// Writes the owner's choice of features for one creator. A pass remembers which keys it added so it
// can take away only those when it ends: whatever the owner unticks is forgotten there (so a later
// manual tick is the owner's own), and "everything on" is the owner's own choice, so nothing is left
// for the pass to remove. Call it inside the transaction that holds the user row.
export async function writeFeatureKeys(tx: Query, creatorId: number, keys: readonly string[], everything: boolean): Promise<void> {
  await tx`
    update users set paid_features = ${[...keys]}::text[],
           pass_keys = case when ${everything} then '{}'::text[]
                            else array(select k from unnest(pass_keys) k where k = any(${[...keys]}::text[])) end
     where id = ${creatorId}
  `;
}
