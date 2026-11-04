import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import type { LedgerDb } from "../src/lib/accrual";
import { countNeedsLook, getPlanOrders, markNeedsLookHandled } from "../src/lib/admin/plan-order-queries";
import {
  createPlanOrder,
  endPlanNow,
  expireOne,
  expirePasses,
  NEEDS_LOOK_ACTION,
  reconcilePendingOrders,
  settleCreatorOrders,
  settlePlanPayment,
  syncRunningPasses,
  writeFeatureKeys,
  type SettleDeps,
} from "../src/lib/plan-orders";
import { planFeatureKeys } from "../src/lib/plan-catalogue";
import { purgeOldPlanOrders } from "../src/lib/retention";
import { readReply, replyHash, type PayuConfig, type PayuPayment } from "../src/lib/payu";
import type { PlanPrices } from "../src/lib/pricing";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The fixes after the independent review of the PayU purchase (2026-11-04): a paid creator is settled
// when they open the page, an order records what was agreed, a plan ended by hand frees its early
// seat, a takedown stays down, a month is added on the right day, and a payment at another price is
// shown to the owner.

const NO_EARLY: PlanPrices = { monthly: 299, yearly: 2499, early: null };
const PRICES: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 1 } };
const LIVE: PayuConfig = { key: "testkey", salt: "testsalt", mode: "live" };
const TEST: PayuConfig = { ...LIVE, mode: "test" };
const T0 = new Date("2026-11-10T06:00:00.000Z");
const day = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * day);
const VERSION = "4 November 2026";

