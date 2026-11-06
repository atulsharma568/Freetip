import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import type { LedgerDb } from "../src/lib/accrual";
import {
  attachProviderOrder,
  createPlanOrder,
  failUnstartedOrder,
  reconcilePendingOrders,
  settleCreatorOrders,
  settlePlanPayment,
  settleRazorpayOrder,
  NOT_STARTED_REASON,
  RAZORPAY_ABANDONED_REASON,
  type GatewayDeps,
} from "../src/lib/plan-orders";
import { planFeatureKeys } from "../src/lib/plan-catalogue";
import { readReply, replyHash, type PayuConfig, type PayuPayment } from "../src/lib/payu";
import {
  checkoutSignatureIsValid,
  createRazorpayOrder,
  fetchOrderPayment,
  razorpayConfig,
  razorpayDeps,
  readOrderPayments,
  readPayment,
  type FetchLike,
  type RazorpayConfig,
} from "../src/lib/razorpay-plan";
import { gatewayOf } from "../src/lib/plan-view";
import type { PlanPrices } from "../src/lib/pricing";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Buying a plan through Razorpay (2026-11-06): the pure Razorpay pieces with made-up keys and a pretend
// network, then the whole order flow against the real schema in memory.

const SECRET = "test_secret_123";
const CONFIG: RazorpayConfig = { keyId: "rzp_live_abc", keySecret: SECRET, mode: "live" };
const PRICES: PlanPrices = { monthly: 299, yearly: 2499, early: null };
const T0 = new Date("2026-11-10T06:00:00.000Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// A pretend fetch that answers every call with one status and body, and remembers what was asked.
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fn, calls };
}

