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
  | { ok: false; reason: "no_price" | "not_active" | "test_not_allowed" | "too_many" | "bad_term" | "bad_plan" | "already_covered" }
  // The price is not what the creator was shown (an early seat went, or the prices changed). Nothing
  // was made; `amountMinor` is what it costs now.
  | { ok: false; reason: "price_changed"; amountMinor: number };

// At most this many unpaid orders per creator per hour, so the button cannot be used to fill the table.
const PENDING_PER_HOUR = 5;
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
     where early and livemode and plan = ${plan} and creator_id <> ${creatorId}
       and (status = 'paid' or (status = 'pending' and created_at > ${now}::timestamptz - make_interval(hours => ${EARLY_HOLD_HOURS}::int)))
  `;
  // Renewing: the creator's latest paid order of this plan was an early one and ended recently (or still runs).
  const [last] = await tx<{ early: boolean; ends: boolean }[]>`
    select early, pass_ends_at >= ${now}::timestamptz - make_interval(days => ${EARLY_GRACE_DAYS}::int) as ends
      from plan_orders where creator_id = ${creatorId} and plan = ${plan} and status = 'paid' and livemode
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
    txnid?: string;
    now?: Date;
  },
): Promise<CreateOrderResult> {
  const term = TERMS.find((t) => t === o.term);
  if (!term) return { ok: false, reason: "bad_term" };
  const plan = PLAN_KEYS.find((p) => p === o.plan);
  if (!plan) return { ok: false, reason: "bad_plan" };
  if (!o.livemode && !o.isOwner) return { ok: false, reason: "test_not_allowed" };
  const now = (o.now ?? new Date()).toISOString();
  return db.begin(async (tx) => {
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
       where creator_id = ${o.creatorId} and status = 'pending' and created_at > ${now}::timestamptz - interval '1 hour'
    `;
    if (Number(recent?.n ?? "0") >= PENDING_PER_HOUR) return { ok: false, reason: "too_many" } as const;
    const txnid = o.txnid ?? newTxnid();
    const [row] = await tx<{ id: string }[]>`
      insert into plan_orders (creator_id, txnid, term_months, plan, amount_minor, early, livemode, created_at)
      values (${o.creatorId}, ${txnid}, ${term}, ${plan}, ${chosen.amountMinor}, ${chosen.early}, ${o.livemode}, ${now}::timestamptz)
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
  if (answer.kind === "mismatch") return { status: "rejected", reason: "not_confirmed", detail: answer.reason };
  if (answer.kind !== "success" || answer.amountMinor !== Number(order.amount_minor)) return { status: "rejected", reason: "not_confirmed" };

  // The payment id comes from PayU's own answer; the id in the posted reply is not covered by the hash.
  return activate(db, orderId, answer.payuRef, (deps.now ?? (() => new Date()))());
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
      const [user] = await tx<{ creator_status: string; paid_features: string[] | null; pass_keys: string[] | null; plan_until: string | null }[]>`
        select creator_status, paid_features, pass_keys,
               (case when ${plan}::text = 'starter' then starter_until else creator_until end)::text as plan_until
          from users where id = ${creatorId} for no key update
      `;
      // Months are added in UTC, so the session's time zone can never move the end date. The new term
      // starts when this plan's current pass ends, or now when it has ended (or never ran).
      const [span] = await tx<{ starts: string; ends: string }[]>`
        select greatest(coalesce(${user.plan_until}::text::timestamptz, ${stamp}::timestamptz), ${stamp}::timestamptz)::text as starts,
               (((greatest(coalesce(${user.plan_until}::text::timestamptz, ${stamp}::timestamptz), ${stamp}::timestamptz)) at time zone 'UTC'
                  + make_interval(months => ${order.term_months}::int)) at time zone 'UTC')::text as ends
      `;
      const user2 = { ...user, ...span };
      if (user2.creator_status !== "active") {
        // Paid, but the account is suspended or closed. The pass is still recorded; the owner may
        // want to refund by hand.
        console.error(`Plan order ${orderId} was paid for a creator whose account is ${user2.creator_status}: check whether to refund.`);
      }
      const have = new Set(user2.paid_features ?? []);
      // Only keys not already on are the pass's to take away later; a key the owner ticked stays theirs.
      const added = planFeatureKeys(plan).filter((k) => !have.has(k));
      const features = [...(user2.paid_features ?? []), ...added];
      const passKeys = [...new Set([...(user2.pass_keys ?? []), ...added])];

      await tx`
        update users set paid_features = ${features}::text[], pass_keys = ${passKeys}::text[],
                         starter_until = case when ${plan}::text = 'starter' then ${user2.ends}::timestamptz else starter_until end,
                         creator_until = case when ${plan}::text = 'creator' then ${user2.ends}::timestamptz else creator_until end
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
                ${{ order_id: orderId, plan, term_months: order.term_months, amount_minor: Number(order.amount_minor), pass_ends_at: user2.ends, added_keys: added, livemode: order.livemode }}::jsonb,
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
  // PayU says paid, but not the plain price: the owner has to look (also written to the log).
  needsLook: number;
  errors: number;
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
  const rows = await db<{ id: string; txnid: string; status: string; amount_minor: string; old: boolean }[]>`
    select id::text, txnid, status, amount_minor::text,
           (created_at <= ${stamp}::timestamptz - interval '1 day') as old
      from plan_orders
     where livemode = ${live}
       and (status = 'pending' or (status = 'failed' and failure_reason is distinct from ${ABANDONED_REASON}))
       and created_at <= ${stamp}::timestamptz - make_interval(mins => ${opts.minAgeMinutes ?? 10}::int)
       and created_at >  ${stamp}::timestamptz - make_interval(days => ${opts.maxAgeDays ?? 3}::int)
     order by (status = 'pending') desc, created_at desc limit ${opts.limit ?? 50}
  `;
  const out: ReconcileResult = { looked: 0, activated: 0, failed: 0, abandoned: 0, stillPending: 0, unavailable: 0, needsLook: 0, errors: 0 };
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started > (opts.budgetMs ?? 40_000)) break;
    out.looked += 1;
    try {
      const answer = await deps.fetchPayment(row.txnid);
      if (answer.kind === "unavailable") out.unavailable += 1;
      else if (answer.kind === "success" && answer.amountMinor === Number(row.amount_minor)) {
        const r = await activate(db, Number(row.id), answer.payuRef, now);
        if (r.status === "activated") out.activated += 1;
      } else if (answer.kind === "success" || answer.kind === "mismatch") {
        out.needsLook += 1;
        console.error(`Plan order ${row.id} (txnid ${row.txnid}) is paid at PayU but not at the plain price: ${answer.kind === "mismatch" ? answer.reason : "the amount differs"}. Look at it by hand.`);
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
  return out;
}

// ---- When a pass ends -----------------------------------------------------------------------

// Switches off whatever has ended for one creator, inside a transaction. Takes away the features a
// finished plan added, and only those: a key stays when the owner ticked it, or when the other plan,
// if still running, covers it too. False when nothing had ended (a renewal came in meanwhile).
async function expireUser(tx: Query, id: string, stamp: string, byOwner?: { reason: string }): Promise<boolean> {
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
           creator_until = case when ${u.creator_ended}::boolean then null else creator_until end,
           creator_reminded_until = case when ${u.creator_ended}::boolean then null else creator_reminded_until end
     where id = ${Number(id)}
  `;
  const ended = [u.starter_ended ? "starter" : null, u.creator_ended ? "creator" : null].filter(Boolean);
  const before = { features: u.paid_features ?? [], starter_until: u.starter_until, creator_until: u.creator_until };
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
    const [u] = await tx<{ running: boolean }[]>`
      select (case when ${plan}::text = 'starter' then starter_until else creator_until end) is not null as running
        from users where id = ${creatorId} for no key update
    `;
    if (!u?.running) return false;
    await tx`
      update users set starter_until = case when ${plan}::text = 'starter' then ${stamp}::timestamptz else starter_until end,
                       creator_until = case when ${plan}::text = 'creator' then ${stamp}::timestamptz else creator_until end
       where id = ${creatorId}
    `;
    return expireUser(tx, String(creatorId), stamp, { reason });
  });
}

// ---- The owner's own feature box ------------------------------------------------------------

// Writes the owner's choice of features for one creator. A pass remembers which keys it added so it
// can take away only those when it ends: whatever the owner unticks is forgotten there (so a later
// manual tick is the owner's own), and "everything on" is the owner's own choice, so nothing is left
// for the pass to remove. Call it inside the transaction that holds the user row. Before migration
// 0055 the pass columns do not exist; then only the features are written, so the owner's box keeps
// working until the migration is run.
export async function writeFeatureKeys(tx: Query, creatorId: number, keys: readonly string[], everything: boolean): Promise<void> {
  const [col] = await tx<{ ok: boolean }[]>`
    select exists (
      select 1 from information_schema.columns
       where table_schema = current_schema() and table_name = 'users' and column_name = 'pass_keys'
    ) as ok
  `;
  if (!col?.ok) {
    await tx`update users set paid_features = ${[...keys]}::text[] where id = ${creatorId}`;
    return;
  }
  await tx`
    update users set paid_features = ${[...keys]}::text[],
           pass_keys = case when ${everything} then '{}'::text[]
                            else array(select k from unnest(pass_keys) k where k = any(${[...keys]}::text[])) end
     where id = ${creatorId}
  `;
}
