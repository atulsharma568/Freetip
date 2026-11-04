import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import type { LedgerDb } from "../src/lib/accrual";
import {
  chooseAmount,
  createPlanOrder,
  expirePasses,
  newTxnid,
  reconcilePendingOrders,
  settlePlanPayment,
  writeFeatureKeys,
  ABANDONED_REASON,
  type SettleDeps,
} from "../src/lib/plan-orders";
import { planFeatureKeys } from "../src/lib/plan-catalogue";
import { featureSnapshot } from "../src/lib/plans";
import { readReply, replyHash, type PayuConfig, type PayuPayment } from "../src/lib/payu";
import type { PlanPrices } from "../src/lib/pricing";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Buying a pass against the real schema, in memory: a payment is believed only when everything
// agrees, it switches features on once however often it is delivered, and a pass that ends takes
// away only what it added. (One connection, so lock races are not shown here; the rows are locked
// in the code and that needs a real database to see.)

// What a Creator pass switches on (the plan the older tests buy).
const PASS_FEATURE_KEYS = planFeatureKeys("creator");

const PRICES: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 2 } };
const NO_EARLY: PlanPrices = { monthly: 299, yearly: 2499, early: null };
const LIVE: PayuConfig = { key: "testkey", salt: "testsalt", mode: "live" };
const TEST: PayuConfig = { ...LIVE, mode: "test" };
const T0 = new Date("2026-11-10T06:00:00.000Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

let seq = 0;
async function creator(pg: PGlite, o: { status?: string; features?: string[] } = {}): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, paid_features)
     values ($1, $2, $3, $4, $5, $6::text[]) returning id::text`,
    [`pg${seq}`, `pc${seq}@example.com`, `pcreator${seq}`, `Creator ${seq}`, o.status ?? "active", o.features ?? []],
  );
  return Number(r.rows[0].id);
}

async function userRow(pg: PGlite, id: number) {
  // `pass_until` is the Creator plan's end (the plan the older tests buy); `starter_until` the Starter's.
  const r = await pg.query<{ paid_features: string[]; pass_keys: string[]; pass_until: Date | null; starter_until: Date | null }>(
    `select paid_features, pass_keys, creator_until as pass_until, starter_until from users where id = $1`,
    [id],
  );
  return r.rows[0];
}
const orderRow = async (pg: PGlite, id: number) =>
  (await pg.query<{ status: string; payu_ref: string | null; pass_ends_at: Date | null; added_keys: string[]; failure_reason: string | null }>(
    `select status, payu_ref, pass_ends_at, added_keys, failure_reason from plan_orders where id = $1`,
    [id],
  )).rows[0];
const auditCount = async (pg: PGlite, action: string) =>
  Number((await pg.query<{ n: string }>(`select count(*)::text as n from audit_events where action = $1`, [action])).rows[0].n);

async function newOrder(db: LedgerDb, creatorId: number, o: { term?: number; plan?: string; livemode?: boolean; prices?: PlanPrices; now?: Date } = {}) {
  const r = await createPlanOrder(db, {
    creatorId,
    term: o.term ?? 1,
    plan: o.plan ?? "creator",
    prices: o.prices ?? NO_EARLY,
    livemode: o.livemode ?? true,
    isOwner: false,
    now: o.now ?? T0,
  });
  if (!r.ok) throw new Error(`could not make an order: ${r.reason}`);
  return r.order;
}

// A reply PayU would send: filled in and signed with the salt.
function payuReply(order: { id: number; txnid: string; amountMinor: number }, over: Record<string, string> = {}, config = LIVE) {
  const fields: Record<string, string> = {
    key: config.key,
    txnid: order.txnid,
    status: "success",
    unmappedstatus: "captured",
    amount: `${Math.floor(order.amountMinor / 100)}.${String(order.amountMinor % 100).padStart(2, "0")}`,
    productinfo: "Freetip paid features",
    firstname: "Riya",
    email: "riya@example.com",
    mihpayid: "pay_1",
    udf1: String(order.id),
    ...over,
  };
  const r = readReply(fields);
  return over.hash !== undefined ? { ...r, hash: over.hash } : { ...r, hash: replyHash(r, config.salt) };
}

// A pretend PayU: answers the check, and counts how often it was asked.
function payu(answer: PayuPayment | (() => PayuPayment), config = LIVE): SettleDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    config,
    calls,
    now: () => T0,
    sleep: async () => {},
    fetchPayment: async (txnid) => {
      calls.push(txnid);
      return typeof answer === "function" ? answer() : answer;
    },
  };
}
const paid = (amountMinor: number, payuRef = "pay_1"): PayuPayment => ({ kind: "success", amountMinor, payuRef });

test.describe("the price", () => {
  test("is null until the prices are set, and picks the term and the early price", () => {
    expect(chooseAmount({ monthly: null, yearly: null, early: null }, 1, 0)).toBeNull();
    expect(chooseAmount({ monthly: 299, yearly: null, early: null }, 1, 0)).toBeNull();
    expect(chooseAmount(PRICES, 1, 0)).toEqual({ amountMinor: 14900, early: true });
    expect(chooseAmount(PRICES, 12, 1)).toEqual({ amountMinor: 129900, early: true });
    // Once the early seats are gone the normal price applies.
    expect(chooseAmount(PRICES, 1, 2)).toEqual({ amountMinor: 29900, early: false });
    expect(chooseAmount(NO_EARLY, 12, 0)).toEqual({ amountMinor: 249900, early: false });
  });

  test("a txnid is 20 letters and digits and different every time", () => {
    const a = newTxnid();
    expect(a).toMatch(/^FT[0-9a-f]{18}$/);
    expect(newTxnid()).not.toBe(a);
  });

  test("a pass never includes pinned messages", () => {
    expect(PASS_FEATURE_KEYS).not.toContain("highlightedMessages");
    expect(PASS_FEATURE_KEYS).toContain("alertText");
    expect(PASS_FEATURE_KEYS).toContain("timestamps");
  });
});

test.describe("making an order", () => {
  test("is refused without a price, for an inactive creator, a bad term, or test money from a creator", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const base = { creatorId: c, term: 1, plan: "creator", prices: PRICES, livemode: true, isOwner: false, now: T0 };
    expect(await createPlanOrder(db, { ...base, prices: { monthly: null, yearly: null, early: null } })).toEqual({ ok: false, reason: "no_price" });
    expect(await createPlanOrder(db, { ...base, creatorId: await creator(pg, { status: "pending" }) })).toEqual({ ok: false, reason: "not_active" });
    expect(await createPlanOrder(db, { ...base, creatorId: await creator(pg, { status: "suspended" }) })).toEqual({ ok: false, reason: "not_active" });
    expect(await createPlanOrder(db, { ...base, creatorId: 999999 })).toEqual({ ok: false, reason: "not_active" });
    expect(await createPlanOrder(db, { ...base, term: 3 })).toEqual({ ok: false, reason: "bad_term" });
    expect(await createPlanOrder(db, { ...base, livemode: false })).toEqual({ ok: false, reason: "test_not_allowed" });
    // The owner may try with test money.
    expect((await createPlanOrder(db, { ...base, livemode: false, isOwner: true })).ok).toBe(true);
    // Nothing was written by the refusals.
    expect(Number((await pg.query<{ n: string }>(`select count(*)::text n from plan_orders`)).rows[0].n)).toBe(1);
  });

  test("fixes the amount on our side and counts early seats from live paid orders only", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const orders = [];
    for (let i = 0; i < 3; i++) {
      const c = await creator(pg);
      const o = await newOrder(db, c, { prices: PRICES });
      orders.push({ o, c });
      if (i < 2) expect(o).toMatchObject({ amountMinor: 14900, early: true });
      // Pay the first two (live), so their seats are taken.
      if (i < 2) await settlePlanPayment(db, payuReply(o, { mihpayid: `pay_${i}` }), payu(paid(o.amountMinor, `pay_${i}`)));
    }
    // Two seats are paid for, so the third creator gets the normal price.
    expect(orders[2].o).toMatchObject({ amountMinor: 29900, early: false });
    // An unpaid early order does not hold a seat.
    const owner = await creator(pg);
    const test = await createPlanOrder(db, { creatorId: owner, term: 1, plan: "creator", prices: PRICES, livemode: false, isOwner: true, now: T0 });
    expect(test.ok && test.order.early).toBe(false);
  });

  test("stops after five unpaid orders in an hour", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    for (let i = 0; i < 5; i++) await newOrder(db, c);
    expect(await createPlanOrder(db, { creatorId: c, term: 1, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).toEqual({ ok: false, reason: "too_many" });
    // An hour later the earlier ones no longer count.
    expect((await createPlanOrder(db, { creatorId: c, term: 1, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: false, now: new Date(T0.getTime() + 61 * 60000) })).ok).toBe(true);
  });
});

test.describe("a payment", () => {
  test("switches the features on, once, however often it is delivered", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const deps = payu(paid(o.amountMinor));

    const first = await settlePlanPayment(db, payuReply(o), deps);
    expect(first).toMatchObject({ status: "activated", orderId: o.id, creatorId: c });
    const u = await userRow(pg, c);
    expect([...u.paid_features].sort()).toEqual([...PASS_FEATURE_KEYS].sort());
    expect([...u.pass_keys].sort()).toEqual([...PASS_FEATURE_KEYS].sort());
    expect(u.pass_until!.toISOString()).toBe("2026-12-10T06:00:00.000Z");
    expect(await orderRow(pg, o.id)).toMatchObject({ status: "paid", payu_ref: "pay_1" });
    expect(await auditCount(pg, "plan.purchased")).toBe(1);

    // The browser return, the webhook and a retry all carry the same reply.
    for (let i = 0; i < 3; i++) expect(await settlePlanPayment(db, payuReply(o), deps)).toEqual({ status: "already_paid", orderId: o.id });
    expect(deps.calls).toHaveLength(1); // PayU was asked once, not for every delivery
    expect(await userRow(pg, c)).toEqual(u);
    expect(await auditCount(pg, "plan.purchased")).toBe(1);
  });

  test("a year adds twelve months", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c, { term: 12 });
    await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)));
    expect((await userRow(pg, c)).pass_until!.toISOString()).toBe("2027-11-10T06:00:00.000Z");
  });

  test("buying again before the end adds the new term after the end", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await newOrder(db, c);
    await settlePlanPayment(db, payuReply(a), payu(paid(a.amountMinor)));
    const later = addDays(T0, 10);
    const b = await newOrder(db, c, { now: later });
    const deps = { ...payu(paid(b.amountMinor, "pay_2")), now: () => later };
    await settlePlanPayment(db, payuReply(b, { mihpayid: "pay_2" }), deps);
    const u = await userRow(pg, c);
    expect(u.pass_until!.toISOString()).toBe("2027-01-10T06:00:00.000Z");
    // The second order started where the first ended.
    expect((await orderRow(pg, b.id)).pass_ends_at!.toISOString()).toBe("2027-01-10T06:00:00.000Z");
    expect(await auditCount(pg, "plan.purchased")).toBe(2);
  });

  test("buying after the pass ended starts from now", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await newOrder(db, c);
    await settlePlanPayment(db, payuReply(a), payu(paid(a.amountMinor)));
    const later = addDays(T0, 60);
    await expirePasses(db, later);
    const b = await newOrder(db, c, { now: later });
    await settlePlanPayment(db, payuReply(b, { mihpayid: "pay_2" }), { ...payu(paid(b.amountMinor, "pay_2")), now: () => later });
    // The new term runs one month from the day of purchase (9 January), not from the old end.
    expect((await userRow(pg, c)).pass_until!.toISOString()).toBe("2027-02-09T06:00:00.000Z");
    const row = await pg.query<{ pass_starts_at: Date }>(`select pass_starts_at from plan_orders where id = $1`, [b.id]);
    expect(row.rows[0].pass_starts_at.toISOString()).toBe(later.toISOString());
  });

  test("a forged or changed reply changes nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const before = await userRow(pg, c);
    const deps = payu(paid(o.amountMinor));
    const good = payuReply(o);

    // A hash made with the wrong salt, no hash, a changed amount, a changed status.
    expect(await settlePlanPayment(db, payuReply(o, {}, { ...LIVE, salt: "guess" }), deps)).toEqual({ status: "rejected", reason: "bad_hash" });
    expect(await settlePlanPayment(db, { ...good, hash: "" }, deps)).toEqual({ status: "rejected", reason: "bad_hash" });
    expect(await settlePlanPayment(db, { ...good, amount: "1.00" }, deps)).toEqual({ status: "rejected", reason: "bad_hash" });
    expect(await settlePlanPayment(db, { ...good, status: "failure" }, deps)).toEqual({ status: "rejected", reason: "bad_hash" });
    // A real signature for a different key.
    expect(await settlePlanPayment(db, payuReply(o, { key: "otherkey" }), deps)).toEqual({ status: "rejected", reason: "bad_hash" });
    // Nothing was written and PayU was never asked.
    expect(await userRow(pg, c)).toEqual(before);
    expect((await orderRow(pg, o.id)).status).toBe("pending");
    expect(deps.calls).toHaveLength(0);
  });

  test("a correctly signed reply for a lower amount, another order or an unknown reference is refused", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const other = await newOrder(db, await creator(pg));
    const deps = payu(paid(o.amountMinor));

    // The creator pays ₹1 on this order's reference (signed correctly by PayU).
    expect(await settlePlanPayment(db, payuReply(o, { amount: "1.00" }), deps)).toEqual({ status: "rejected", reason: "amount_mismatch" });
    // A reply for this txnid that names another order id.
    expect(await settlePlanPayment(db, payuReply(o, { udf1: String(other.id) }), deps)).toEqual({ status: "rejected", reason: "ref_mismatch" });
    // A reference we never made.
    expect(await settlePlanPayment(db, payuReply({ ...o, txnid: "FT00000000000000zz" }), deps)).toEqual({ status: "rejected", reason: "unknown_order" });
    expect((await orderRow(pg, o.id)).status).toBe("pending");
    expect(deps.calls).toHaveLength(0);
  });

  test("an order made in test mode is not paid by a live-mode reply, and the other way round", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const live = await newOrder(db, c, { livemode: true });
    const owner = await creator(pg);
    const made = await createPlanOrder(db, { creatorId: owner, term: 1, plan: "creator", prices: NO_EARLY, livemode: false, isOwner: true, now: T0 });
    if (!made.ok) throw new Error("order");
    expect(await settlePlanPayment(db, payuReply(live, {}, TEST), payu(paid(live.amountMinor), TEST))).toEqual({ status: "rejected", reason: "mode_mismatch" });
    expect(await settlePlanPayment(db, payuReply(made.order), payu(paid(made.order.amountMinor), LIVE))).toEqual({ status: "rejected", reason: "mode_mismatch" });
    // The owner's test order is paid by a test-mode reply.
    expect((await settlePlanPayment(db, payuReply(made.order, {}, TEST), payu(paid(made.order.amountMinor), TEST))).status).toBe("activated");
  });

  test("a reply that says success is not believed unless PayU says so too", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const before = await userRow(pg, c);

    for (const answer of [
      { kind: "failure", reason: "no" } as PayuPayment,
      paid(100), // PayU says a different amount
    ]) {
      expect(await settlePlanPayment(db, payuReply(o), payu(answer))).toEqual({ status: "rejected", reason: "not_confirmed" });
    }
    // PayU says paid, but not at the plain price (a discount or offer): never a success, and said why.
    expect(await settlePlanPayment(db, payuReply(o), payu({ kind: "mismatch", reason: "a discount was applied" }))).toEqual({ status: "rejected", reason: "not_confirmed", detail: "a discount was applied" });
    // The payment id comes from PayU's own answer: the posted id is not covered by the hash, so a
    // different one in the reply changes nothing (PayU's answer is used).
    const r = await settlePlanPayment(db, payuReply(o, { mihpayid: "pay_other" }), payu(paid(o.amountMinor, "pay_1")));
    expect(r.status).toBe("activated");
    expect((await orderRow(pg, o.id)).payu_ref).toBe("pay_1");
    expect(before.paid_features).toEqual([]);
  });

  test("when PayU is not sure, has not caught up or cannot be reached, nothing changes and the answer is try again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const notYet = { status: "unavailable", reason: "PayU has not confirmed this payment yet" };
    // PayU's check can trail its own notice: pending or not found is asked twice, then "try again".
    for (const answer of [{ kind: "pending" } as PayuPayment, { kind: "not_found" } as PayuPayment]) {
      const deps = payu(answer);
      expect(await settlePlanPayment(db, payuReply(o), deps)).toEqual(notYet);
      expect(deps.calls).toHaveLength(2);
    }
    const down = payu({ kind: "unavailable", reason: "timeout" });
    expect(await settlePlanPayment(db, payuReply(o), down)).toEqual({ status: "unavailable", reason: "timeout" });
    expect(down.calls).toHaveLength(1); // no point asking twice when PayU cannot be reached
    // A pending reply from PayU (a bank transfer still in flight) is just "not yet", with no check made.
    const bank = payu(paid(o.amountMinor));
    expect(await settlePlanPayment(db, payuReply(o, { status: "pending" }), bank)).toEqual({ status: "pending", orderId: o.id });
    expect(bank.calls).toHaveLength(0);
    expect((await orderRow(pg, o.id)).status).toBe("pending");
    expect((await userRow(pg, c)).paid_features).toEqual([]);
    // PayU answers later: it goes through.
    expect((await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)))).status).toBe("activated");
  });

  test("PayU catching up on the second look is enough", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const answers: PayuPayment[] = [{ kind: "not_found" }, paid(o.amountMinor)];
    const deps = payu(() => answers.shift()!);
    expect((await settlePlanPayment(db, payuReply(o), deps)).status).toBe("activated");
    expect(deps.calls).toHaveLength(2);
    expect((await userRow(pg, c)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);
  });

  test("a failure marks a pending order failed, a later success still pays it, and a failure never undoes a payment", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    const fail = payuReply(o, { status: "failure", unmappedstatus: "userCancelled", error_Message: "Cancelled" });
    expect(await settlePlanPayment(db, fail, payu(paid(o.amountMinor)))).toEqual({ status: "failed", orderId: o.id });
    expect(await orderRow(pg, o.id)).toMatchObject({ status: "failed", failure_reason: "Cancelled" });
    expect((await userRow(pg, c)).paid_features).toEqual([]);

    // The creator tries again in PayU's page under the same reference and it works.
    expect((await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)))).status).toBe("activated");
    expect(await orderRow(pg, o.id)).toMatchObject({ status: "paid", failure_reason: null });

    // PayU's documents use both "failure" and "failed" for a failed payment.
    const o2 = await newOrder(db, await creator(pg));
    expect(await settlePlanPayment(db, payuReply(o2, { status: "failed" }), payu(paid(o2.amountMinor)))).toEqual({ status: "failed", orderId: o2.id });

    // A late failure notice for the same reference changes nothing.
    expect(await settlePlanPayment(db, fail, payu(paid(o.amountMinor)))).toEqual({ status: "already_paid", orderId: o.id });
    expect((await orderRow(pg, o.id)).status).toBe("paid");
    expect((await userRow(pg, c)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);
  });

  test("one PayU payment cannot pay two orders", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await newOrder(db, await creator(pg));
    const cb = await creator(pg);
    const b = await newOrder(db, cb);
    expect((await settlePlanPayment(db, payuReply(a, { mihpayid: "pay_same" }), payu(paid(a.amountMinor, "pay_same")))).status).toBe("activated");
    expect(await settlePlanPayment(db, payuReply(b, { mihpayid: "pay_same" }), payu(paid(b.amountMinor, "pay_same")))).toEqual({ status: "rejected", reason: "payment_already_used" });
    expect((await orderRow(pg, b.id)).status).toBe("pending");
    expect((await userRow(pg, cb)).paid_features).toEqual([]);
    expect(await auditCount(pg, "plan.purchased")).toBe(1);
  });
});

test.describe("the term", () => {
  test("months are added in UTC, and the end of a short month is the last day", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const jan31 = new Date("2027-01-31T06:00:00.000Z");
    const o = await newOrder(db, c, { now: jan31 });
    await settlePlanPayment(db, payuReply(o), { ...payu(paid(o.amountMinor)), now: () => jan31 });
    expect((await userRow(pg, c)).pass_until!.toISOString()).toBe("2027-02-28T06:00:00.000Z");
    // A year from 29 February lands on 28 February.
    const leap = new Date("2028-02-29T06:00:00.000Z");
    const d = await creator(pg);
    const o2 = await newOrder(db, d, { now: leap, term: 12 });
    await settlePlanPayment(db, payuReply(o2, { mihpayid: "pay_leap" }), { ...payu(paid(o2.amountMinor, "pay_leap")), now: () => leap });
    expect((await userRow(pg, d)).pass_until!.toISOString()).toBe("2029-02-28T06:00:00.000Z");
  });
});

test.describe("the early price", () => {
  const EARLY: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 2 } };

  test("seats are counted by creator, so one creator renewing every month holds one seat", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    let at = T0;
    for (let i = 0; i < 3; i++) {
      const o = await newOrder(db, a, { prices: EARLY, now: at });
      expect(o.early).toBe(true);
      await settlePlanPayment(db, payuReply(o, { mihpayid: `pay_a${i}` }), { ...payu(paid(o.amountMinor, `pay_a${i}`)), now: () => at });
      at = addDays(at, 28);
    }
    // Another creator still finds a seat (only one of the two is held), and a third does not.
    const b = await creator(pg);
    expect((await newOrder(db, b, { prices: EARLY, now: at })).early).toBe(true);
    const c = await creator(pg);
    expect((await newOrder(db, c, { prices: EARLY, now: at })).early).toBe(false);
  });

  test("a creator who holds an early pass keeps the early price when renewing, even if the seats were cut; a long lapse loses it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const first = await newOrder(db, a, { prices: EARLY });
    await settlePlanPayment(db, payuReply(first, { mihpayid: "pay_1" }), payu(paid(first.amountMinor, "pay_1")));
    const x = await newOrder(db, await creator(pg), { prices: EARLY });
    await settlePlanPayment(db, payuReply(x, { mihpayid: "pay_x" }), payu(paid(x.amountMinor, "pay_x")));
    // The owner later cuts the early seats to 1; both holders are already past it.
    const cut: PlanPrices = { ...EARLY, early: { monthly: 149, yearly: 1299, seats: 1 } };
    // Renewing while the pass runs, and within 31 days after it ended: still early.
    expect((await newOrder(db, a, { prices: cut, now: addDays(T0, 20) })).early).toBe(true);
    expect((await newOrder(db, a, { prices: cut, now: addDays(T0, 30 + 30) })).early).toBe(true);
    // Someone new finds the seats gone.
    expect((await newOrder(db, await creator(pg), { prices: cut })).early).toBe(false);
    // After more than 31 days without a pass, the creator pays the normal price.
    expect((await newOrder(db, a, { prices: cut, now: addDays(T0, 30 + 40) })).early).toBe(false);
  });

  test("a seat is not given to someone else when its holder lets the pass lapse", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    for (const [who, ref] of [[a, "pay_a"], [b, "pay_b"]] as const) {
      const o = await newOrder(db, who, { prices: EARLY });
      await settlePlanPayment(db, payuReply(o, { mihpayid: ref }), payu(paid(o.amountMinor, ref)));
    }
    // A year later both passes are long over; the early seats are still counted as taken.
    expect((await newOrder(db, await creator(pg), { prices: EARLY, now: addDays(T0, 400) })).early).toBe(false);
  });

  test("an unpaid early order holds its seat for two hours, then lets it go", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    const c = await creator(pg);
    expect((await newOrder(db, a, { prices: EARLY })).early).toBe(true);
    expect((await newOrder(db, b, { prices: EARLY })).early).toBe(true);
    // Both seats are held by unpaid orders, so a third creator is told the normal price.
    expect((await newOrder(db, c, { prices: EARLY })).early).toBe(false);
    // Three hours later the unpaid holds have lapsed.
    expect((await newOrder(db, c, { prices: EARLY, now: new Date(T0.getTime() + 3 * 3600000) })).early).toBe(true);
  });

  test("a failed or abandoned early order holds nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const o = await newOrder(db, a, { prices: EARLY });
    await settlePlanPayment(db, payuReply(o, { status: "failure" }), payu(paid(o.amountMinor)));
    const b = await newOrder(db, await creator(pg), { prices: EARLY });
    const c = await newOrder(db, await creator(pg), { prices: EARLY });
    expect([b.early, c.early]).toEqual([true, true]);
  });
});

test.describe("the owner's own ticks and a pass that ends", () => {
  test("a feature the owner ticked stays when the pass ends; the rest go", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, { features: ["alertText", "highlightedMessages"] });
    const o = await newOrder(db, c);
    await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)));
    const u = await userRow(pg, c);
    // The pass added everything except what was already on.
    expect(u.pass_keys).not.toContain("alertText");
    expect(u.paid_features).toContain("highlightedMessages");
    expect(u.pass_keys).not.toContain("highlightedMessages");
    expect((await orderRow(pg, o.id)).added_keys).not.toContain("alertText");

    const after = addDays(T0, 31);
    expect(await expirePasses(db, after)).toEqual({ expired: 1 });
    const ended = await userRow(pg, c);
    expect([...ended.paid_features].sort()).toEqual(["alertText", "highlightedMessages"]);
    expect(ended.pass_keys).toEqual([]);
    expect(ended.pass_until).toBeNull();
    expect(await auditCount(pg, "plan.expired")).toBe(1);
  });

  test("nothing is removed before the end, a renewal moves the end, and a second run finds nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await newOrder(db, c);
    await settlePlanPayment(db, payuReply(a), payu(paid(a.amountMinor)));
    expect(await expirePasses(db, addDays(T0, 29))).toEqual({ expired: 0 });
    expect((await userRow(pg, c)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);

    // Renewed on day 20: the end is now two months out, so day 31 removes nothing.
    const day20 = addDays(T0, 20);
    const b = await newOrder(db, c, { now: day20 });
    await settlePlanPayment(db, payuReply(b, { mihpayid: "pay_2" }), { ...payu(paid(b.amountMinor, "pay_2")), now: () => day20 });
    expect(await expirePasses(db, addDays(T0, 31))).toEqual({ expired: 0 });
    expect((await userRow(pg, c)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);

    // Two months on it does end, once.
    expect(await expirePasses(db, addDays(T0, 70))).toEqual({ expired: 1 });
    expect(await expirePasses(db, addDays(T0, 71))).toEqual({ expired: 0 });
    expect((await userRow(pg, c)).paid_features).toEqual([]);
  });

  test("only creators whose pass ended lose anything", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const keeper = await creator(pg, { features: ["alertText"] });
    const buyer = await creator(pg);
    const o = await newOrder(db, buyer);
    await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)));
    await expirePasses(db, addDays(T0, 40));
    expect((await userRow(pg, keeper)).paid_features).toEqual(["alertText"]);
    expect((await userRow(pg, buyer)).paid_features).toEqual([]);
  });
});

test.describe("the owner's feature box", () => {
  async function boughtPass(pg: PGlite, db: LedgerDb, features: string[] = []) {
    const c = await creator(pg, { features });
    const o = await newOrder(db, c);
    await settlePlanPayment(db, payuReply(o), payu(paid(o.amountMinor)));
    return c;
  }
  const save = (pg: PGlite, c: number, keys: string[], everything = false) =>
    pg.transaction((tx) => writeFeatureKeys((async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
      return (await tx.query(text, values as unknown[])).rows as never;
    }) as never, c, keys, everything));

  test("unticking a pass feature forgets it, and ticking it again later is the owner's own", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await boughtPass(pg, db);
    const all = [...PASS_FEATURE_KEYS];
    // The owner unticks alertText and saves.
    await save(pg, c, all.filter((k) => k !== "alertText"));
    let u = await userRow(pg, c);
    expect(u.paid_features).not.toContain("alertText");
    expect(u.pass_keys).not.toContain("alertText");
    // Later the owner ticks it by hand.
    await save(pg, c, all);
    u = await userRow(pg, c);
    expect(u.paid_features).toContain("alertText");
    expect(u.pass_keys).not.toContain("alertText");
    // When the pass ends, alertText is still theirs; the rest go.
    await expirePasses(db, addDays(T0, 40));
    expect((await userRow(pg, c)).paid_features).toEqual(["alertText"]);
  });

  test("saving without a change keeps the pass's bookkeeping", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await boughtPass(pg, db);
    const before = await userRow(pg, c);
    await save(pg, c, before.paid_features);
    expect(await userRow(pg, c)).toEqual(before);
  });

  test("everything on is the owner's own choice, and everything off clears the pass's keys", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await boughtPass(pg, db);
    await save(pg, a, [...PASS_FEATURE_KEYS], true);
    expect((await userRow(pg, a)).pass_keys).toEqual([]);
    await expirePasses(db, addDays(T0, 40));
    expect((await userRow(pg, a)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);

    const b = await boughtPass(pg, db);
    await save(pg, b, []);
    expect(await userRow(pg, b)).toMatchObject({ paid_features: [], pass_keys: [] });
  });
});

test.describe("the feature box before migration 0055 and from a stale page", () => {
  test("the snapshot ignores order and unknown words, so it names the state a page was loaded with", () => {
    expect(featureSnapshot(["alertText", "alertMotion"])).toBe(featureSnapshot(["alertMotion", "alertText"]));
    expect(featureSnapshot(["alertText", "notAFeature"])).toBe(featureSnapshot(["alertText"]));
    expect(featureSnapshot([])).toBe("");
    expect(featureSnapshot(["alertText"])).not.toBe(featureSnapshot(["alertText", "alertMotion"]));
  });

  test("without the pass columns the owner's box still saves the features", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await pg.exec(`alter table users drop column pass_keys`);
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""), "");
      return (await pg.query(text, values as unknown[])).rows as never;
    }) as never;
    await writeFeatureKeys(sql, c, ["alertText"], false);
    expect((await pg.query<{ paid_features: string[] }>(`select paid_features from users where id = $1`, [c])).rows[0].paid_features).toEqual(["alertText"]);
  });
});

test.describe("orders left pending", () => {
  test("the daily check pays what PayU says is paid and leaves the rest", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const now = addDays(T0, 1);
    const ca = await creator(pg);
    const cb = await creator(pg);
    const cc = await creator(pg);
    const cd = await creator(pg);
    const ce = await creator(pg);
    const paidOrder = await newOrder(db, ca, { now: T0 });
    const failedOrder = await newOrder(db, cb, { now: T0 });
    const stillOrder = await newOrder(db, cc, { now: T0 });
    const downOrder = await newOrder(db, cd, { now: T0 });
    const fresh = await newOrder(db, ce, { now });
    const answers: Record<string, PayuPayment> = {
      [paidOrder.txnid]: paid(paidOrder.amountMinor, "pay_a"),
      [failedOrder.txnid]: { kind: "failure", reason: "declined" },
      [stillOrder.txnid]: { kind: "pending" },
      [downOrder.txnid]: { kind: "unavailable", reason: "timeout" },
    };
    const deps: SettleDeps = { config: LIVE, now: () => now, sleep: async () => {}, fetchPayment: async (t) => answers[t] ?? { kind: "not_found" } };

    expect(await reconcilePendingOrders(db, deps)).toEqual({ looked: 4, activated: 1, failed: 1, abandoned: 0, stillPending: 1, unavailable: 1, needsLook: 0, errors: 0 });
    expect((await orderRow(pg, paidOrder.id)).status).toBe("paid");
    expect((await userRow(pg, ca)).paid_features.length).toBe(PASS_FEATURE_KEYS.length);
    expect((await orderRow(pg, failedOrder.id)).status).toBe("failed");
    expect((await orderRow(pg, stillOrder.id)).status).toBe("pending");
    // An order made a moment ago is left alone, and a second run does not pay twice.
    expect((await orderRow(pg, fresh.id)).status).toBe("pending");
    expect((await reconcilePendingOrders(db, deps)).activated).toBe(0);
    expect(await auditCount(pg, "plan.purchased")).toBe(1);
  });

  test("an order older than three days is no longer asked about, and only the server's own mode is asked", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const old = await newOrder(db, await creator(pg), { now: T0 });
    const owner = await creator(pg);
    const test = await createPlanOrder(db, { creatorId: owner, term: 1, plan: "creator", prices: NO_EARLY, livemode: false, isOwner: true, now: addDays(T0, 3) });
    if (!test.ok) throw new Error("order");
    const liveRecent = await newOrder(db, await creator(pg), { now: addDays(T0, 3) });
    const asked: string[] = [];
    const ask = (config: PayuConfig): SettleDeps => ({ config, now: () => addDays(T0, 4), sleep: async () => {}, fetchPayment: async (t) => (asked.push(t), { kind: "pending" }) });
    // With the live key: the live order from yesterday, not the one past three days, not the test one.
    expect((await reconcilePendingOrders(db, ask(LIVE))).looked).toBe(1);
    expect(asked).toEqual([liveRecent.txnid]);
    // With the test key: only the test order.
    asked.length = 0;
    expect((await reconcilePendingOrders(db, ask(TEST))).looked).toBe(1);
    expect(asked).toEqual([test.order.txnid]);
    expect(old.id).toBeGreaterThan(0);
  });

  test("an order PayU does not know is marked never paid only after a day; a PayU-failed one is asked again and can still be paid", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const ca = await creator(pg);
    const cb = await creator(pg);
    const cc = await creator(pg);
    const stale = await newOrder(db, ca, { now: T0 });
    const young = await newOrder(db, cb, { now: addDays(T0, 1) });
    const retry = await newOrder(db, cc, { now: T0 });
    // PayU first reported the retry order as failed (a failed attempt), later it succeeded.
    await settlePlanPayment(db, payuReply(retry, { status: "failure" }), payu(paid(retry.amountMinor)));
    expect((await orderRow(pg, retry.id)).status).toBe("failed");
    const now = addDays(T0, 1.5);
    const deps: SettleDeps = {
      config: LIVE,
      now: () => now,
      sleep: async () => {},
      fetchPayment: async (t) => (t === retry.txnid ? paid(retry.amountMinor, "pay_retry") : { kind: "not_found" }),
    };
    const r = await reconcilePendingOrders(db, deps);
    expect(r).toMatchObject({ looked: 3, activated: 1, abandoned: 1, stillPending: 1, errors: 0 });
    expect(await orderRow(pg, stale.id)).toMatchObject({ status: "failed", failure_reason: ABANDONED_REASON });
    expect((await orderRow(pg, young.id)).status).toBe("pending");
    expect(await orderRow(pg, retry.id)).toMatchObject({ status: "paid", payu_ref: "pay_retry" });
    // An abandoned order is not asked about again, but it can still be paid by a real notice.
    const again = await reconcilePendingOrders(db, deps);
    expect(again.looked).toBe(1); // only the young one
    expect((await settlePlanPayment(db, payuReply(stale, { mihpayid: "pay_late" }), payu(paid(stale.amountMinor, "pay_late")))).status).toBe("activated");
  });

  test("PayU saying paid at another price needs a look and changes nothing; one order that throws does not stop the rest", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const odd = await newOrder(db, await creator(pg), { now: T0 });
    const broken = await newOrder(db, await creator(pg), { now: T0 });
    const good = await newOrder(db, await creator(pg), { now: T0 });
    const noisy = console.error;
    const logged: string[] = [];
    console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
    try {
      const deps: SettleDeps = {
        config: LIVE,
        now: () => addDays(T0, 1),
        sleep: async () => {},
        fetchPayment: async (t) => {
          if (t === odd.txnid) return { kind: "mismatch", reason: "a discount was applied" };
          if (t === broken.txnid) throw new Error("boom");
          return paid(good.amountMinor, "pay_good");
        },
      };
      const r = await reconcilePendingOrders(db, deps);
      expect(r).toMatchObject({ looked: 3, activated: 1, needsLook: 1, errors: 1 });
    } finally {
      console.error = noisy;
    }
    expect(logged.some((l) => l.includes(String(odd.id)) && l.includes("a discount was applied"))).toBe(true);
    expect((await orderRow(pg, odd.id)).status).toBe("pending");
    expect((await orderRow(pg, broken.id)).status).toBe("pending");
    expect((await orderRow(pg, good.id)).status).toBe("paid");
  });

  test("the newest orders are asked about first, so a real payment is not starved behind old ones", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push((await newOrder(db, await creator(pg), { now: addDays(T0, i * 0.1) })).txnid);
    const asked: string[] = [];
    const deps: SettleDeps = { config: LIVE, now: () => addDays(T0, 1), sleep: async () => {}, fetchPayment: async (t) => (asked.push(t), { kind: "pending" }) };
    await reconcilePendingOrders(db, deps, { limit: 2 });
    expect(asked).toEqual([ids[3], ids[2]]);
  });
});

test.describe("the schema", () => {
  test("a paid order must carry its payment id and term, and a duplicate reference is refused", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const o = await newOrder(db, c);
    await expect(pg.query(`update plan_orders set status = 'paid' where id = $1`, [o.id])).rejects.toThrow();
    await expect(pg.query(`insert into plan_orders (creator_id, txnid, term_months, amount_minor, livemode) values ($1, $2, 3, 100, true)`, [c, "FTabcdefghij"])).rejects.toThrow();
    await expect(pg.query(`insert into plan_orders (creator_id, txnid, term_months, amount_minor, livemode) values ($1, $2, 1, 0, true)`, [c, "FTabcdefghik"])).rejects.toThrow();
    await expect(pg.query(`insert into plan_orders (creator_id, txnid, term_months, amount_minor, livemode) values ($1, $2, 1, 100, true)`, [c, o.txnid])).rejects.toThrow();
    await expect(pg.query(`insert into plan_orders (creator_id, txnid, term_months, amount_minor, livemode) values ($1, 'bad txn!', 1, 100, true)`, [c])).rejects.toThrow();
  });

  test("the migration can be run twice", async () => {
    const pg = await freshDatabase();
    const { readMigration } = await import("./helpers/pg");
    await pg.exec(readMigration("0055_plan_orders.sql"));
    await pg.exec(readMigration("0055_plan_orders.sql"));
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    await pg.exec(readMigration("0056_plan_tiers.sql"));
  });
});