test.describe("Razorpay pieces (pure)", () => {
  test("the keys tips use are read, and the mode comes from the key", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_x" })).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" })?.mode).toBe("test");
    expect(razorpayConfig({ RAZORPAY_KEY_ID: " rzp_live_x ", RAZORPAY_KEY_SECRET: "s" })).toEqual({ keyId: "rzp_live_x", keySecret: "s", mode: "live" });
  });

  test("the popup's signature is checked with the key secret, and anything odd is refused", () => {
    const orderId = "order_ABC123def";
    const paymentId = "pay_XYZ789ghi";
    const signature = createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    expect(checkoutSignatureIsValid({ orderId, paymentId, signature }, SECRET)).toBe(true);
    expect(checkoutSignatureIsValid({ orderId, paymentId, signature: signature.toUpperCase() }, SECRET)).toBe(true);
    expect(checkoutSignatureIsValid({ orderId, paymentId, signature }, "another secret")).toBe(false);
    expect(checkoutSignatureIsValid({ orderId: "order_OTHER123", paymentId, signature }, SECRET)).toBe(false);
    expect(checkoutSignatureIsValid({ orderId, paymentId: "pay_OTHER123", signature }, SECRET)).toBe(false);
    expect(checkoutSignatureIsValid({ orderId: "order_x|y", paymentId, signature }, SECRET)).toBe(false);
    expect(checkoutSignatureIsValid({ orderId, paymentId, signature: 42 }, SECRET)).toBe(false);
    expect(checkoutSignatureIsValid({ orderId, paymentId, signature: "" }, SECRET)).toBe(false);
  });

  test("only a captured payment in rupees is paid; a captured one wins over failed retries", () => {
    expect(readPayment({ id: "pay_1abcdef", amount: 29900, currency: "INR", status: "captured" })).toEqual({ kind: "success", amountMinor: 29900, payuRef: "pay_1abcdef" });
    expect(readPayment({ id: "pay_1abcdef", amount: 29900, currency: "USD", status: "captured" }).kind).toBe("mismatch");
    expect(readPayment({ id: "pay_1abcdef", amount: 29900, currency: "INR", status: "authorized" }).kind).toBe("pending");
    expect(readPayment({ id: "pay_1abcdef", amount: 29900, currency: "INR", status: "refunded" }).kind).toBe("mismatch");
    expect(readPayment({ status: "failed", error_description: "Bank declined" })).toEqual({ kind: "failure", reason: "Bank declined" });
    expect(readPayment({ status: "captured" }).kind).toBe("unavailable");

    expect(readOrderPayments({ items: [] })).toEqual({ kind: "not_found" });
    expect(readOrderPayments(null).kind).toBe("unavailable");
    expect(
      readOrderPayments({
        items: [
          { id: "pay_failed1", status: "failed", error_description: "x" },
          { id: "pay_good123", amount: 29900, currency: "INR", status: "captured" },
        ],
      }),
    ).toEqual({ kind: "success", amountMinor: 29900, payuRef: "pay_good123" });
    expect(readOrderPayments({ items: [{ status: "failed" }, { status: "authorized" }] }).kind).toBe("pending");
  });

  test("the Razorpay order is made for our amount, with our reference, and a wrong answer is refused", async () => {
    const ok = fakeFetch(200, { id: "order_NEW12345", amount: 29900 });
    const r = await createRazorpayOrder(CONFIG, { amountMinor: 29900, receipt: "FTabc", planOrderId: 7, plan: "creator", termMonths: 1 }, ok.fn);
    expect(r).toEqual({ ok: true, orderId: "order_NEW12345" });
    expect(ok.calls[0].url).toBe("https://api.razorpay.com/v1/orders");
    expect(JSON.parse(ok.calls[0].body ?? "{}")).toMatchObject({ amount: 29900, currency: "INR", receipt: "FTabc", notes: { kind: "plan", plan_order_id: "7" } });
    expect(ok.calls[0].auth).toBe(`Basic ${Buffer.from(`rzp_live_abc:${SECRET}`).toString("base64")}`);

    expect((await createRazorpayOrder(CONFIG, { amountMinor: 29900, receipt: "FTabc", planOrderId: 7, plan: "creator", termMonths: 1 }, fakeFetch(200, { id: "order_NEW12345", amount: 100 }).fn)).ok).toBe(false);
    expect((await createRazorpayOrder(CONFIG, { amountMinor: 29900, receipt: "FTabc", planOrderId: 7, plan: "creator", termMonths: 1 }, fakeFetch(500, {}).fn)).ok).toBe(false);
    expect((await createRazorpayOrder(CONFIG, { amountMinor: 50, receipt: "FTabc", planOrderId: 7, plan: "creator", termMonths: 1 }, ok.fn)).ok).toBe(false);
  });

  test("asking about an order: an unknown one is not found, a failure to answer decides nothing", async () => {
    expect(await fetchOrderPayment(CONFIG, "order_ABC12345", fakeFetch(400, {}).fn)).toEqual({ kind: "not_found" });
    expect((await fetchOrderPayment(CONFIG, "order_ABC12345", fakeFetch(502, {}).fn)).kind).toBe("unavailable");
    expect(await fetchOrderPayment(CONFIG, "not-an-order", fakeFetch(200, {}).fn)).toEqual({ kind: "not_found" });
    const thrower: FetchLike = async () => {
      throw new Error("network down");
    };
    expect((await fetchOrderPayment(CONFIG, "order_ABC12345", thrower)).kind).toBe("unavailable");
  });

  test("a receipt names the gateway from the payment id", () => {
    expect(gatewayOf("pay_ABC123")).toBe("Razorpay");
    expect(gatewayOf("403993715531077182")).toBe("PayU");
    expect(gatewayOf(null)).toBe("PayU");
  });
});

