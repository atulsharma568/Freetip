import { randomBytes } from "node:crypto";
import type { LedgerDb, Query } from "./accrual";
import { planFeatureKeys } from "./plan-catalogue";
import { parsePayuAmount, replyHashIsValid, type PayuConfig, type PayuPayment, type PayuReply } from "./payu";
import { PLAN_KEYS, priceView, type PlanKey, type PlanPrices } from "./pricing";

// Buying a pass, in the database (migration 0055). No site imports and no `server-only`, so the
// tests run all of it against an in-memory Postgres.
//
// What a pass is: a one-off 1 or 12 months of one plan, Starter or Creator (migration 0056). It is
// not renewed by itself. Each plan is its own pass with its own end date (users.starter_until,
// users.creator_until): buying a plan extends only that plan, nothing is carried from one plan to
// the other, and a creator may hold both. Paying adds the plan's features to users.paid_features
// and remembers which keys it added (users.pass_keys), so when a plan ends only the keys no running
// plan still covers are taken away and the owner's own ticks stay. Paying again before the end adds
// the new term after the current end.
//
// The rules that keep money safe (docs/payu-notes.md):
//  - An order is made first, with the amount fixed on our side. A reply is acted on only when its
//    hash matches, it names an order we made, the amount and our own order id agree, the mode
//    (live or test) agrees, and PayU's Verify Payment API, asked by our server, says the same
//    transaction succeeded for the plain price (no discount).
//  - pending -> paid happens once, in the same transaction as the switch-on, with both rows
//    locked. A second delivery finds the order paid and changes nothing. A failure only fills a
//    pending order: a paid order is never overwritten, and a failed one can still be paid (the
//    creator may retry in PayU's page under the same reference).
//  - One PayU payment id pays one order (unique index).
//  - Lock order is always the order row, then the user row; nothing takes them the other way round.

export type Term = 1 | 12;
export const TERMS: readonly Term[] = [1, 12];

// ---- Price ----------------------------------------------------------------------------------

