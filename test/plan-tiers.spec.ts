import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import type { LedgerDb } from "../src/lib/accrual";
import { sendPassReminders, type ReminderTarget, type SendResult } from "../src/lib/pass-reminders";
import { createPlanOrder, endPlanNow, expirePasses, quotePlan, settlePlanPayment, type SettleDeps } from "../src/lib/plan-orders";
import { CREATOR_EXTRA_KEYS, CUSTOM_KEYS, STARTER_KEYS, planFeatureKeys } from "../src/lib/plan-catalogue";
import { FEATURES } from "../src/lib/plans";
import { readReply, replyHash, type PayuConfig } from "../src/lib/payu";
import { TIER_PRICES, type PlanKey, type PlanPrices } from "../src/lib/pricing";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// The two plans, Starter and Creator, against the real schema in memory: each is its own pass, a
// payment switches on only its plan's features, a plan that ends takes away only what no running
// plan still covers, and early seats are counted per plan.

const NO_EARLY: PlanPrices = { monthly: TIER_PRICES.creator.monthly, yearly: TIER_PRICES.creator.yearly, early: null };
const EARLY2: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 2 } };
const EARLY1: PlanPrices = { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 1 } };
const LIVE: PayuConfig = { key: "testkey", salt: "testsalt", mode: "live" };
const T0 = new Date("2026-11-10T06:00:00.000Z");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const STARTER = [...planFeatureKeys("starter")];
const CREATOR = [...planFeatureKeys("creator")];
const CREATOR_ONLY = CREATOR.filter((k) => !STARTER.includes(k));

