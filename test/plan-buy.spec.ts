import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { buildReminder, sendPassReminders, type ReminderTarget, type SendResult } from "../src/lib/pass-reminders";
import { checkPayer, CheckoutInputError } from "../src/lib/payu";
import { createPlanOrder, quotePlan, settlePlanPayment, type SettleDeps } from "../src/lib/plan-orders";
import {
  buyingOpen,
  istMoment,
  latestOrder,
  paidOrder,
  paidOrders,
  passStatus,
  paymentNotice,
  receiptNumber,
  rupees,
  termWords,
  type OrderSummary,
} from "../src/lib/plan-view";
import { readReply, replyHash, type PayuConfig } from "../src/lib/payu";
import type { PlanPrices } from "../src/lib/pricing";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The buying side of the Paid features page: what the creator is shown, what is said after PayU
// sends them back, the receipt's reads and the "your pass ends soon" reminder. (The payment
// checks themselves are in plan-orders.spec.ts.)

const PRICES: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 1 } };
const NO_EARLY: PlanPrices = { monthly: 299, yearly: 2499, early: null };
const LIVE: PayuConfig = { key: "testkey", salt: "testsalt", mode: "live" };
const T0 = new Date("2026-11-10T06:00:00.000Z");
const day = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * day);

let seq = 0;
async function creator(pg: PGlite, o: { status?: string; name?: string | null } = {}): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status) values ($1, $2, $3, $4, $5) returning id::text`,
    [`buy${seq}`, `buy${seq}@example.com`, `buyer${seq}`, o.name === undefined ? `Buyer ${seq}` : o.name, o.status ?? "active"],
  );
  return Number(r.rows[0].id);
}

// Makes an order and, when asked, pays it through the real settle path.
async function pay(pg: PGlite, creatorId: number, o: { term?: number; plan?: string; prices?: PlanPrices; now?: Date; livemode?: boolean } = {}) {
  const db = asLedgerDb(pg);
  const r = await createPlanOrder(db, { termsVersion: "4 November 2026",
    creatorId,
    term: o.term ?? 1,
    plan: o.plan ?? "creator",
    prices: o.prices ?? NO_EARLY,
    livemode: o.livemode ?? true,
    isOwner: true,
    now: o.now ?? T0,
  });
  if (!r.ok) throw new Error(`no order: ${r.reason}`);
  const order = r.order;
  const config: PayuConfig = { ...LIVE, mode: o.livemode === false ? "test" : "live" };
  const reply = readReply({
    key: config.key,
    txnid: order.txnid,
    status: "success",
    unmappedstatus: "captured",
    amount: `${Math.floor(order.amountMinor / 100)}.${String(order.amountMinor % 100).padStart(2, "0")}`,
    productinfo: "Freetip paid features",
    firstname: "Riya",
    email: "riya@example.com",
    mihpayid: `pay_${order.id}`,
    udf1: String(order.id),
  });
  const deps: SettleDeps = {
    config,
    now: () => o.now ?? T0,
    sleep: async () => {},
    fetchPayment: async () => ({ kind: "success", amountMinor: order.amountMinor, payuRef: `pay_${order.id}` }),
  };
  const result = await settlePlanPayment(db, { ...reply, hash: replyHash(reply, config.salt) }, deps);
  if (result.status !== "activated") throw new Error(`not paid: ${result.status}`);
  return order;
}

const summary = (over: Partial<OrderSummary> = {}): OrderSummary => ({
  id: 7,
  status: "pending",
  plan: "creator",
  termMonths: 1,
  amountMinor: 29900,
  livemode: true,
  createdAt: T0,
  paidAt: null,
  passStartsAt: null,
  passEndsAt: null,
  payuRef: null,
  ...over,
});

test.describe("the price shown and the price charged", () => {
  test("quotePlan gives each term's price, null until prices are set", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    expect(await quotePlan(db, c, "creator", { monthly: null, yearly: null, early: null }, T0)).toBeNull();
    expect(await quotePlan(db, c, "creator", NO_EARLY, T0)).toEqual({
      1: { amountMinor: 29900, early: false, covered: false },
      12: { amountMinor: 249900, early: false, covered: false },
    });
    expect(await quotePlan(db, c, "creator", PRICES, T0)).toEqual({
      1: { amountMinor: 14900, early: true, covered: false },
      12: { amountMinor: 129900, early: true, covered: false },
    });
  });

  test("buyingOpen: live sales need the switch except for the owner, test mode is the owner's only, no PayU settings is closed", () => {
    expect(buyingOpen("live", false, true)).toBe(true); // the owner can try the first real payment while sales are closed
    expect(buyingOpen("live", false, false)).toBe(false); // placeholder prices: no creator
    expect(buyingOpen("live", true, false)).toBe(true);
    expect(buyingOpen("test", false, false)).toBe(false); // a creator never pays in test mode
    expect(buyingOpen("test", false, true)).toBe(true);
    expect(buyingOpen("test", true, false)).toBe(false);
    expect(buyingOpen(null, true, true)).toBe(false);
  });

  test("an order is made only when the amount the creator saw is still the price", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const base = { creatorId: c, term: 1, plan: "creator", prices: PRICES, livemode: true, isOwner: false, now: T0 };
    const ok = await createPlanOrder(db, { termsVersion: "4 November 2026", ...base, expectAmountMinor: 14900 });
    expect(ok).toMatchObject({ ok: true, order: { amountMinor: 14900, early: true } });
    // Another creator now holds the only early seat, so this one's price has moved to the normal one.
    const other = await creator(pg);
    expect(await createPlanOrder(db, { termsVersion: "4 November 2026", ...base, creatorId: other, expectAmountMinor: 14900 })).toEqual({
      ok: false,
      reason: "price_changed",
      amountMinor: 29900,
    });
    // The refusal made no order for them.
    const n = await pg.query<{ n: string }>(`select count(*)::text n from plan_orders where creator_id = $1`, [other]);
    expect(Number(n.rows[0].n)).toBe(0);
    // Shown the right price, they can buy.
    expect((await createPlanOrder(db, { termsVersion: "4 November 2026", ...base, creatorId: other, expectAmountMinor: 29900 })).ok).toBe(true);
    // A wrong amount that is lower than the price is refused as well.
    expect(await createPlanOrder(db, { termsVersion: "4 November 2026", ...base, creatorId: other, expectAmountMinor: 100 })).toMatchObject({ ok: false, reason: "price_changed" });
  });
});

test.describe("the mobile number and addresses are checked before an order exists", () => {
  const urls = { success: "https://freetip.in/api/payu/return", failure: "https://freetip.in/api/payu/return", cancel: "https://freetip.in/api/payu/cancel" };
  const payer = { firstname: "Riya Sharma", email: "riya@example.com", phone: "98765 43210" };

  test("accepts an Indian mobile number in the usual spellings and returns the cleaned values", () => {
    for (const phone of ["9876543210", "98765 43210", "+91 98765-43210", "919876543210", "09876543210"]) {
      expect(checkPayer({ ...payer, phone }, urls).phone).toBe("9876543210");
    }
  });

  test("refuses what PayU would refuse", () => {
    const bad = [
      { ...payer, phone: "12345" },
      { ...payer, phone: "5876543210" },
      { ...payer, phone: "" },
      { ...payer, email: "not an email" },
      { ...payer, email: `${"a".repeat(60)}@example.com` },
    ];
    for (const p of bad) expect(() => checkPayer(p, urls)).toThrow(CheckoutInputError);
    expect(() => checkPayer(payer, { ...urls, success: "http://freetip.in/api/payu/return" })).toThrow(CheckoutInputError);
  });
});

test.describe("what the plans page says after PayU sends the creator back", () => {
  test("says nothing without a known word in the address", () => {
    expect(paymentNotice(undefined, summary({ status: "paid", passEndsAt: T0 }))).toBeNull();
    expect(paymentNotice("<script>", summary())).toBeNull();
    expect(paymentNotice("", null)).toBeNull();
  });

  test("the database decides, not the word: a typed 'paid' with no paid order is never a success", () => {
    expect(paymentNotice("paid", summary({ status: "pending" }))?.kind).toBe("info");
    expect(paymentNotice("paid", summary({ status: "failed" }))?.kind).toBe("error");
    expect(paymentNotice("paid", null)).toBeNull();
  });

  test("a paid order is success whatever the word, and names the end", () => {
    const n = paymentNotice("failed", summary({ status: "paid", passEndsAt: new Date("2026-12-10T06:00:00.000Z") }));
    expect(n?.kind).toBe("ok");
    expect(n?.text).toContain("10 December 2026");
    expect(n?.text).toContain("IST");
  });

  test("cancelled is said plainly, with or without an order", () => {
    expect(paymentNotice("cancelled", null)?.text).toMatch(/nothing was charged/);
    expect(paymentNotice("cancelled", summary({ status: "pending" }))?.text).toMatch(/cancelled/);
    expect(paymentNotice("cancelled", summary({ status: "failed" }))?.text).toMatch(/cancelled/);
  });

  test("pending and a problem tell the creator what to do and never echo the gateway's words", () => {
    expect(paymentNotice("pending", summary({ status: "pending" }))?.text).toMatch(/waiting for the payment to be confirmed/);
    expect(paymentNotice("problem", null)?.kind).toBe("error");
    expect(paymentNotice("problem", null)?.text).toMatch(/payment ID/);
  });
});

test.describe("reading orders for the page and the receipt", () => {
  test("the latest order is the newest within three days, and only paid ones are listed", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    expect(await latestOrder(db, c, T0)).toBeNull();
    const first = await pay(pg, c, { now: T0 });
    const second = await createPlanOrder(db, { termsVersion: "4 November 2026", creatorId: c, term: 12, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: false, now: addDays(T0, 1) });
    if (!second.ok) throw new Error("no order");
    const latest = await latestOrder(db, c, addDays(T0, 1));
    expect(latest).toMatchObject({ id: second.order.id, status: "pending", termMonths: 12, amountMinor: 249900 });
    // Four days on, the older ones are out of the window.
    expect(await latestOrder(db, c, addDays(T0, 5))).toBeNull();
    const list = await paidOrders(db, c);
    expect(list.map((o) => o.id)).toEqual([first.id]);
    expect(list[0]).toMatchObject({ status: "paid", amountMinor: 29900, payuRef: `pay_${first.id}` });
    expect(list[0].passEndsAt?.toISOString()).toBe("2026-12-10T06:00:00.000Z");
  });

  test("a receipt can be read only by the creator who paid, and only when paid", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const mine = await creator(pg);
    const theirs = await creator(pg);
    const order = await pay(pg, mine);
    expect(await paidOrder(db, mine, order.id)).toMatchObject({ id: order.id, status: "paid" });
    expect(await paidOrder(db, theirs, order.id)).toBeNull();
    expect(await paidOrder(db, mine, 999999)).toBeNull();
    expect(await paidOrder(db, mine, -1)).toBeNull();
    expect(await paidOrder(db, mine, Number.NaN)).toBeNull();
    // An unpaid order has no receipt.
    const unpaid = await createPlanOrder(db, { termsVersion: "4 November 2026", creatorId: mine, term: 1, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 });
    if (!unpaid.ok) throw new Error("no order");
    expect(await paidOrder(db, mine, unpaid.order.id)).toBeNull();
  });

  test("a test-money order is marked as such for the receipt", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const order = await pay(pg, c, { livemode: false });
    const [o] = await paidOrders(asLedgerDb(pg), c);
    expect(o.id).toBe(order.id);
    expect(o.livemode).toBe(false);
  });
});

test.describe("words and the running pass", () => {
  test("rupees, terms, receipt numbers and moments in Indian time", () => {
    expect(rupees(29900)).toBe("₹299");
    expect(rupees(249900)).toBe("₹2,499");
    expect(rupees(100050)).toBe("₹1,000.50");
    expect(termWords(1)).toBe("1 month");
    expect(termWords(12)).toBe("12 months");
    expect(receiptNumber(42)).toBe("FT-000042");
    // 06:00 UTC is 11:30 in India.
    expect(istMoment(new Date("2026-12-10T06:00:00.000Z"))).toBe("10 December 2026, 11:30 am IST");
  });

  test("a pass is none, running, or ending inside five days", () => {
    expect(passStatus(null, T0)).toEqual({ state: "none" });
    expect(passStatus(addDays(T0, -1), T0)).toEqual({ state: "none" });
    expect(passStatus("not a date", T0)).toEqual({ state: "none" });
    expect(passStatus(addDays(T0, 30), T0)).toMatchObject({ state: "running", daysLeft: 30 });
    expect(passStatus(addDays(T0, 5), T0)).toMatchObject({ state: "ending", daysLeft: 5 });
    expect(passStatus(new Date(T0.getTime() + 3600_000), T0)).toMatchObject({ state: "ending", daysLeft: 1 });
  });
});

test.describe("the reminder before a pass ends", () => {
  async function withPass(pg: PGlite, endsInDays: number, o: { status?: string; name?: string | null } = {}) {
    const id = await creator(pg, o);
    await pg.query(`update users set creator_until = $2::timestamptz, pass_keys = '{alertText}', paid_features = '{alertText}' where id = $1`, [
      id,
      addDays(T0, endsInDays).toISOString(),
    ]);
    return id;
  }
  const reminded = async (pg: PGlite, id: number) =>
    (await pg.query<{ creator_reminded_until: Date | null }>(`select creator_reminded_until from users where id = $1`, [id])).rows[0].creator_reminded_until;
  const recorder = (result: SendResult | ((t: ReminderTarget) => SendResult) = "sent") => {
    const sent: ReminderTarget[] = [];
    return {
      sent,
      send: async (t: ReminderTarget): Promise<SendResult> => {
        sent.push(t);
        return typeof result === "function" ? result(t) : result;
      },
    };
  };

  test("goes to creators whose pass ends within five days, once per end date", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const soon = await withPass(pg, 4);
    await withPass(pg, 6); // not yet
    await withPass(pg, -1); // already over
    const r = recorder();
    expect(await sendPassReminders(db, r.send, { now: T0 })).toEqual({ looked: 1, sent: 1, failed: 0, off: false });
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0].email).toBe(`buy${seq - 2}@example.com`);
    expect((await reminded(pg, soon))?.toISOString()).toBe(addDays(T0, 4).toISOString());
    // The next day's run does not repeat the first creator's; the one whose pass was 6 days out is
    // now inside the window and gets its own.
    const again = recorder();
    expect(await sendPassReminders(db, again.send, { now: addDays(T0, 1) })).toMatchObject({ looked: 1, sent: 1 });
    expect(again.sent.map((t) => t.email)).toEqual([`buy${seq - 1}@example.com`]);
    // And a third run the same day finds nothing at all.
    const third = recorder();
    expect(await sendPassReminders(db, third.send, { now: addDays(T0, 1) })).toMatchObject({ looked: 0, sent: 0 });
  });

  test("a new term moves the end date and earns a new reminder", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await withPass(pg, 3);
    const r = recorder();
    await sendPassReminders(db, r.send, { now: T0 });
    expect(r.sent).toHaveLength(1);
    // The creator buys a month more: the end moves out, and the old reminder no longer counts.
    await pg.query(`update users set creator_until = $2::timestamptz where id = $1`, [id, addDays(T0, 33).toISOString()]);
    expect(await sendPassReminders(db, r.send, { now: addDays(T0, 10) })).toMatchObject({ looked: 0 });
    expect(await sendPassReminders(db, r.send, { now: addDays(T0, 29) })).toMatchObject({ looked: 1, sent: 1 });
    expect(r.sent).toHaveLength(2);
  });

  test("a send that fails is tried again next run; one that is off stops the run and claims nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await withPass(pg, 2);
    const failing = recorder("failed");
    expect(await sendPassReminders(db, failing.send, { now: T0 })).toMatchObject({ looked: 1, sent: 0, failed: 1, off: false });
    expect(await reminded(pg, a)).toBeNull();
    const throwing = recorder(() => {
      throw new Error("network down");
    });
    expect(await sendPassReminders(db, throwing.send, { now: T0 })).toMatchObject({ failed: 1 });
    expect(await reminded(pg, a)).toBeNull();
    const off = recorder("off");
    expect(await sendPassReminders(db, off.send, { now: T0 })).toMatchObject({ off: true, sent: 0 });
    expect(await reminded(pg, a)).toBeNull();
    // Once the sender works, tomorrow's run sends it.
    const working = recorder();
    expect(await sendPassReminders(db, working.send, { now: addDays(T0, 1) })).toMatchObject({ sent: 1 });
    expect(await reminded(pg, a)).not.toBeNull();
  });

  test("skips a creator whose account is not active", async () => {
    const pg = await freshDatabase();
    await withPass(pg, 2, { status: "suspended" });
    const r = recorder();
    expect(await sendPassReminders(asLedgerDb(pg), r.send, { now: T0 })).toMatchObject({ looked: 0 });
    expect(r.sent).toHaveLength(0);
  });

  test("the email holds only our own words in the subject, and no stray characters from the name", () => {
    const { subject, text } = buildReminder(
      { name: "Riya\r\nBcc: x@y.z <b>Sharma</b>", email: "riya@example.com", plan: "creator", endsAt: new Date("2026-12-10T06:00:00.000Z") },
      "https://freetip.in",
    );
    expect(subject).toBe("Your Freetip Creator plan ends on 10 December");
    expect(text).toContain("Hi Riya,");
    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("10 December 2026, 11:30 am IST");
    expect(text).toContain("https://freetip.in/dashboard/plans");
    expect(text).toMatch(/no automatic renewal/);
    expect(buildReminder({ name: null, email: "a@b.c", plan: "creator", endsAt: T0 }, "https://freetip.in").text).toContain("Hi there,");
  });
});