let seq = 0;
async function creator(pg: PGlite, features: string[] = []): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, paid_features)
     values ($1, $2, $3, $4, 'active', $5::text[]) returning id::text`,
    [`hd${seq}`, `hd${seq}@example.com`, `hardcreator${seq}`, `Creator ${seq}`, features],
  );
  return Number(r.rows[0].id);
}

async function newOrder(db: LedgerDb, creatorId: number, o: { term?: number; plan?: string; livemode?: boolean; prices?: PlanPrices; now?: Date } = {}) {
  const r = await createPlanOrder(db, {
    creatorId,
    term: o.term ?? 1,
    plan: o.plan ?? "creator",
    prices: o.prices ?? NO_EARLY,
    livemode: o.livemode ?? true,
    isOwner: true,
    termsVersion: VERSION,
    now: o.now ?? T0,
  });
  if (!r.ok) throw new Error(`could not make an order: ${r.reason}`);
  return r.order;
}

function reply(order: { id: number; txnid: string; amountMinor: number }, config = LIVE) {
  const r = readReply({
    key: config.key,
    txnid: order.txnid,
    status: "success",
    unmappedstatus: "captured",
    amount: `${Math.floor(order.amountMinor / 100)}.${String(order.amountMinor % 100).padStart(2, "0")}`,
    productinfo: "Freetip plan",
    firstname: "Riya",
    email: "riya@example.com",
    mihpayid: "pay_1",
    udf1: String(order.id),
  });
  return { ...r, hash: replyHash(r, config.salt) };
}
const paid = (amountMinor: number, payuRef = "pay_1"): PayuPayment => ({ kind: "success", amountMinor, payuRef });
const deps = (answer: (txnid: string) => PayuPayment, now: Date, config = LIVE): SettleDeps & { asked: string[] } => {
  const asked: string[] = [];
  return { config, now: () => now, sleep: async () => {}, asked, fetchPayment: async (t) => (asked.push(t), answer(t)) };
};

const orderRow = async (pg: PGlite, id: number) =>
  (await pg.query<{ status: string; failure_reason: string | null; ended_at: Date | null; ended_reason: string | null; pass_starts_at: Date | null; pass_ends_at: Date | null }>(
    `select status, failure_reason, ended_at, ended_reason, pass_starts_at, pass_ends_at from plan_orders where id = $1`, [id])).rows[0];
const userRow = async (pg: PGlite, id: number) =>
  (await pg.query<{ paid_features: string[]; pass_keys: string[]; blocked_keys: string[]; starter_until: Date | null; creator_until: Date | null; starter_anchor_day: number | null; creator_anchor_day: number | null }>(
    `select paid_features, pass_keys, blocked_keys, starter_until, creator_until, starter_anchor_day, creator_anchor_day from users where id = $1`, [id])).rows[0];
const auditRows = async (pg: PGlite, action: string) =>
  (await pg.query<{ entity_ref: string; before_json: Record<string, unknown> | null; after_json: Record<string, unknown> | null }>(
    `select entity_ref, before_json, after_json from audit_events where action = $1 order by id`, [action])).rows;

test.describe("opening the Paid features page settles the creator's own orders", () => {
  test("a paid order whose return and notice were lost is switched on at once, with no waiting for the daily job", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const now = new Date(T0.getTime() + 20_000); // seconds after the order: far below the daily job's minimum age
    const d = deps(() => paid(o.amountMinor, "pay_lost"), now);
    const r = await settleCreatorOrders(db, c, d);
    expect(r).toMatchObject({ looked: 1, activated: 1 });
    expect((await orderRow(pg, o.id)).status).toBe("paid");
    expect((await userRow(pg, c)).paid_features.length).toBe(planFeatureKeys("creator").length);
    // The daily job's own rule would have skipped it.
    const pg2 = await freshDatabase();
    const db2 = asLedgerDb(pg2);
    const c2 = await creator(pg2);
    await newOrder(db2, c2);
    expect((await reconcilePendingOrders(db2, deps(() => paid(1), now))).looked).toBe(0);
    // A second page load changes nothing and pays nothing twice.
    expect((await settleCreatorOrders(db, c, d)).looked).toBe(0);
  });

  test("a failed first attempt then a paid second one (notices lost): the second is paid, so the page does not say it failed", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const first = await newOrder(db, c);
    await settlePlanPayment(db, { ...reply(first), status: "failure", hash: "" }, deps(() => ({ kind: "failure", reason: "declined" }), T0)).catch(() => {});
    const failedReply = readReply({ key: LIVE.key, txnid: first.txnid, status: "failure", amount: "299.00", productinfo: "Freetip plan", firstname: "Riya", email: "riya@example.com", udf1: String(first.id) });
    await settlePlanPayment(db, { ...failedReply, hash: replyHash(failedReply, LIVE.salt) }, deps(() => ({ kind: "failure", reason: "declined" }), T0));
    expect((await orderRow(pg, first.id)).status).toBe("failed");
    const second = await newOrder(db, c, { now: addDays(T0, 0.01) });
    const answers: Record<string, PayuPayment> = { [first.txnid]: { kind: "failure", reason: "declined" }, [second.txnid]: paid(second.amountMinor, "pay_second") };
    const r = await settleCreatorOrders(db, c, deps((t) => answers[t], addDays(T0, 0.02)));
    expect(r.activated).toBe(1);
    expect((await orderRow(pg, second.id)).status).toBe("paid");
    expect((await orderRow(pg, first.id)).status).toBe("failed");
  });

  test("it asks only about this creator's orders in the server's own mode, and not about an old order or an abandoned one", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const me = await creator(pg);
    const other = await creator(pg);
    const mine = await newOrder(db, me, { now: addDays(T0, 1) });
    await newOrder(db, other, { now: addDays(T0, 1) });
    await newOrder(db, me, { livemode: false, now: addDays(T0, 1) }); // a test order closes nothing live
    const old = await newOrder(db, await creator(pg), { now: T0 });
    const d = deps(() => ({ kind: "pending" }), addDays(T0, 1.5));
    // `mine` was closed by the owner's test order? No: a test order is another mode, so it stays pending.
    expect((await settleCreatorOrders(db, me, d)).looked).toBe(1);
    expect(d.asked).toEqual([mine.txnid]);
    expect(old.id).toBeGreaterThan(0);
    // In test mode only the creator's test order is asked about.
    const dt = deps(() => ({ kind: "pending" }), addDays(T0, 1.5), TEST);
    expect((await settleCreatorOrders(db, me, dt)).looked).toBe(1);
    // Three days later nothing is asked.
    expect((await settleCreatorOrders(db, me, deps(() => ({ kind: "pending" }), addDays(T0, 4)))).looked).toBe(0);
  });

  test("refreshing the page cannot flood PayU: one question per order every 20 seconds, however many loads", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const d = deps(() => ({ kind: "pending" }), T0);
    // Several page loads at the same moment (two tabs, two servers) ask once between them.
    const results = await Promise.all([settleCreatorOrders(db, c, d), settleCreatorOrders(db, c, d), settleCreatorOrders(db, c, d)]);
    expect(results.reduce((n, r) => n + r.looked, 0)).toBe(1);
    expect(d.asked).toEqual([o.txnid]);
    // Ten seconds on: still nothing. Thirty seconds on: asked again.
    const at = (secs: number) => deps(() => ({ kind: "pending" }), new Date(T0.getTime() + secs * 1000));
    expect((await settleCreatorOrders(db, c, at(10))).looked).toBe(0);
    expect((await settleCreatorOrders(db, c, at(30))).looked).toBe(1);
  });

  test("a pending order is asked about for a day, a failed one for two hours, then the daily job takes over", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    // The first order is cancelled (failed) before the second is made, because a new order closes older pending ones.
    const failed = await newOrder(db, c);
    await pg.query(`update plan_orders set status = 'failed', failure_reason = 'cancelled', failed_at = $2::timestamptz where id = $1`, [failed.id, T0.toISOString()]);
    const pending = await newOrder(db, c);
    await pg.query(`update plan_orders set checked_at = null`);
    const hoursLater = (h: number) => deps(() => ({ kind: "pending" }), new Date(T0.getTime() + h * 3_600_000));
    const within = hoursLater(1);
    expect((await settleCreatorOrders(db, c, within)).looked).toBe(2);
    await pg.query(`update plan_orders set checked_at = null`);
    const afterTwo = hoursLater(3);
    await settleCreatorOrders(db, c, afterTwo);
    expect(afterTwo.asked).toEqual([pending.txnid]);
    await pg.query(`update plan_orders set checked_at = null`);
    expect((await settleCreatorOrders(db, c, hoursLater(25))).looked).toBe(0);
  });

  test("PayU unreachable changes nothing; one order that throws does not stop the others", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await newOrder(db, c);
    const noisy = console.error;
    console.error = () => {};
    try {
      const down = await settleCreatorOrders(db, c, deps(() => ({ kind: "unavailable", reason: "timeout" }), T0));
      expect(down).toMatchObject({ looked: 1, unavailable: 1, activated: 0 });
      // A page load asks about an order at most every 20 seconds, so the second look is a little later.
      const later = new Date(T0.getTime() + 30_000);
      const boom = await settleCreatorOrders(db, c, { config: LIVE, now: () => later, sleep: async () => {}, fetchPayment: async () => { throw new Error("boom"); } });
      expect(boom).toMatchObject({ looked: 1, errors: 1 });
    } finally {
      console.error = noisy;
    }
    expect((await orderRow(pg, a.id)).status).toBe("pending");
  });
});

test.describe("a payment at another price is shown to the owner", () => {
  test("it is flagged once, counted, listed, and nothing is switched on", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const noisy = console.error;
    console.error = () => {};
    try {
      const d = deps(() => ({ kind: "mismatch", reason: "a discount was applied" }), addDays(T0, 1));
      await reconcilePendingOrders(db, d);
      await reconcilePendingOrders(db, d); // asked twice, written once
      // A notice that PayU's check disagrees with also writes it, once.
      await settlePlanPayment(db, reply(o), d);
    } finally {
      console.error = noisy;
    }
    expect((await auditRows(pg, NEEDS_LOOK_ACTION)).length).toBe(1);
    expect(await countNeedsLook(db)).toBe(1);
    const listed = await getPlanOrders(db, { needsLookOnly: true });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: o.id, status: "pending", needsLook: "a discount was applied", termsVersion: VERSION });
    expect((await userRow(pg, c)).paid_features).toEqual([]);
    // Once it is paid (by hand, or later at the plain price) it leaves the list.
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), addDays(T0, 1)));
    expect(await countNeedsLook(db)).toBe(0);
  });

  test("Mark handled takes it off the list and the badge once, keeps the reason, and changes nothing else", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const calm = await newOrder(db, await creator(pg));
    const noisy = console.error;
    console.error = () => {};
    try {
      await reconcilePendingOrders(db, deps(() => ({ kind: "mismatch", reason: "a discount was applied" }), addDays(T0, 1)));
    } finally {
      console.error = noisy;
    }
    expect(await countNeedsLook(db)).toBe(2);
    // An order that was never flagged cannot be marked, and neither can one that does not exist.
    const clean = await newOrder(db, await creator(pg), { now: addDays(T0, 2) });
    expect(await markNeedsLookHandled(db, clean.id, "x")).toBe("not_flagged");
    expect(await markNeedsLookHandled(db, 999999, "x")).toBe("not_flagged");
    expect(await markNeedsLookHandled(db, o.id, "refunded in PayU")).toBe("handled");
    expect(await markNeedsLookHandled(db, o.id, "again")).toBe("already_handled");
    expect(await countNeedsLook(db)).toBe(1);
    expect((await getPlanOrders(db, { needsLookOnly: true })).map((r) => r.id)).toEqual([calm.id]);
    // The audit line keeps the reason, the order itself is untouched, and the flag line is still there.
    const handled = await auditRows(pg, "plan.payment_look_handled");
    expect(handled).toHaveLength(1);
    expect((await orderRow(pg, o.id)).status).toBe("pending");
    expect((await auditRows(pg, NEEDS_LOOK_ACTION)).length).toBe(2);
    // The note stays readable in the full list.
    const all = await getPlanOrders(db, { creatorId: c });
    expect(all[0].needsLook).toBe("a discount was applied");
  });
});

test.describe("ending a plan by hand", () => {
  test("the original end date is kept in the audit line, the early seat is freed and the sale is not counted", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c, { prices: PRICES });
    expect(o.early).toBe(true);
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    const endsAt = (await userRow(pg, c)).creator_until!;
    // Seat is taken: another creator pays the normal price.
    expect((await newOrder(db, await creator(pg), { prices: PRICES, now: addDays(T0, 1) })).early).toBe(false);
    const stamp = addDays(T0, 2);
    expect(await endPlanNow(db, c, "creator", "refunded by hand", stamp)).toBe(true);
    expect((await orderRow(pg, o.id)).ended_at?.toISOString()).toBe(stamp.toISOString());
    expect((await orderRow(pg, o.id)).ended_reason).toBe("refunded by hand");
    const audit = (await auditRows(pg, "plan.ended_by_owner"))[0];
    expect(audit.before_json).toMatchObject({ creator_until: expect.stringContaining("2026-12-10") });
    expect(new Date(String(audit.before_json!.creator_until)).toISOString()).toBe(endsAt.toISOString());
    expect(audit.after_json).toMatchObject({ ended: ["creator"] });
    // The seat is free again for a new creator, and the refunded creator does not keep the early price.
    expect((await newOrder(db, await creator(pg), { prices: PRICES, now: addDays(T0, 3) })).early).toBe(true);
    expect((await newOrder(db, c, { prices: { ...PRICES, early: { monthly: 149, yearly: 1299, seats: 0 } }, now: addDays(T0, 3) })).early).toBe(false);
    // The books do not count it (the GST figure reads this).
    const { rows } = await pg.query<{ sold: string }>(`select coalesce(sum(amount_minor), 0)::text as sold from plan_orders where status = 'paid' and livemode and ended_at is null`);
    expect(rows[0].sold).toBe("0");
  });

  test("an order whose term already finished is not marked ended", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await newOrder(db, c, { now: T0 });
    await settlePlanPayment(db, reply(a), deps(() => paid(a.amountMinor, "pay_a"), T0));
    const b = await newOrder(db, c, { now: addDays(T0, 40) });
    await settlePlanPayment(db, reply(b), deps(() => paid(b.amountMinor, "pay_b"), addDays(T0, 40)));
    expect(await endPlanNow(db, c, "creator", "refund", addDays(T0, 41))).toBe(true);
    expect((await orderRow(pg, a.id)).ended_at).toBeNull();
    expect((await orderRow(pg, b.id)).ended_at).not.toBeNull();
  });
});

test.describe("a Starter term a running Creator pass covers", () => {
  test("paid after Creator was bought, it starts when Creator ends instead of adding nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    // The creator opens a Starter order, then buys a 12 month Creator, then pays the Starter one.
    const starter = await newOrder(db, c, { plan: "starter", now: T0 });
    const creatorOrder = await createPlanOrder(db, { creatorId: c, term: 12, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: true, termsVersion: VERSION, now: addDays(T0, 0.1) });
    if (!creatorOrder.ok) throw new Error("order");
    await settlePlanPayment(db, reply(creatorOrder.order), deps(() => paid(creatorOrder.order.amountMinor, "pay_c"), addDays(T0, 0.1)));
    const creatorEnds = (await userRow(pg, c)).creator_until!;
    await settlePlanPayment(db, reply(starter), deps(() => paid(starter.amountMinor, "pay_s"), addDays(T0, 0.2)));
    const u = await userRow(pg, c);
    // One month of Starter after Creator ends, not one month that overlaps it.
    expect(u.starter_until!.getTime()).toBeGreaterThan(creatorEnds.getTime());
    const row = await orderRow(pg, starter.id);
    expect(row.pass_starts_at!.toISOString()).toBe(creatorEnds.toISOString());
    expect(row.pass_ends_at!.toISOString().slice(0, 10)).toBe("2027-12-10");
  });

  test("a partly covered term is left as it was", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const creatorOrder = await newOrder(db, c, { plan: "creator", term: 1, now: T0 });
    await settlePlanPayment(db, reply(creatorOrder), deps(() => paid(creatorOrder.amountMinor, "pay_c"), T0));
    const starter = await newOrder(db, c, { plan: "starter", term: 12, now: addDays(T0, 1) });
    await settlePlanPayment(db, reply(starter), deps(() => paid(starter.amountMinor, "pay_s"), addDays(T0, 1)));
    const row = await orderRow(pg, starter.id);
    expect(row.pass_starts_at!.toISOString()).toBe(addDays(T0, 1).toISOString());
  });
});

test.describe("a month is added on the day the run started", () => {
  test("Jan 31 plus one month is Feb 28, and one more renewal is Mar 31, not Mar 28", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const jan31 = new Date("2027-01-31T08:30:00.000Z");
    const a = await newOrder(db, c, { now: jan31 });
    await settlePlanPayment(db, reply(a), deps(() => paid(a.amountMinor, "pay_a"), jan31));
    expect((await userRow(pg, c)).creator_until!.toISOString()).toBe("2027-02-28T08:30:00.000Z");
    expect((await userRow(pg, c)).creator_anchor_day).toBe(31);
    const b = await newOrder(db, c, { now: addDays(jan31, 1) });
    await settlePlanPayment(db, reply(b), deps(() => paid(b.amountMinor, "pay_b"), addDays(jan31, 1)));
    expect((await userRow(pg, c)).creator_until!.toISOString()).toBe("2027-03-31T08:30:00.000Z");
    const e = await newOrder(db, c, { now: addDays(jan31, 2) });
    await settlePlanPayment(db, reply(e), deps(() => paid(e.amountMinor, "pay_e"), addDays(jan31, 2)));
    expect((await userRow(pg, c)).creator_until!.toISOString()).toBe("2027-04-30T08:30:00.000Z");
  });

  test("an ordinary day is unchanged, 12 months from Feb 29 lands on Feb 28, and a new run starts a new anchor", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const leap = new Date("2028-02-29T06:00:00.000Z");
    const a = await newOrder(db, c, { term: 12, now: leap });
    await settlePlanPayment(db, reply(a), deps(() => paid(a.amountMinor, "pay_a"), leap));
    expect((await userRow(pg, c)).creator_until!.toISOString()).toBe("2029-02-28T06:00:00.000Z");
    // After it ends, a purchase on the 15th starts a run anchored on the 15th.
    const later = new Date("2029-06-15T06:00:00.000Z");
    expect(await expirePasses(db, later)).toEqual({ expired: 1, failed: 0 });
    expect((await userRow(pg, c)).creator_anchor_day).toBeNull();
    const b = await newOrder(db, c, { now: later });
    await settlePlanPayment(db, reply(b), deps(() => paid(b.amountMinor, "pay_b"), later));
    expect((await userRow(pg, c)).creator_until!.toISOString()).toBe("2029-07-15T06:00:00.000Z");
    expect((await userRow(pg, c)).creator_anchor_day).toBe(15);
  });
});

test.describe("the owner's takedown and the owner's own ticks", () => {
  test("Turn all off while a plan runs stays off: the daily sync does not put the features back", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c, { plan: "creator" });
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    const on = (await userRow(pg, c)).paid_features;
    expect(on.length).toBeGreaterThan(0);
    // What the admin action now does for "Turn all off": every key off, as a takedown.
    await db.begin((tx) => writeFeatureKeys(tx, c, [], false, { takedown: true }));
    expect((await userRow(pg, c)).paid_features).toEqual([]);
    expect([...(await userRow(pg, c)).blocked_keys].sort()).toEqual([...on].sort());
    expect(await syncRunningPasses(db, addDays(T0, 1))).toEqual({ synced: 0 });
    expect((await userRow(pg, c)).paid_features).toEqual([]);
    // "Turn on everything that exists" clears the hold.
    await db.begin((tx) => writeFeatureKeys(tx, c, planFeatureKeys("creator"), true, { takedown: false }));
    expect((await userRow(pg, c)).blocked_keys).toEqual([]);
  });

  test("a feature unticked while on stays off when a plan is bought later; ticking it again clears the block", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, ["customAlertMedia", "alertText"]);
    // The owner switches customAlertMedia off (a takedown) and keeps alertText.
    await db.begin((tx) => writeFeatureKeys(tx, c, ["alertText"], false, { takedown: true }));
    expect((await userRow(pg, c)).blocked_keys).toEqual(["customAlertMedia"]);
    const o = await newOrder(db, c, { plan: "creator" });
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    const u = await userRow(pg, c);
    expect(u.paid_features).not.toContain("customAlertMedia");
    expect(u.paid_features).toContain("alertText");
    expect(u.pass_keys).not.toContain("customAlertMedia");
    expect((await auditRows(pg, "plan.purchased"))[0].after_json).toMatchObject({ skipped_blocked_keys: ["customAlertMedia"] });
    // Ticking it again clears the block.
    await db.begin((tx) => writeFeatureKeys(tx, c, [...u.paid_features, "customAlertMedia"], false, { takedown: true }));
    expect((await userRow(pg, c)).blocked_keys).toEqual([]);
  });

  test("a feature that was never on is not a takedown, and everything on or off clears the list", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, ["alertText"]);
    await db.begin((tx) => writeFeatureKeys(tx, c, ["alertText"], false, { takedown: true }));
    expect((await userRow(pg, c)).blocked_keys).toEqual([]);
    await db.begin((tx) => writeFeatureKeys(tx, c, [], false, { takedown: true }));
    expect((await userRow(pg, c)).blocked_keys).toEqual(["alertText"]);
    // Called without a takedown (or with "turn on everything") the list is cleared; the admin action
    // asks for a takedown on Save and on Turn all off, and clears it only on Turn on everything.
    await db.begin((tx) => writeFeatureKeys(tx, c, [], false, { takedown: false }));
    expect((await userRow(pg, c)).blocked_keys).toEqual([]);
    await db.begin((tx) => writeFeatureKeys(tx, c, ["alertText"], true, { takedown: true }));
    expect((await userRow(pg, c)).blocked_keys).toEqual([]);
  });

  test("a pass key marked Keep stays after the plan ends", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c, { plan: "starter" });
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    const before = await userRow(pg, c);
    expect(before.pass_keys).toContain("alertText");
    await db.begin((tx) => writeFeatureKeys(tx, c, before.paid_features, false, { keep: ["alertText"], takedown: true }));
    const mid = await userRow(pg, c);
    expect(mid.pass_keys).not.toContain("alertText");
    expect(mid.pass_keys.length).toBe(before.pass_keys.length - 1);
    await expirePasses(db, addDays(T0, 40));
    const after = await userRow(pg, c);
    expect(after.paid_features).toEqual(["alertText"]);
    expect(after.pass_keys).toEqual([]);
  });
});

test.describe("keeping running plans in step with the feature list", () => {
  test("a running plan gets the features it lists today, never a blocked one, and the plan's end takes them away again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const blockedOne = await creator(pg);
    const o = await newOrder(db, c, { plan: "starter" });
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    const ob = await newOrder(db, blockedOne, { plan: "starter" });
    await settlePlanPayment(db, reply(ob), deps(() => paid(ob.amountMinor, "pay_b"), T0));
    // Simulate a feature that joined Starter after both bought: take one key away from both, block it for one.
    await pg.query(`update users set paid_features = array_remove(paid_features, 'alertMotion'), pass_keys = array_remove(pass_keys, 'alertMotion') where id in ($1, $2)`, [c, blockedOne]);
    await pg.query(`update users set blocked_keys = array['alertMotion'] where id = $1`, [blockedOne]);
    const now = addDays(T0, 2);
    expect(await syncRunningPasses(db, now)).toEqual({ synced: 1 });
    expect((await userRow(pg, c)).paid_features).toContain("alertMotion");
    expect((await userRow(pg, c)).pass_keys).toContain("alertMotion");
    expect((await userRow(pg, blockedOne)).paid_features).not.toContain("alertMotion");
    expect(await syncRunningPasses(db, now)).toEqual({ synced: 0 });
    // A plan that is not running is not topped up.
    await expirePasses(db, addDays(T0, 40));
    await pg.query(`update users set starter_until = null where id = $1`, [c]);
    expect(await syncRunningPasses(db, addDays(T0, 41), { creatorId: c })).toEqual({ synced: 0 });
  });

  test("a plan that has just ended is switched off for that creator by one call", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c, { plan: "creator" });
    await settlePlanPayment(db, reply(o), deps(() => paid(o.amountMinor), T0));
    expect(await expireOne(db, c, addDays(T0, 5))).toBe(false);
    expect(await expireOne(db, c, addDays(T0, 31))).toBe(true);
    expect((await userRow(pg, c)).paid_features).toEqual([]);
    expect(await expireOne(db, c, addDays(T0, 32))).toBe(false);
  });
});

test.describe("how long orders are kept (the privacy policy's promise)", () => {
  test("an order never paid goes after 12 months, a paid one after 8 years, and nothing else is touched", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const stale = await newOrder(db, c, { now: new Date("2025-10-01T00:00:00.000Z") }); // pending, over a year old
    const young = await newOrder(db, await creator(pg), { now: new Date(Date.now() - 30 * day) });
    const ancient = await newOrder(db, await creator(pg), { now: new Date("2017-06-01T00:00:00.000Z") });
    await settlePlanPayment(db, reply(ancient), deps(() => paid(ancient.amountMinor, "pay_old"), new Date("2017-06-01T00:00:00.000Z")));
    const recentPaid = await newOrder(db, await creator(pg), { now: new Date(Date.now() - 400 * day) });
    await settlePlanPayment(db, reply(recentPaid), deps(() => paid(recentPaid.amountMinor, "pay_recent"), new Date(Date.now() - 400 * day)));
    expect(await purgeOldPlanOrders(db)).toEqual({ unpaid: 1, paid: 1 });
    const left = (await pg.query<{ id: string }>(`select id::text from plan_orders order by id`)).rows.map((r) => Number(r.id));
    expect(left).toEqual([young.id, recentPaid.id]);
    expect(stale.id).not.toBe(young.id);
    expect(await auditRows(pg, "plan_orders.purged")).toHaveLength(1);
    // A second run finds nothing and writes no second line.
    expect(await purgeOldPlanOrders(db)).toEqual({ unpaid: 0, paid: 0 });
    expect(await auditRows(pg, "plan_orders.purged")).toHaveLength(1);
  });
});