let seq = 0;
async function creator(pg: PGlite, o: { features?: string[] } = {}): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, paid_features)
     values ($1, $2, $3, $4, 'active', $5::text[]) returning id::text`,
    [`tier${seq}`, `tier${seq}@example.com`, `tiercreator${seq}`, `Tier ${seq}`, o.features ?? []],
  );
  return Number(r.rows[0].id);
}

const userRow = async (pg: PGlite, id: number) =>
  (await pg.query<{ paid_features: string[]; pass_keys: string[]; starter_until: Date | null; creator_until: Date | null }>(
    `select paid_features, pass_keys, starter_until, creator_until from users where id = $1`,
    [id],
  )).rows[0];
const iso = (d: Date | null) => (d ? d.toISOString() : null);

// Makes an order for a plan and pays it through the real settle path.
let ref = 0;
async function buy(
  pg: PGlite,
  creatorId: number,
  plan: PlanKey,
  o: { term?: number; now?: Date; prices?: PlanPrices } = {},
) {
  const db = asLedgerDb(pg);
  const now = o.now ?? T0;
  const made = await createPlanOrder(db, {
    creatorId,
    term: o.term ?? 1,
    plan,
    prices: o.prices ?? NO_EARLY,
    livemode: true,
    isOwner: false,
    now,
  });
  if (!made.ok) throw new Error(`no order: ${made.reason}`);
  const order = made.order;
  ref += 1;
  const reply = readReply({
    key: LIVE.key,
    txnid: order.txnid,
    status: "success",
    unmappedstatus: "captured",
    amount: `${Math.floor(order.amountMinor / 100)}.${String(order.amountMinor % 100).padStart(2, "0")}`,
    productinfo: "Freetip plan",
    firstname: "Riya",
    email: "riya@example.com",
    mihpayid: `tierpay_${ref}`,
    udf1: String(order.id),
  });
  const deps: SettleDeps = {
    config: LIVE,
    now: () => now,
    sleep: async () => {},
    fetchPayment: async () => ({ kind: "success", amountMinor: order.amountMinor, payuRef: `tierpay_${ref}` }),
  };
  const result = await settlePlanPayment(db, { ...reply, hash: replyHash(reply, LIVE.salt) }, deps);
  if (result.status !== "activated") throw new Error(`not paid: ${result.status}`);
  return order;
}

test.describe("which features a plan switches on", () => {
  test("Starter is inside Creator, and neither grants the custom page, the meter or pinned messages", () => {
    for (const k of STARTER) expect(CREATOR).toContain(k);
    expect(CREATOR.length).toBeGreaterThan(STARTER.length);
    for (const k of [...CUSTOM_KEYS, "highlightedMessages"]) {
      expect(STARTER).not.toContain(k);
      expect(CREATOR).not.toContain(k);
    }
    // Every offered feature is granted by Creator or is the owner's by-hand custom page.
    const offered = FEATURES.filter((f) => f.built && f.key !== "highlightedMessages").map((f) => f.key);
    expect([...CREATOR, ...CUSTOM_KEYS].sort()).toEqual([...offered].sort());
    expect(STARTER.length).toBe(STARTER_KEYS.length);
    expect(CREATOR.length).toBe(STARTER_KEYS.length + CREATOR_EXTRA_KEYS.length);
  });
});

test.describe("buying a plan", () => {
  test("Starter switches on Starter's features only and moves only Starter's end date", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const o = await buy(pg, c, "starter");
    expect(o.plan).toBe("starter");
    const u = await userRow(pg, c);
    expect([...u.paid_features].sort()).toEqual([...STARTER].sort());
    expect([...u.pass_keys].sort()).toEqual([...STARTER].sort());
    expect(iso(u.starter_until)).toBe("2026-12-10T06:00:00.000Z");
    expect(u.creator_until).toBeNull();
    const audit = await pg.query<{ after_json: { plan: string } }>(`select after_json from audit_events where action = 'plan.purchased'`);
    expect(audit.rows[0].after_json.plan).toBe("starter");
  });

  test("Creator adds its extra features on top, and the two plans keep their own end dates", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await buy(pg, c, "starter", { term: 12 });
    await buy(pg, c, "creator");
    const u = await userRow(pg, c);
    expect([...u.paid_features].sort()).toEqual([...CREATOR].sort());
    expect(iso(u.starter_until)).toBe("2027-11-10T06:00:00.000Z");
    expect(iso(u.creator_until)).toBe("2026-12-10T06:00:00.000Z");
    // Nothing was carried from one plan to the other: Creator ends a month on, not a year.
  });

  test("a second term of the same plan starts where that plan ended; the other plan is untouched", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await buy(pg, c, "creator");
    await buy(pg, c, "starter", { now: addDays(T0, 2) });
    await buy(pg, c, "creator", { now: addDays(T0, 10) });
    const u = await userRow(pg, c);
    expect(iso(u.creator_until)).toBe("2027-01-10T06:00:00.000Z");
    expect(iso(u.starter_until)).toBe("2026-12-12T06:00:00.000Z");
  });

  test("an unknown plan is refused and nothing is written", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    for (const plan of ["gold", "", "CREATOR", "custom"]) {
      expect(await createPlanOrder(db, { creatorId: c, term: 1, plan, prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).toEqual({
        ok: false,
        reason: "bad_plan",
      });
    }
    expect(Number((await pg.query<{ n: string }>(`select count(*)::text n from plan_orders`)).rows[0].n)).toBe(0);
  });

  test("a Starter term that a running Creator pass already covers is refused; a longer one is not", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "creator", { term: 12 });
    // Creator runs a year: a month or a year of Starter adds nothing, to the minute.
    for (const term of [1, 12]) {
      expect(await createPlanOrder(db, { creatorId: c, term, plan: "starter", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).toEqual({
        ok: false,
        reason: "already_covered",
      });
    }
    // A creator with one month of Creator may buy a year of Starter: it runs past the Creator pass.
    const d = await creator(pg);
    await buy(pg, d, "creator");
    expect((await createPlanOrder(db, { creatorId: d, term: 12, plan: "starter", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).ok).toBe(true);
    expect(await createPlanOrder(db, { creatorId: d, term: 1, plan: "starter", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).toMatchObject({ reason: "already_covered" });
    // A lapsed Creator pass that the daily job has not cleared yet covers nothing.
    const e = await creator(pg);
    await buy(pg, e, "creator");
    expect((await createPlanOrder(db, { creatorId: e, term: 1, plan: "starter", prices: NO_EARLY, livemode: true, isOwner: false, now: addDays(T0, 31) })).ok).toBe(true);
    // Creator over a running Starter is always allowed (it adds features).
    const f = await creator(pg);
    await buy(pg, f, "starter", { term: 12 });
    expect((await createPlanOrder(db, { creatorId: f, term: 1, plan: "creator", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).ok).toBe(true);
  });
});

test.describe("when a plan ends", () => {
  test("Starter ends while Creator runs: nothing is taken away, only Starter's end date clears", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "starter");
    await buy(pg, c, "creator", { term: 12 });
    expect(await expirePasses(db, addDays(T0, 40))).toEqual({ expired: 1 });
    const u = await userRow(pg, c);
    expect([...u.paid_features].sort()).toEqual([...CREATOR].sort());
    expect([...u.pass_keys].sort()).toEqual([...CREATOR].sort());
    expect(u.starter_until).toBeNull();
    expect(u.creator_until).not.toBeNull();
    // Nothing left to expire until Creator ends.
    expect(await expirePasses(db, addDays(T0, 41))).toEqual({ expired: 0 });
  });

  test("Creator ends while Starter runs: only Creator's extra features go", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "starter", { term: 12 });
    await buy(pg, c, "creator");
    expect(await expirePasses(db, addDays(T0, 40))).toEqual({ expired: 1 });
    const u = await userRow(pg, c);
    expect([...u.paid_features].sort()).toEqual([...STARTER].sort());
    expect([...u.pass_keys].sort()).toEqual([...STARTER].sort());
    expect(u.creator_until).toBeNull();
    expect(iso(u.starter_until)).toBe("2027-11-10T06:00:00.000Z");
    for (const k of CREATOR_ONLY) expect(u.paid_features).not.toContain(k);
    // And when Starter ends too, everything the passes added is gone.
    expect(await expirePasses(db, addDays(T0, 400))).toEqual({ expired: 1 });
    expect(await userRow(pg, c)).toMatchObject({ paid_features: [], pass_keys: [], starter_until: null, creator_until: null });
  });

  test("both end on the same run: everything goes in one step, with one audit line", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "starter");
    await buy(pg, c, "creator");
    expect(await expirePasses(db, addDays(T0, 40))).toEqual({ expired: 1 });
    expect(await userRow(pg, c)).toMatchObject({ paid_features: [], pass_keys: [], starter_until: null, creator_until: null });
    const audit = await pg.query<{ n: string }>(`select count(*)::text n from audit_events where action = 'plan.expired'`);
    expect(Number(audit.rows[0].n)).toBe(1);
  });

  test("a feature the owner ticked by hand stays when the plan that also grants it ends", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    // The owner ticked alertText and a Creator-only feature before any purchase.
    const c = await creator(pg, { features: ["alertText", "fanCrm"] });
    await buy(pg, c, "creator");
    await expirePasses(db, addDays(T0, 40));
    expect((await userRow(pg, c)).paid_features.sort()).toEqual(["alertText", "fanCrm"]);
  });

  test("the custom page and the meter, ticked by hand, survive every plan ending", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, { features: ["pageBuilder", "pressureMeter"] });
    await buy(pg, c, "creator");
    const u = await userRow(pg, c);
    expect(u.pass_keys).not.toContain("pageBuilder");
    await expirePasses(db, addDays(T0, 40));
    expect((await userRow(pg, c)).paid_features.sort()).toEqual(["pageBuilder", "pressureMeter"]);
  });

  test("a renewal bought before the end keeps a plan from being switched off", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "starter");
    await buy(pg, c, "starter", { now: addDays(T0, 20) });
    expect(await expirePasses(db, addDays(T0, 35))).toEqual({ expired: 0 });
    expect((await userRow(pg, c)).paid_features.length).toBe(STARTER.length);
    expect(await expirePasses(db, addDays(T0, 61))).toEqual({ expired: 1 });
  });
});

test.describe("the early price, per plan", () => {
  const quote = async (db: LedgerDb, id: number, plan: PlanKey, prices: PlanPrices, now: Date) => (await quotePlan(db, id, plan, prices, now))![1];

  test("seats are counted for each plan on its own", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    // Two creators take the two Starter early seats.
    for (let i = 0; i < 2; i++) {
      const c = await creator(pg);
      const o = await buy(pg, c, "starter", { prices: EARLY2 });
      expect(o.early).toBe(true);
    }
    // A third creator: Starter is at the normal price, Creator still has both seats.
    const third = await creator(pg);
    expect(await quote(db, third, "starter", EARLY2, T0)).toEqual({ amountMinor: 29900, early: false, covered: false });
    expect(await quote(db, third, "creator", EARLY2, T0)).toEqual({ amountMinor: 14900, early: true, covered: false });
  });

  test("a holder keeps the early price on renewing the same plan once every seat is taken, but not for the other plan", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    // One seat per plan. The holder takes the only Starter seat; another creator takes the only Creator seat.
    const holder = await creator(pg);
    await buy(pg, holder, "starter", { prices: EARLY1 });
    const other = await creator(pg);
    await buy(pg, other, "creator", { prices: EARLY1 });
    // A newcomer finds no early Starter seat: this is the case the renewal rule exists for.
    expect(await quote(db, await creator(pg), "starter", EARLY1, addDays(T0, 20))).toMatchObject({ amountMinor: 29900, early: false });
    // The holder renews Starter at the early price (their own seat)...
    expect(await quote(db, holder, "starter", EARLY1, addDays(T0, 20))).toMatchObject({ amountMinor: 14900, early: true });
    // ...but an early Starter does not earn an early Creator.
    expect(await quote(db, holder, "creator", EARLY1, addDays(T0, 20))).toMatchObject({ amountMinor: 29900, early: false });
    // And the order really is made at that price, early.
    const renewed = await buy(pg, holder, "starter", { prices: EARLY1, now: addDays(T0, 20) });
    expect(renewed).toMatchObject({ early: true, amountMinor: 14900 });
  });
});

test.describe("a Starter term a running Creator pass covers", () => {
  test("is marked covered per term in the quote, and only a Starter term can be", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await buy(pg, c, "creator", { term: 1 });
    // One month of Creator: a month of Starter ends no later, a year of Starter runs past it.
    const starter = (await quotePlan(db, c, "starter", NO_EARLY, T0))!;
    expect(starter[1].covered).toBe(true);
    expect(starter[12].covered).toBe(false);
    // Creator itself is never covered.
    const creatorQuote = (await quotePlan(db, c, "creator", NO_EARLY, T0))!;
    expect(creatorQuote[1].covered).toBe(false);
    expect(creatorQuote[12].covered).toBe(false);
    // The order check agrees with the quote.
    expect(await createPlanOrder(db, { creatorId: c, term: 1, plan: "starter", prices: NO_EARLY, livemode: true, isOwner: false, now: T0 })).toMatchObject({ reason: "already_covered" });
    // A creator with no Creator pass has nothing covered.
    const d = await creator(pg);
    const none = (await quotePlan(db, d, "starter", NO_EARLY, T0))!;
    expect([none[1].covered, none[12].covered]).toEqual([false, false]);
  });
});

test.describe("the owner ends a plan now", () => {
  test("clears that plan's dates, takes away only what nothing else covers, and writes one owner audit line", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, { features: ["pageBuilder"] });
    await buy(pg, c, "starter", { term: 12 });
    await buy(pg, c, "creator");
    expect(await endPlanNow(db, c, "creator", "refunded by hand", addDays(T0, 3))).toBe(true);
    const u = await userRow(pg, c);
    expect(u.creator_until).toBeNull();
    expect(iso(u.starter_until)).toBe("2027-11-10T06:00:00.000Z");
    expect([...u.paid_features].sort()).toEqual([...STARTER, "pageBuilder"].sort());
    for (const k of CREATOR_ONLY) expect(u.paid_features).not.toContain(k);
    const audit = await pg.query<{ actor_role: string; action: string; reason: string }>(
      `select actor_role, action, reason from audit_events where action like 'plan.%' and action <> 'plan.purchased'`,
    );
    expect(audit.rows).toEqual([{ actor_role: "owner", action: "plan.ended_by_owner", reason: "refunded by hand" }]);
    // Ending a plan that is not running changes nothing and says so.
    expect(await endPlanNow(db, c, "creator", "again", addDays(T0, 4))).toBe(false);
    expect(await endPlanNow(db, c, "starter", "and Starter too", addDays(T0, 4))).toBe(true);
    expect(await userRow(pg, c)).toMatchObject({ paid_features: ["pageBuilder"], pass_keys: [], starter_until: null, creator_until: null });
  });
});

test.describe("the daily job survives one bad creator", () => {
  test("a creator whose switch-off fails is skipped and the rest are still switched off", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const bad = await creator(pg);
    const good = await creator(pg);
    await buy(pg, bad, "starter");
    await buy(pg, good, "starter");
    // A trigger that makes the first creator's update fail.
    await pg.exec(`
      create function fail_for_bad() returns trigger language plpgsql as $$
        begin if new.id = ${bad} then raise exception 'boom'; end if; return new; end $$;
      create trigger fail_bad before update on users for each row when (old.starter_until is not null and new.starter_until is null)
        execute function fail_for_bad();
    `);
    const log = console.error;
    console.error = () => {};
    let r;
    try {
      r = await expirePasses(db, addDays(T0, 40));
    } finally {
      console.error = log;
    }
    expect(r).toEqual({ expired: 1 });
    expect((await userRow(pg, good)).paid_features).toEqual([]);
    expect((await userRow(pg, bad)).paid_features.length).toBe(STARTER.length);
    // Once the fault is gone the next run clears the one left behind.
    await pg.exec(`drop trigger fail_bad on users`);
    expect(await expirePasses(db, addDays(T0, 41))).toEqual({ expired: 1 });
  });
});

test.describe("the reminder, per plan", () => {
  const recorder = () => {
    const sent: ReminderTarget[] = [];
    return {
      sent,
      send: async (t: ReminderTarget): Promise<SendResult> => {
        sent.push(t);
        return "sent";
      },
    };
  };
  const setUntil = (pg: PGlite, id: number, starter: number | null, creatorDays: number | null) =>
    pg.query(`update users set starter_until = $2::timestamptz, creator_until = $3::timestamptz where id = $1`, [
      id,
      starter === null ? null : addDays(T0, starter).toISOString(),
      creatorDays === null ? null : addDays(T0, creatorDays).toISOString(),
    ]);

  test("each plan gets its own reminder naming the plan, once per end date", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const only = await creator(pg);
    await setUntil(pg, only, 3, null);
    const r = recorder();
    expect(await sendPassReminders(db, r.send, { now: T0 })).toEqual({ looked: 1, sent: 1, failed: 0, off: false });
    expect(r.sent[0]).toMatchObject({ plan: "starter", email: `tier${seq}@example.com` });
    // Not again for the same end date, and the Creator column is untouched.
    expect(await sendPassReminders(db, recorder().send, { now: T0 })).toMatchObject({ looked: 0 });
    const row = await pg.query<{ s: Date | null; c: Date | null }>(`select starter_reminded_until s, creator_reminded_until c from users where id = $1`, [only]);
    expect(row.rows[0].s).not.toBeNull();
    expect(row.rows[0].c).toBeNull();
  });

  test("a Starter end that a longer Creator pass covers sends nothing; a Creator end does", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await setUntil(pg, c, 2, 40); // Starter ends soon, Creator runs on: nothing changes for them
    expect(await sendPassReminders(db, recorder().send, { now: T0 })).toMatchObject({ looked: 0 });
    const d = await creator(pg);
    await setUntil(pg, d, 40, 2); // Creator ends soon, Starter runs on: features drop, so remind
    const r = recorder();
    expect(await sendPassReminders(db, r.send, { now: T0 })).toMatchObject({ looked: 1, sent: 1 });
    expect(r.sent[0].plan).toBe("creator");
    // Both ending the same week: Starter's is covered only if Creator ends no earlier.
    const e = await creator(pg);
    await setUntil(pg, e, 3, 3);
    const both = recorder();
    await sendPassReminders(db, both.send, { now: T0 });
    expect(both.sent.map((t) => t.plan)).toEqual(["creator"]);
  });

  test("an end date with microseconds is reminded once, not every day", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    // A date the driver cannot round-trip through a JavaScript Date (whole milliseconds only).
    await pg.query(`update users set creator_until = '2026-11-12 06:00:00.123456+00'::timestamptz where id = $1`, [c]);
    const first = recorder();
    expect(await sendPassReminders(db, first.send, { now: T0 })).toMatchObject({ looked: 1, sent: 1 });
    const again = recorder();
    expect(await sendPassReminders(db, again.send, { now: addDays(T0, 1) })).toMatchObject({ looked: 0, sent: 0 });
    expect(again.sent).toEqual([]);
  });

  test("a reminder that did not send gives its claim back for that plan only", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await setUntil(pg, c, null, 2);
    const failing = { send: async (): Promise<SendResult> => "failed" };
    expect(await sendPassReminders(db, failing.send, { now: T0 })).toMatchObject({ failed: 1 });
    const row = await pg.query<{ c: Date | null }>(`select creator_reminded_until c from users where id = $1`, [c]);
    expect(row.rows[0].c).toBeNull();
    const ok = recorder();
    expect(await sendPassReminders(db, ok.send, { now: addDays(T0, 1) })).toMatchObject({ sent: 1 });
  });
});

test.describe("the migration", () => {
  test("carries a running single pass from 0055 over to the Creator plan, and can be run again", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    // A user as 0055 left them: a running pass, no per-plan end date yet.
    await pg.query(`update users set pass_until = $2::timestamptz, pass_reminded_until = $3::timestamptz, creator_until = null, creator_reminded_until = null where id = $1`, [
      c,
      "2026-12-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
    ]);
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    const u = await pg.query<{ creator_until: Date; creator_reminded_until: Date; starter_until: Date | null }>(
      `select creator_until, creator_reminded_until, starter_until from users where id = $1`,
      [c],
    );
    expect(u.rows[0].creator_until.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(u.rows[0].creator_reminded_until.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(u.rows[0].starter_until).toBeNull();
    // An older order reads as a Creator order, and the plan is checked.
    const o = await pg.query<{ plan: string }>(
      `insert into plan_orders (creator_id, txnid, term_months, amount_minor, livemode) values ($1, 'FTplanDefault01', 1, 100, true) returning plan`,
      [c],
    );
    expect(o.rows[0].plan).toBe("creator");
    await expect(
      pg.query(`insert into plan_orders (creator_id, txnid, term_months, plan, amount_minor, livemode) values ($1, 'FTplanBad000001', 1, 'gold', 100, true)`, [c]),
    ).rejects.toThrow();
  });
});

test.describe("the migration, run again after the deploy", () => {
  test("moves a payment the old code wrote meanwhile, keeps the later date, and never copies back", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await pg.query(`update users set pass_until = '2026-12-01T00:00:00Z', creator_until = null where id = $1`, [c]);
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    // The old code settles a payment: it writes only the retired columns, later than the new date.
    await pg.query(`update users set pass_until = '2027-01-01T00:00:00Z', pass_reminded_until = null where id = $1`, [c]);
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    const u = await pg.query<{ creator_until: Date; pass_until: Date | null; pass_reminded_until: Date | null }>(
      `select creator_until, pass_until, pass_reminded_until from users where id = $1`,
      [c],
    );
    expect(u.rows[0].creator_until.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(u.rows[0].pass_until).toBeNull();
    expect(u.rows[0].pass_reminded_until).toBeNull();
    // A third run finds nothing to move and changes nothing.
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    expect(iso((await userRow(pg, c)).creator_until)).toBe("2027-01-01T00:00:00.000Z");
  });

  test("an earlier old-code date does not pull a later Creator date back", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await pg.query(`update users set creator_until = '2027-06-01T00:00:00Z' where id = $1`, [c]);
    await pg.query(`update users set pass_until = '2026-12-01T00:00:00Z' where id = $1`, [c]);
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    expect(iso((await userRow(pg, c)).creator_until)).toBe("2027-06-01T00:00:00.000Z");
  });

  test("stops remembering the custom page, the meter and pinned messages as a pass's keys, and keeps them on", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { features: ["alertText", "pageBuilder", "pressureMeter", "highlightedMessages"] });
    await pg.query(`update users set pass_keys = array['alertText','pageBuilder','pressureMeter','highlightedMessages'] where id = $1`, [c]);
    await pg.exec(readMigration("0056_plan_tiers.sql"));
    const u = await userRow(pg, c);
    expect(u.pass_keys).toEqual(["alertText"]);
    expect([...u.paid_features].sort()).toEqual(["alertText", "highlightedMessages", "pageBuilder", "pressureMeter"]);
  });
});

// A shape check kept next to the others: the ledger type is the one the order code expects.
export type _Db = LedgerDb;