let seq = 0;
async function creator(pg: PGlite): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status) values ($1, $2, $3, $4, 'active') returning id::text`,
    [`rz${seq}`, `rz${seq}@example.com`, `rzcreator${seq}`, `Creator ${seq}`],
  );
  return Number(r.rows[0].id);
}

async function razorpayOrder(db: LedgerDb, creatorId: number, o: { livemode?: boolean; now?: Date; ref?: string | null } = {}) {
  const r = await createPlanOrder(db, {
    termsVersion: "6 November 2026, text 6",
    creatorId,
    term: 1,
    plan: "creator",
    prices: PRICES,
    livemode: o.livemode ?? true,
    isOwner: true,
    provider: "razorpay",
    now: o.now ?? T0,
  });
  if (!r.ok) throw new Error(`could not make an order: ${r.reason}`);
  seq += 1;
  const ref = o.ref === undefined ? `order_TEST${String(seq).padStart(6, "0")}` : o.ref;
  if (ref) expect(await attachProviderOrder(db, r.order.id, ref)).toBe(true);
  return { ...r.order, ref };
}

const row = async (pg: PGlite, id: number) =>
  (await pg.query<{ status: string; payu_ref: string | null; provider: string; provider_order_ref: string | null; failure_reason: string | null }>(
    `select status, payu_ref, provider, provider_order_ref, failure_reason from plan_orders where id = $1`,
    [id],
  )).rows[0];

const deps = (answer: (ref: string | null) => PayuPayment, now = T0, live = true): GatewayDeps => ({
  provider: "razorpay",
  live,
  ask: async (o) => answer(o.providerOrderRef),
  now: () => now,
});
const paid = (amountMinor: number, id = "pay_GOOD1234"): PayuPayment => ({ kind: "success", amountMinor, payuRef: id });

test.describe("buying a plan through Razorpay", () => {
  test("a captured payment for the price switches the plan on once, however often it is delivered", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c);
    expect(await row(pg, order.id)).toMatchObject({ status: "pending", provider: "razorpay", provider_order_ref: order.ref });

    // From the webhook: the signed payment is passed in, nothing is asked.
    const asked: (string | null)[] = [];
    const d = deps((ref) => {
      asked.push(ref);
      return paid(order.amountMinor);
    });
    const r = await settleRazorpayOrder(db, order.ref as string, d, paid(order.amountMinor));
    expect(r).toMatchObject({ status: "activated", orderId: order.id, creatorId: c });
    expect(asked).toHaveLength(0);
    expect(await row(pg, order.id)).toMatchObject({ status: "paid", payu_ref: "pay_GOOD1234" });
    const [u] = (await pg.query<{ paid_features: string[] }>(`select paid_features from users where id = $1`, [c])).rows;
    for (const k of planFeatureKeys("creator")) expect(u.paid_features).toContain(k);
    const audit = await pg.query<{ reason: string }>(`select reason from audit_events where action = 'plan.purchased'`);
    expect(audit.rows).toEqual([{ reason: "Razorpay payment confirmed" }]);

    // From the Buy form's confirm afterwards: already paid, nothing changes.
    expect(await settleRazorpayOrder(db, order.ref as string, d)).toEqual({ status: "already_paid", orderId: order.id });
    expect((await pg.query(`select 1 from audit_events where action = 'plan.purchased'`)).rows).toHaveLength(1);
  });

  test("without a known payment, Razorpay is asked; not yet captured waits, a failure is recorded", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c);
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "pending" })))).toEqual({ status: "pending", orderId: order.id });
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "not_found" })))).toEqual({ status: "pending", orderId: order.id });
    expect((await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "unavailable", reason: "timeout" })))).status).toBe("unavailable");
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "failure", reason: "Bank declined" })))).toEqual({ status: "failed", orderId: order.id });
    expect(await row(pg, order.id)).toMatchObject({ status: "failed", failure_reason: "Bank declined" });
    // A retry inside the same popup succeeded: a failed order can still be paid.
    expect((await settleRazorpayOrder(db, order.ref as string, deps(() => paid(order.amountMinor)))).status).toBe("activated");
    // A late failure for the earlier attempt never undoes the payment.
    expect((await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "failure", reason: "late" })))).status).toBe("already_paid");
    expect((await row(pg, order.id)).status).toBe("paid");
  });

  test("another amount, another mode, an unknown order or a reused payment id never switches anything on", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c);
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => paid(100)))).toMatchObject({ status: "rejected", reason: "amount_mismatch" });
    expect((await pg.query(`select 1 from audit_events where action = 'plan.payment_needs_look'`)).rows).toHaveLength(1);
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => ({ kind: "mismatch", reason: "the payment was refunded" })))).toMatchObject({ status: "rejected", reason: "not_confirmed" });
    expect(await settleRazorpayOrder(db, order.ref as string, deps(() => paid(order.amountMinor), T0, false))).toEqual({ status: "rejected", reason: "mode_mismatch" });
    expect(await settleRazorpayOrder(db, "order_UNKNOWN99", deps(() => paid(order.amountMinor)))).toEqual({ status: "rejected", reason: "unknown_order" });
    expect((await row(pg, order.id)).status).toBe("pending");

    // One Razorpay payment pays one order.
    expect((await settleRazorpayOrder(db, order.ref as string, deps(() => paid(order.amountMinor, "pay_SAME1234")))).status).toBe("activated");
    const c2 = await creator(pg);
    const other = await razorpayOrder(db, c2);
    expect(await settleRazorpayOrder(db, other.ref as string, deps(() => paid(other.amountMinor, "pay_SAME1234")))).toEqual({ status: "rejected", reason: "payment_already_used" });
  });

  test("a PayU reply cannot settle a Razorpay order", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c);
    const payu: PayuConfig = { key: "k", salt: "s", mode: "live" };
    const fields: Record<string, string> = {
      key: "k", txnid: order.txnid, status: "success", amount: "299.00", productinfo: "p", firstname: "f", email: "e@x.in", udf1: String(order.id), mihpayid: "123",
    };
    fields.hash = replyHash(readReply(fields), payu.salt);
    const r = await settlePlanPayment(db, readReply(fields), { config: payu, fetchPayment: async () => paid(order.amountMinor, "123") });
    expect(r).toEqual({ status: "rejected", reason: "unknown_order" });
    expect((await row(pg, order.id)).status).toBe("pending");
  });

  test("the daily check pays a Razorpay order whose webhook was lost, and PayU's check never touches it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c);
    const later = new Date(T0.getTime() + 30 * 60 * 1000);

    // PayU's check (old orders only) does not even look at it.
    const payu: PayuConfig = { key: "k", salt: "s", mode: "live" };
    expect((await reconcilePendingOrders(db, { config: payu, fetchPayment: async () => ({ kind: "not_found" }), now: () => addDays(T0, 2) })).looked).toBe(0);
    expect((await row(pg, order.id)).status).toBe("pending");

    const answers = fakeFetch(200, { items: [{ id: "pay_LOST1234", amount: order.amountMinor, currency: "INR", status: "captured" }] });
    const r = await reconcilePendingOrders(db, { ...razorpayDeps(CONFIG, 1000, answers.fn), now: () => later });
    expect(r).toMatchObject({ looked: 1, activated: 1, errors: 0 });
    expect(answers.calls[0].url).toBe(`https://api.razorpay.com/v1/orders/${order.ref}/payments`);
    expect(await row(pg, order.id)).toMatchObject({ status: "paid", payu_ref: "pay_LOST1234" });
  });

  test("an order Razorpay never heard of is closed out after a day, and the page check settles the creator's own order", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const stale = await razorpayOrder(db, c);
    const r = await reconcilePendingOrders(db, deps(() => ({ kind: "not_found" }), addDays(T0, 1.5)));
    expect(r.abandoned).toBe(1);
    expect(await row(pg, stale.id)).toMatchObject({ status: "failed", failure_reason: RAZORPAY_ABANDONED_REASON });

    const c2 = await creator(pg);
    const fresh = await razorpayOrder(db, c2, { now: addDays(T0, 2) });
    const page = await settleCreatorOrders(db, c2, deps(() => paid(fresh.amountMinor), addDays(T0, 2)));
    expect(page).toMatchObject({ looked: 1, activated: 1 });
  });

  test("an order whose Razorpay order could not be made is closed and never asked about", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const order = await razorpayOrder(db, c, { ref: null });
    await failUnstartedOrder(db, order.id);
    expect(await row(pg, order.id)).toMatchObject({ status: "failed", failure_reason: NOT_STARTED_REASON });
    const asked: (string | null)[] = [];
    await reconcilePendingOrders(db, deps((ref) => {
      asked.push(ref);
      return { kind: "not_found" };
    }, addDays(T0, 0.1)));
    expect(asked).toHaveLength(0);
    // A Razorpay order id can be saved only once, and only on a pending Razorpay order.
    expect(await attachProviderOrder(db, order.id, "order_LATE1234")).toBe(false);
  });
});