// What a term costs now, in paise, and whether it is the early price. Null when the prices are not
// set. `earlyTaken` is how many other creators hold or are buying an early pass; `keepsEarly` is a
// creator who already holds one and is renewing, who keeps the early price whatever the count.
export function chooseAmount(
  prices: PlanPrices,
  term: Term,
  earlyTaken: number,
  keepsEarly = false,
): { amountMinor: number; early: boolean } | null {
  const view = priceView(prices);
  if (!view) return null;
  const early = view.early && (keepsEarly || earlyTaken < view.early.seats) ? view.early : null;
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
  | { ok: true; order: { id: number; txnid: string; amountMinor: number; term: Term; plan: PlanKey; early: boolean } }
  // "already_covered": a Starter term that a running Creator pass already covers to the end, so
  // buying it would give the creator nothing.
  | { ok: false; reason: "no_price" | "not_active" | "test_not_allowed" | "too_many" | "bad_term" | "bad_plan" | "already_covered" | "no_agreement" }
  // The price is not what the creator was shown (an early seat went, or the prices changed). Nothing
  // was made; `amountMinor` is what it costs now.
  | { ok: false; reason: "price_changed"; amountMinor: number };

// At most this many unpaid orders (pending or failed) per creator per hour, so the button cannot be
// used to fill the table. A new order closes the creator's older pending ones (SUPERSEDED_REASON), so
// pressing Cancel or Back on PayU's page and starting again never piles up pending orders; this limit
// only stops a loop.
const UNPAID_PER_HOUR = 12;
// What a pending order is marked with when the same creator starts a newer one. It is not
// ABANDONED_REASON, so PayU is still asked about it and a real payment under it is still believed.
export const SUPERSEDED_REASON = "replaced by a newer order";
// An unpaid early order holds its seat this long (the Buy form is only offered for as long).
const EARLY_HOLD_HOURS = 2;
// A creator whose early pass ended less than this long ago keeps the early price on renewal.
const EARLY_GRACE_DAYS = 31;
// One lock key for the early-seat count, so two creators cannot both take the last seat.
const EARLY_SEAT_LOCK = 55001;

// What each term costs this creator right now: the early seats taken by other creators, and whether
// this creator is renewing an early pass. Reads only; the caller holds the early-seat lock when the
// answer is going to be acted on.
async function quoteTerms(
  tx: Query,
  creatorId: number,
  plan: PlanKey,
  prices: PlanPrices,
  now: string,
): Promise<Record<Term, { amountMinor: number; early: boolean } | null>> {
  // Other creators who hold an early pass of this plan or are buying one right now (live money only).
  const [taken] = await tx<{ n: string }[]>`
    select count(distinct creator_id)::text as n from plan_orders
     where early and livemode and plan = ${plan} and creator_id <> ${creatorId} and ended_at is null
       and (status = 'paid' or (status = 'pending' and created_at > ${now}::timestamptz - make_interval(hours => ${EARLY_HOLD_HOURS}::int)))
  `;
  // Renewing: the creator's latest paid order of this plan was an early one and ended recently (or still runs).
  const [last] = await tx<{ early: boolean; ends: boolean }[]>`
    select early, pass_ends_at >= ${now}::timestamptz - make_interval(days => ${EARLY_GRACE_DAYS}::int) as ends
      from plan_orders where creator_id = ${creatorId} and plan = ${plan} and status = 'paid' and livemode and ended_at is null
     order by paid_at desc limit 1
  `;
  const earlyTaken = Number(taken?.n ?? "0");
  const keepsEarly = Boolean(last?.early && last.ends);
  return { 1: chooseAmount(prices, 1, earlyTaken, keepsEarly), 12: chooseAmount(prices, 12, earlyTaken, keepsEarly) };
}

// Which terms of a plan a running pass already covers to the end, so buying them would give the
// creator nothing. Only a Starter term can be covered (by a Creator pass that runs past where the
// new term would end, the same month arithmetic as `activate`, in UTC). Reads only; createPlanOrder
// asks it again with the user row locked, so this one decides what the Buy form offers and that one
// what is allowed.
async function coveredTerms(tx: Query, creatorId: number, plan: PlanKey, now: string): Promise<Record<Term, boolean>> {
  if (plan !== "starter") return { 1: false, 12: false };
  const [row] = await tx<{ m1: boolean; m12: boolean }[]>`
    select (creator_until is not null and creator_until >=
              (((greatest(coalesce(starter_until, ${now}::timestamptz), ${now}::timestamptz)) at time zone 'UTC'
                 + make_interval(months => 1)) at time zone 'UTC')) as m1,
           (creator_until is not null and creator_until >=
              (((greatest(coalesce(starter_until, ${now}::timestamptz), ${now}::timestamptz)) at time zone 'UTC'
                 + make_interval(months => 12)) at time zone 'UTC')) as m12
      from users where id = ${creatorId}
  `;
  return { 1: Boolean(row?.m1), 12: Boolean(row?.m12) };
}

// The price of each term of one plan for the Buy form (what the creator is shown), and whether a
// term is already covered by a running pass. Null when the prices are not set.
export async function quotePlan(
  db: LedgerDb,
  creatorId: number,
  plan: PlanKey,
  prices: PlanPrices,
  now: Date = new Date(),
): Promise<Record<Term, { amountMinor: number; early: boolean; covered: boolean }> | null> {
  const q = await quoteTerms(db, creatorId, plan, prices, now.toISOString());
  if (!q[1] || !q[12]) return null;
  const covered = await coveredTerms(db, creatorId, plan, now.toISOString());
  return { 1: { ...q[1], covered: covered[1] }, 12: { ...q[12], covered: covered[12] } };
}

export async function createPlanOrder(
  db: LedgerDb,
  o: {
    creatorId: number;
    term: number;
    // "starter" or "creator"; anything else is refused (the caller passes what the page sent).
    plan: string;
    // The prices of that plan.
    prices: PlanPrices;
    // True when the order is made with PayU's live key. The caller works this out from the settings,
    // never from anything the creator sent.
    livemode: boolean;
    // A test-mode order may be made only for the owner's own account; the caller works this out
    // from the signed-in account.
    isOwner: boolean;
    // The amount the creator was shown, in paise. When it is not what the order would cost now the
    // order is not made (reason "price_changed"), so nobody is sent to PayU for a price they did not see.
    expectAmountMinor?: number;
    // The version of the Terms and Refund Policy text the creator saw when they ticked the box (the
    // date in LEGAL_UPDATED). Required: an order is never made without the record of what was agreed.
    // The agreement time is `now` (the server's clock), never a time the browser sent.
    termsVersion: string;
    txnid?: string;
    now?: Date;
  },
): Promise<CreateOrderResult> {
  const term = TERMS.find((t) => t === o.term);
  if (!term) return { ok: false, reason: "bad_term" };
  const plan = PLAN_KEYS.find((p) => p === o.plan);
  if (!plan) return { ok: false, reason: "bad_plan" };
  if (!o.livemode && !o.isOwner) return { ok: false, reason: "test_not_allowed" };
  const termsVersion = typeof o.termsVersion === "string" ? o.termsVersion.trim().slice(0, 40) : "";
  if (!termsVersion) return { ok: false, reason: "no_agreement" };
  const now = (o.now ?? new Date()).toISOString();
  return db.begin(async (tx) => {
    // Lock order is the order row, then the user row (see the top of this file; a payment settling
    // takes them in that order). The pending orders this one is about to close are locked first, so a
    // payment settling one of them at the same moment cannot deadlock with this.
    await tx`
      select id from plan_orders
       where creator_id = ${o.creatorId} and status = 'pending' and livemode = ${o.livemode}
       order by id for update
    `;
    const [creator] = await tx<{ creator_status: string }[]>`
      select creator_status from users where id = ${o.creatorId} for no key update
    `;
    if (!creator || creator.creator_status !== "active") return { ok: false, reason: "not_active" } as const;
    // A Starter term that a running Creator pass already covers adds nothing (the user row is locked).
    if ((await coveredTerms(tx, o.creatorId, plan, now))[term]) return { ok: false, reason: "already_covered" } as const;
    await tx`select pg_advisory_xact_lock(${EARLY_SEAT_LOCK})`;
    const chosen = (await quoteTerms(tx, o.creatorId, plan, o.prices, now))[term];
    if (!chosen) return { ok: false, reason: "no_price" } as const;
    if (o.expectAmountMinor !== undefined && o.expectAmountMinor !== chosen.amountMinor) {
      return { ok: false, reason: "price_changed", amountMinor: chosen.amountMinor } as const;
    }
    const [recent] = await tx<{ n: string }[]>`
      select count(*)::text as n from plan_orders
       where creator_id = ${o.creatorId} and status <> 'paid' and created_at > ${now}::timestamptz - interval '1 hour'
    `;
    if (Number(recent?.n ?? "0") >= UNPAID_PER_HOUR) return { ok: false, reason: "too_many" } as const;
    // The creator's older pending orders of the same mode are closed: they were left by Cancel, Back or
    // a closed tab. They can still be paid (a notice or the PayU check settles a failed order too) and
    // they stop holding an early seat. The user row is locked, so two tabs cannot both skip this.
    await tx`
      update plan_orders set status = 'failed', failed_at = ${now}::timestamptz, failure_reason = ${SUPERSEDED_REASON}
       where creator_id = ${o.creatorId} and status = 'pending' and livemode = ${o.livemode}
    `;
    const txnid = o.txnid ?? newTxnid();
    const [row] = await tx<{ id: string }[]>`
      insert into plan_orders (creator_id, txnid, term_months, plan, amount_minor, early, livemode, created_at, agreed_at, terms_version)
      values (${o.creatorId}, ${txnid}, ${term}, ${plan}, ${chosen.amountMinor}, ${chosen.early}, ${o.livemode}, ${now}::timestamptz, ${now}::timestamptz, ${termsVersion})
      returning id::text
    `;
    return { ok: true, order: { id: Number(row.id), txnid, amountMinor: chosen.amountMinor, term, plan, early: chosen.early } } as const;
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
  // PayU has not decided yet (a bank transfer still in flight); its next notice settles it.
  | { status: "pending"; orderId: number }
  // Could not get PayU's confirmation (unreachable, or it has not caught up with its own notice):
  // nothing changed, so the answer to PayU is "try again" and the daily job looks again.
  | { status: "unavailable"; reason: string }
  // Not believed. Nothing changed. Worth a log line.
  | { status: "rejected"; reason: RejectReason; detail?: string };

interface OrderRow extends Record<string, unknown> {
  id: string;
  creator_id: string;
  status: string;
  term_months: number;
  plan: string;
  amount_minor: string;
  livemode: boolean;
}

export interface SettleDeps {
  config: PayuConfig;
  // Asks PayU's Verify Payment API about one txnid.
  fetchPayment: (txnid: string) => Promise<PayuPayment>;
  now?: () => Date;
  // Waits between asking PayU twice (tests pass a no-op).
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// PayU's check can trail its own notice by a moment; ask once more after this long.
const VERIFY_RETRY_MS = 2000;

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

  // PayU's documents give both words for a failed payment.
  if (reply.status === "failure" || reply.status === "failed") {
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

  // The reply says success. Ask PayU ourselves before believing it. PayU's check can trail its own
  // notice, so a "pending" or "not found" gets one more look after a short wait.
  let answer = await deps.fetchPayment(reply.txnid);
  if (answer.kind === "pending" || answer.kind === "not_found") {
    await (deps.sleep ?? defaultSleep)(VERIFY_RETRY_MS);
    answer = await deps.fetchPayment(reply.txnid);
  }
  if (answer.kind === "unavailable") return { status: "unavailable", reason: answer.reason };
  if (answer.kind === "pending" || answer.kind === "not_found") {
    return { status: "unavailable", reason: "PayU has not confirmed this payment yet" };
  }
  if (answer.kind === "mismatch") {
    await flagNeedsLook(db, orderId, answer.reason);
    return { status: "rejected", reason: "not_confirmed", detail: answer.reason };
  }
  if (answer.kind === "success" && answer.amountMinor !== Number(order.amount_minor)) {
    await flagNeedsLook(db, orderId, "the amount differs");
    return { status: "rejected", reason: "not_confirmed" };
  }
  if (answer.kind !== "success") return { status: "rejected", reason: "not_confirmed" };

  // The payment id comes from PayU's own answer; the id in the posted reply is not covered by the hash.
  return activate(db, orderId, answer.payuRef, (deps.now ?? (() => new Date()))());
}

// The term a payment adds to one plan, worked out in the database in UTC so the session's time zone
// can never move it. The term starts when the plan's current pass ends, or at `stamp` when it has
// ended (or never ran). A month is added by the calendar and then put back on the day of the month
// the run started on, so Jan 31 plus one month is Feb 28 and one more is Mar 31, not Mar 28
// (`anchorDay` is that day, kept while the pass is renewed without a gap; a new run starts a new one).
async function termSpan(
  tx: Query,
  planUntil: string | null,
  anchorDay: number | null,
  months: number,
  stamp: string,
): Promise<{ starts: string; ends: string; anchor: number }> {
  const [r] = await tx<{ starts: string; ends: string; anchor: number }[]>`
    with s as (
      select greatest(coalesce(${planUntil}::text::timestamptz, ${stamp}::timestamptz), ${stamp}::timestamptz) as starts,
             coalesce(${planUntil}::text::timestamptz > ${stamp}::timestamptz, false) as renewing
    ), a as (
      select starts,
             ((starts at time zone 'UTC') + make_interval(months => ${months}::int)) as cand,
             (case when renewing and ${anchorDay}::int is not null then ${anchorDay}::int
                   else extract(day from (starts at time zone 'UTC'))::int end) as anchor
        from s
    )
    select starts::text as starts,
           ((date_trunc('month', cand)
             + (least(anchor, extract(day from (date_trunc('month', cand) + interval '1 month' - interval '1 day'))::int) - 1) * interval '1 day'
             + (cand - date_trunc('day', cand))) at time zone 'UTC')::text as ends,
           anchor::int as anchor
      from a
  `;
  return r;
}

// Pays the order and switches the features on, in one transaction with both rows locked.
async function activate(db: LedgerDb, orderId: number, payuRef: string, now: Date): Promise<SettleResult> {
  const stamp = now.toISOString();
  try {
    return await db.begin(async (tx: Query) => {
      const [order] = await tx<OrderRow[]>`
        select id::text, creator_id::text, status, term_months, plan, amount_minor::text, livemode
          from plan_orders where id = ${orderId} for update
      `;
      if (order.status === "paid") return { status: "already_paid", orderId } as const;
      const creatorId = Number(order.creator_id);

      // Which plan this order bought; the plan's own end date is the one that moves.
      const plan: PlanKey = order.plan === "starter" ? "starter" : "creator";
      const [user] = await tx<{
        creator_status: string;
        paid_features: string[] | null;
        pass_keys: string[] | null;
        blocked_keys: string[] | null;
        plan_until: string | null;
        anchor_day: number | null;
        other_until: string | null;
      }[]>`
        select creator_status, paid_features, pass_keys, blocked_keys,
               (case when ${plan}::text = 'starter' then starter_until else creator_until end)::text as plan_until,
               (case when ${plan}::text = 'starter' then starter_anchor_day else creator_anchor_day end)::int as anchor_day,
               (case when ${plan}::text = 'starter' then creator_until else null end)::text as other_until
          from users where id = ${creatorId} for no key update
      `;
      const span = await termSpan(tx, user.plan_until, user.anchor_day, order.term_months, stamp);
      // A Starter term that a running Creator pass covers all the way would add nothing (the creator
      // may have started this order before buying Creator): it starts when Creator ends instead, so
      // the money still buys time. Compared in the database, so no date text is parsed here.
      let covered = false;
      if (plan === "starter" && user.other_until !== null) {
        const [c] = await tx<{ covered: boolean }[]>`select ${user.other_until}::text::timestamptz >= ${span.ends}::timestamptz as covered`;
        covered = Boolean(c?.covered);
      }
      const final = covered ? await termSpan(tx, user.other_until, null, order.term_months, stamp) : span;
      if (user.creator_status !== "active") {
        // Paid, but the account is suspended or closed. The pass is still recorded; the owner may
        // want to refund by hand.
        console.error(`Plan order ${orderId} was paid for a creator whose account is ${user.creator_status}: check whether to refund.`);
      }
      const have = new Set(user.paid_features ?? []);
      const blocked = new Set(user.blocked_keys ?? []);
      // Only keys not already on are the pass's to take away later; a key the owner ticked stays theirs.
      // A key the owner switched off on purpose (a takedown) is not switched back on by a payment.
      const wanted = planFeatureKeys(plan);
      const added = wanted.filter((k) => !have.has(k) && !blocked.has(k));
      const skipped = wanted.filter((k) => !have.has(k) && blocked.has(k));
      const features = [...(user.paid_features ?? []), ...added];
      const passKeys = [...new Set([...(user.pass_keys ?? []), ...added])];
      const user2 = { ...final };

      await tx`
        update users set paid_features = ${features}::text[], pass_keys = ${passKeys}::text[],
                         starter_until = case when ${plan}::text = 'starter' then ${user2.ends}::timestamptz else starter_until end,
                         creator_until = case when ${plan}::text = 'creator' then ${user2.ends}::timestamptz else creator_until end,
                         starter_anchor_day = case when ${plan}::text = 'starter' then ${final.anchor}::smallint else starter_anchor_day end,
                         creator_anchor_day = case when ${plan}::text = 'creator' then ${final.anchor}::smallint else creator_anchor_day end
         where id = ${creatorId}
      `;
      await tx`
        update plan_orders set status = 'paid', payu_ref = ${payuRef}, paid_at = ${stamp}::timestamptz,
                               pass_starts_at = ${user2.starts}::timestamptz, pass_ends_at = ${user2.ends}::timestamptz,
                               added_keys = ${added}::text[], failed_at = null, failure_reason = null
         where id = ${orderId}
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
        values (null, 'system', 'plan.purchased', 'user', ${String(creatorId)},
                ${{ order_id: orderId, plan, term_months: order.term_months, amount_minor: Number(order.amount_minor), pass_ends_at: user2.ends, added_keys: added, skipped_blocked_keys: skipped, livemode: order.livemode }}::jsonb,
                'PayU payment confirmed')
      `;
      return { status: "activated", orderId, creatorId, endsAt: user2.ends } as const;
    });
  } catch (err) {
    // The same PayU payment id on another order: the unique index refused it, nothing changed.
    if (/plan_orders_payu_ref/.test((err as Error).message ?? "")) {
      return { status: "rejected", reason: "payment_already_used" };
    }
    throw err;
  }
}

// ---- Checking orders that were left unsettled -----------------------------------------------

// What the daily check writes on an order PayU has never heard of after a day, so it stops being
// asked about. Such an order can still be paid later (a stored checkout form); its reply settles it.
export const ABANDONED_REASON = "never paid at PayU";

export interface ReconcileResult {
  looked: number;
  activated: number;
  failed: number;
  abandoned: number;
  stillPending: number;
  unavailable: number;
  // PayU says paid, but not the plain price: the owner has to look (also written to the log and, once
  // per order, to the audit trail where the owner's pages show it).
  needsLook: number;
  errors: number;
}

const emptyResult = (): ReconcileResult => ({ looked: 0, activated: 0, failed: 0, abandoned: 0, stillPending: 0, unavailable: 0, needsLook: 0, errors: 0 });

interface UnsettledRow extends Record<string, unknown> {
  id: string;
  txnid: string;
  status: string;
  amount_minor: string;
  old: boolean;
}

// The action the owner's pages look for: PayU says an order is paid but not at the plain price, so
// nothing was switched on and a person has to decide (refund it in PayU, or give the features by hand).
export const NEEDS_LOOK_ACTION = "plan.payment_needs_look";

// Writes the "needs a look" line once per order (a second look at the same order adds nothing), so
// the owner sees it without reading the server log. Never throws: the check goes on without it.
async function flagNeedsLook(db: LedgerDb, orderId: number, detail: string): Promise<void> {
  try {
    await db`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
      select null, 'system', ${NEEDS_LOOK_ACTION}, 'plan_order', ${String(orderId)},
             ${{ order_id: orderId, detail: detail.slice(0, 300) }}::jsonb,
             'PayU says this order is paid, but not at the plain price. Nothing was switched on.'
       where not exists (select 1 from audit_events where action = ${NEEDS_LOOK_ACTION} and entity_type = 'plan_order' and entity_ref = ${String(orderId)})
    `;
  } catch (err) {
    console.error(`Plan order ${orderId}: could not write the needs-a-look line:`, err instanceof Error ? err.message : err);
  }
}

// Asks PayU about one unsettled order and acts on the answer: pays it, fails it, closes it out, or
// leaves it. Adds what it did to `out`. Never believes anything but PayU's own Verify answer for the
// plain price (the same rule as a reply: see settlePlanPayment).
async function checkUnsettled(db: LedgerDb, deps: SettleDeps, row: UnsettledRow, now: Date, out: ReconcileResult): Promise<void> {
  out.looked += 1;
  try {
    const answer = await deps.fetchPayment(row.txnid);
    if (answer.kind === "unavailable") out.unavailable += 1;
    else if (answer.kind === "success" && answer.amountMinor === Number(row.amount_minor)) {
      const r = await activate(db, Number(row.id), answer.payuRef, now);
      if (r.status === "activated") out.activated += 1;
    } else if (answer.kind === "success" || answer.kind === "mismatch") {
      out.needsLook += 1;
      const detail = answer.kind === "mismatch" ? answer.reason : "the amount differs";
      console.error(`Plan order ${row.id} (txnid ${row.txnid}) is paid at PayU but not at the plain price: ${detail}. Look at it by hand.`);
      await flagNeedsLook(db, Number(row.id), detail);
    } else if (answer.kind === "failure") {
      const changed = await db<{ id: string }[]>`
        update plan_orders set status = 'failed', failed_at = now(), failure_reason = ${answer.reason.slice(0, 300)}
         where id = ${Number(row.id)} and status = 'pending'
        returning id::text
      `;
      if (changed.length) out.failed += 1;
      else out.stillPending += 1;
    } else if (answer.kind === "not_found" && row.status === "pending" && row.old) {
      await db`
        update plan_orders set status = 'failed', failed_at = now(), failure_reason = ${ABANDONED_REASON}
         where id = ${Number(row.id)} and status = 'pending'
      `;
      out.abandoned += 1;
    } else out.stillPending += 1;
  } catch (err) {
    out.errors += 1;
    console.error(`Plan order ${row.id} could not be checked:`, err instanceof Error ? err.message : err);
  }
}

// Orders that were never settled by a return or a notice are asked about at PayU: pending ones, and
// failed ones PayU itself reported failed (a retry under the same reference may have succeeded).
// Newest first, so a real payment whose notice was lost is never starved behind abandoned
// checkouts; only this server's own settings' mode is asked about; one bad order cannot stop
// the rest; and the loop stops when its time budget is used.
export async function reconcilePendingOrders(
  db: LedgerDb,
  deps: SettleDeps,
  opts: { minAgeMinutes?: number; maxAgeDays?: number; limit?: number; budgetMs?: number } = {},
): Promise<ReconcileResult> {
  const now = (deps.now ?? (() => new Date()))();
  const stamp = now.toISOString();
  const live = deps.config.mode === "live";
  const rows = await db<UnsettledRow[]>`
    select id::text, txnid, status, amount_minor::text,
           (created_at <= ${stamp}::timestamptz - interval '1 day') as old
      from plan_orders
     where livemode = ${live}
       and (status = 'pending' or (status = 'failed' and failure_reason is distinct from ${ABANDONED_REASON}))
       and created_at <= ${stamp}::timestamptz - make_interval(mins => ${opts.minAgeMinutes ?? 10}::int)
       and created_at >  ${stamp}::timestamptz - make_interval(days => ${opts.maxAgeDays ?? 3}::int)
     order by (status = 'pending') desc, created_at desc limit ${opts.limit ?? 50}
  `;
  const out = emptyResult();
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started > (opts.budgetMs ?? 40_000)) break;
    await checkUnsettled(db, deps, row, now, out);
  }
  return out;
}

// The same check for one creator's own unsettled orders, run when they open the Paid features page,
// so a payment whose return and notice were both lost shows up in seconds, not at the daily job. No
// minimum age (the creator may have just come back); a handful of the newest orders, asked at the
// same time so PayU being slow costs one wait, not several. Orders PayU has never heard of stay as
// they are until a day has passed (then they are closed out, as in the daily job).
export async function settleCreatorOrders(
  db: LedgerDb,
  creatorId: number,
  deps: SettleDeps,
  opts: { maxAgeDays?: number; limit?: number } = {},
): Promise<ReconcileResult> {
  const now = (deps.now ?? (() => new Date()))();
  const stamp = now.toISOString();
  const live = deps.config.mode === "live";
  const rows = await db<UnsettledRow[]>`
    select id::text, txnid, status, amount_minor::text,
           (created_at <= ${stamp}::timestamptz - interval '1 day') as old
      from plan_orders
     where creator_id = ${creatorId} and livemode = ${live}
       and (status = 'pending' or (status = 'failed' and failure_reason is distinct from ${ABANDONED_REASON}))
       and created_at > ${stamp}::timestamptz - make_interval(days => ${opts.maxAgeDays ?? 3}::int)
     order by (status = 'pending') desc, created_at desc limit ${opts.limit ?? 4}
  `;
  const out = emptyResult();
  await Promise.all(rows.map((row) => checkUnsettled(db, deps, row, now, out)));
  return out;
}

// ---- When a pass ends -----------------------------------------------------------------------

// Switches off whatever has ended for one creator, inside a transaction. Takes away the features a
// finished plan added, and only those: a key stays when the owner ticked it, or when the other plan,
// if still running, covers it too. False when nothing had ended (a renewal came in meanwhile).
async function expireUser(
  tx: Query,
  id: string,
  stamp: string,
  byOwner?: { reason: string; originalUntil?: { starter: string | null; creator: string | null } },
): Promise<boolean> {
  const [u] = await tx<{
    paid_features: string[] | null;
    pass_keys: string[] | null;
    starter_ended: boolean;
    starter_running: boolean;
    creator_ended: boolean;
    creator_running: boolean;
    starter_until: string | null;
    creator_until: string | null;
  }[]>`
    select paid_features, pass_keys,
           (starter_until is not null and starter_until <= ${stamp}::timestamptz) as starter_ended,
           (starter_until is not null and starter_until >  ${stamp}::timestamptz) as starter_running,
           (creator_until is not null and creator_until <= ${stamp}::timestamptz) as creator_ended,
           (creator_until is not null and creator_until >  ${stamp}::timestamptz) as creator_running,
           starter_until::text, creator_until::text
      from users where id = ${Number(id)}
       and ((starter_until is not null and starter_until <= ${stamp}::timestamptz)
         or (creator_until is not null and creator_until <= ${stamp}::timestamptz))
       for no key update
  `;
  // Changed under us (a renewal came in): leave it.
  if (!u) return false;
  // What the plans still running keep covering.
  const covered = new Set<string>([
    ...(u.starter_running ? planFeatureKeys("starter") : []),
    ...(u.creator_running ? planFeatureKeys("creator") : []),
  ]);
  const passKeys = u.pass_keys ?? [];
  const gone = new Set(passKeys.filter((k) => !covered.has(k)));
  const kept = (u.paid_features ?? []).filter((k) => !gone.has(k));
  const keptPassKeys = passKeys.filter((k) => covered.has(k));
  await tx`
    update users set paid_features = ${kept}::text[], pass_keys = ${keptPassKeys}::text[],
           starter_until = case when ${u.starter_ended}::boolean then null else starter_until end,
           starter_reminded_until = case when ${u.starter_ended}::boolean then null else starter_reminded_until end,
           starter_anchor_day = case when ${u.starter_ended}::boolean then null else starter_anchor_day end,
           creator_until = case when ${u.creator_ended}::boolean then null else creator_until end,
           creator_reminded_until = case when ${u.creator_ended}::boolean then null else creator_reminded_until end,
           creator_anchor_day = case when ${u.creator_ended}::boolean then null else creator_anchor_day end
     where id = ${Number(id)}
  `;
  const ended = [u.starter_ended ? "starter" : null, u.creator_ended ? "creator" : null].filter(Boolean);
  // When the owner ends a plan early its end date was already set to now; the audit line keeps the date
  // it would have run until.
  const before = {
    features: u.paid_features ?? [],
    starter_until: byOwner?.originalUntil ? byOwner.originalUntil.starter : u.starter_until,
    creator_until: byOwner?.originalUntil ? byOwner.originalUntil.creator : u.creator_until,
  };
  const after = { features: kept, ended };
  if (byOwner) {
    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
      values (null, 'owner', 'plan.ended_by_owner', 'user', ${id}, ${before}::jsonb, ${after}::jsonb, ${byOwner.reason})
    `;
  } else {
    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
      values (null, 'system', 'plan.expired', 'user', ${id}, ${before}::jsonb, ${after}::jsonb,
              ${ended.length === 2 ? "The Starter and Creator passes ended" : `The ${ended[0]} pass ended`})
    `;
  }
  return true;
}

// Switches off the plans whose pass has ended, one creator at a time. Safe to run as often as wanted:
// a plan already cleared is not found again.
export async function expirePasses(db: LedgerDb, now: Date = new Date(), limit = 200): Promise<{ expired: number }> {
  const stamp = now.toISOString();
  const due = await db<{ id: string }[]>`
    select id::text from users
     where (starter_until is not null and starter_until <= ${stamp}::timestamptz)
        or (creator_until is not null and creator_until <= ${stamp}::timestamptz)
     order by least(coalesce(starter_until, 'infinity'::timestamptz), coalesce(creator_until, 'infinity'::timestamptz)) limit ${limit}
  `;
  let expired = 0;
  for (const { id } of due) {
    // One creator whose expiry fails must not stop everyone behind them being switched off.
    const done = await db
      .begin((tx) => expireUser(tx, id, stamp))
      .catch((err: unknown) => {
        console.error(`Plan expiry: creator ${id} could not be switched off, trying the rest:`, err instanceof Error ? err.message : err);
        return false;
      });
    if (done) expired += 1;
  }
  return { expired };
}

// The same switch-off for one creator, for when they open a page and their pass has just ended (so
// the dashboard does not wait for the daily job). False when nothing had ended. Safe to call often.
export async function expireOne(db: LedgerDb, creatorId: number, now: Date = new Date()): Promise<boolean> {
  const stamp = now.toISOString();
  return db.begin((tx) => expireUser(tx, String(creatorId), stamp));
}

// A plan's feature list can grow after a creator bought it (a new feature joins Starter). A running
// pass should get what its plan lists now, so this adds the keys the running plans list and the
// creator does not have: not the ones the owner switched off on purpose (blocked_keys), and each added
// key is remembered as the pass's so the plan's end takes it away again. One audit line per creator
// changed. Safe to run as often as wanted; with `creatorId` it looks at that creator only.
export async function syncRunningPasses(
  db: LedgerDb,
  now: Date = new Date(),
  opts: { creatorId?: number; limit?: number } = {},
): Promise<{ synced: number }> {
  const stamp = now.toISOString();
  const rows = await db<{ id: string; paid_features: string[] | null; blocked_keys: string[] | null; starter: boolean; creator: boolean }[]>`
    select id::text, paid_features, blocked_keys,
           (starter_until is not null and starter_until > ${stamp}::timestamptz) as starter,
           (creator_until is not null and creator_until > ${stamp}::timestamptz) as creator
      from users
     where ((starter_until is not null and starter_until > ${stamp}::timestamptz)
         or (creator_until is not null and creator_until > ${stamp}::timestamptz))
       and (${opts.creatorId ?? null}::bigint is null or id = ${opts.creatorId ?? null}::bigint)
     order by id limit ${opts.limit ?? 1000}
  `;
  let synced = 0;
  for (const row of rows) {
    const wanted = new Set<string>([...(row.starter ? planFeatureKeys("starter") : []), ...(row.creator ? planFeatureKeys("creator") : [])]);
    const have = new Set(row.paid_features ?? []);
    const blocked = new Set(row.blocked_keys ?? []);
    if (![...wanted].some((k) => !have.has(k) && !blocked.has(k))) continue;
    const changed = await db
      .begin(async (tx) => {
        const [u] = await tx<{ paid_features: string[] | null; pass_keys: string[] | null; blocked_keys: string[] | null; starter: boolean; creator: boolean }[]>`
          select paid_features, pass_keys, blocked_keys,
                 (starter_until is not null and starter_until > ${stamp}::timestamptz) as starter,
                 (creator_until is not null and creator_until > ${stamp}::timestamptz) as creator
            from users where id = ${Number(row.id)} for no key update
        `;
        if (!u) return false;
        const want = [...(u.starter ? planFeatureKeys("starter") : []), ...(u.creator ? planFeatureKeys("creator") : [])];
        const has = new Set(u.paid_features ?? []);
        const block = new Set(u.blocked_keys ?? []);
        const add = [...new Set(want)].filter((k) => !has.has(k) && !block.has(k));
        if (add.length === 0) return false;
        await tx`
          update users set paid_features = ${[...(u.paid_features ?? []), ...add]}::text[],
                           pass_keys = ${[...new Set([...(u.pass_keys ?? []), ...add])]}::text[]
           where id = ${Number(row.id)}
        `;
        await tx`
          insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
          values (null, 'system', 'plan.features_synced', 'user', ${row.id}, ${{ added_keys: add }}::jsonb,
                  'A running plan lists features the creator did not have yet')
        `;
        return true;
      })
      .catch((err: unknown) => {
        console.error(`Plan sync: creator ${row.id} could not be updated, trying the rest:`, err instanceof Error ? err.message : err);
        return false;
      });
    if (changed) synced += 1;
  }
  return { synced };
}

// The owner ends one plan now (after a refund by hand, say): its end date becomes now and the same
// switch-off runs, so the features nothing else covers go and the rest stay. False when that plan
// was not running. Writes one audit line, as the owner, with the reason given.
export async function endPlanNow(
  db: LedgerDb,
  creatorId: number,
  plan: PlanKey,
  reason: string,
  now: Date = new Date(),
): Promise<boolean> {
  const stamp = now.toISOString();
  return db.begin(async (tx) => {
    const [u] = await tx<{ running: boolean; starter_until: string | null; creator_until: string | null }[]>`
      select (case when ${plan}::text = 'starter' then starter_until else creator_until end) is not null as running,
             starter_until::text, creator_until::text
        from users where id = ${creatorId} for no key update
    `;
    if (!u?.running) return false;
    await tx`
      update users set starter_until = case when ${plan}::text = 'starter' then ${stamp}::timestamptz else starter_until end,
                       creator_until = case when ${plan}::text = 'creator' then ${stamp}::timestamptz else creator_until end
       where id = ${creatorId}
    `;
    // The paid orders of this plan that had not finished are ended with it: they stop holding an early
    // seat, stop giving the early price on renewal and stop counting as a sale. The rows and receipts stay.
    await tx`
      update plan_orders set ended_at = ${stamp}::timestamptz, ended_reason = ${reason.slice(0, 300)}
       where creator_id = ${creatorId} and plan = ${plan} and status = 'paid' and ended_at is null and pass_ends_at > ${stamp}::timestamptz
    `;
    return expireUser(tx, String(creatorId), stamp, { reason, originalUntil: { starter: u.starter_until, creator: u.creator_until } });
  });
}

// ---- The owner's own feature box ------------------------------------------------------------

// Writes the owner's choice of features for one creator. A pass remembers which keys it added so it
// can take away only those when it ends: whatever the owner unticks is forgotten there (so a later
// manual tick is the owner's own), "everything on" is the owner's own choice, so nothing is left for
// the pass to remove, and `keep` lists pass keys the owner wants to stay after the pass ends (they
// become the owner's own). A feature the owner unticks while it was on is a takedown: it is remembered
// in blocked_keys so a plan bought later does not switch it back on; ticking it again clears that, and
// "everything on" or "everything off" clear the whole list. Call it inside the transaction that holds
// the user row. Before migration 0055 (pass columns) or 0057 (blocked_keys) the columns do not exist;
// then only what exists is written, so the owner's box keeps working until the migration is run.
export async function writeFeatureKeys(
  tx: Query,
  creatorId: number,
  keys: readonly string[],
  everything: boolean,
  opts: { keep?: readonly string[]; takedown?: boolean } = {},
): Promise<void> {
  const [col] = await tx<{ pass: boolean; blocked: boolean }[]>`
    select exists (
             select 1 from information_schema.columns
              where table_schema = current_schema() and table_name = 'users' and column_name = 'pass_keys'
           ) as pass,
           exists (
             select 1 from information_schema.columns
              where table_schema = current_schema() and table_name = 'users' and column_name = 'blocked_keys'
           ) as blocked
  `;
  if (!col?.pass) {
    await tx`update users set paid_features = ${[...keys]}::text[] where id = ${creatorId}`;
    return;
  }
  const keep = [...(opts.keep ?? [])];
  if (!col.blocked) {
    await tx`
      update users set paid_features = ${[...keys]}::text[],
             pass_keys = case when ${everything} then '{}'::text[]
                              else array(select k from unnest(pass_keys) k where k = any(${[...keys]}::text[]) and k <> all(${keep}::text[])) end
       where id = ${creatorId}
    `;
    return;
  }
  await tx`
    update users set paid_features = ${[...keys]}::text[],
           pass_keys = case when ${everything} then '{}'::text[]
                            else array(select k from unnest(pass_keys) k where k = any(${[...keys]}::text[]) and k <> all(${keep}::text[])) end,
           blocked_keys = case when ${Boolean(opts.takedown) && !everything}
                               then array(select distinct k from unnest(blocked_keys || paid_features) k where k <> all(${[...keys]}::text[]))
                               else '{}'::text[] end
     where id = ${creatorId}
  `;
}
