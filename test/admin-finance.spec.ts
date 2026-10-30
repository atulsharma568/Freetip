import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual, postMissingAccruals, type LedgerDb } from "../src/lib/accrual";
import { splitTip } from "../src/lib/money";
import { rangeAllTime, type DateRange } from "../src/lib/admin/date-range";
import { getCreatorEarnings } from "../src/lib/admin/creator-queries";
import {
  getFinanceSummary,
  getNotPosted,
  getTestModeTipCount,
} from "../src/lib/admin/finance-queries";
import {
  getPayments,
  getReconciliationSummary,
  getSettlements,
} from "../src/lib/admin/payment-queries";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The owner's finance pages against the real schema, in memory: what the helpers
// report must agree with what the ledger holds, test-mode money must stay out of
// every figure, and a database that cannot be read must say so instead of
// showing zeros.

let seq = 0;
const ALL = (): DateRange => rangeAllTime();

async function creator(pg: PGlite, name?: string): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name) values ($1, $2, $3, $4) returning id::text`,
    [`ag${seq}`, `ac${seq}@example.com`, `acreator${seq}`, name ?? `Creator ${seq}`],
  );
  return Number(r.rows[0].id);
}

interface TipOptions {
  gross?: number;
  creatorId?: number;
  livemode?: boolean | null;
  capturedAt?: string;
  capturedAmount?: number | null;
}

async function tip(pg: PGlite, o: TipOptions = {}) {
  seq += 1;
  const gross = o.gross ?? 10000;
  const creatorId = o.creatorId ?? (await creator(pg));
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, 'captured', coalesce($4::timestamptz, now())) returning id::text`,
    [creatorId, `atip_${seq}`, gross, o.capturedAt ?? null],
  );
  const paymentRef = `apay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, $6, $7, 'INR', now())`,
    [
      t.rows[0].id,
      `aorder_${seq}`,
      paymentRef,
      gross,
      `atip_${seq}`,
      "livemode" in o ? o.livemode : true,
      "capturedAmount" in o ? o.capturedAmount : gross,
    ],
  );
  return { tipId: Number(t.rows[0].id), paymentRef, creatorId, gross };
}

// What the money rules say each tip is worth, summed.
function expected(grosses: number[]) {
  const parts = grosses.map(splitTip);
  const sum = (pick: (s: ReturnType<typeof splitTip>) => number) => parts.reduce((n, s) => n + pick(s), 0);
  return {
    gross: sum((s) => s.grossPaise),
    fee: sum((s) => s.platformFeePaise),
    processing: sum((s) => s.processingPaise),
    share: sum((s) => s.creatorSharePaise),
  };
}

// Real data, so the data must be there: fails the test with the error if a read failed.
function data<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Expected a readable result, got: ${r.error}`);
  return r.data;
}

async function silently<T>(fn: () => Promise<T>): Promise<T> {
  const real = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = real;
  }
}

test.describe("totals match the ledger", () => {
  test("finance summary, per-creator rows and the payments list agree with what was posted", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg, "Ananya");
    const b = await creator(pg, "Bharat");
    const tips = [
      await tip(pg, { creatorId: a, gross: 10000 }),
      await tip(pg, { creatorId: a, gross: 25050 }),
      await tip(pg, { creatorId: b, gross: 99900 }),
    ];
    for (const t of tips) await postCaptureAccrual(db, t.paymentRef);

    const all = expected([10000, 25050, 99900]);
    const summary = data(await getFinanceSummary(db, ALL()));
    expect(summary.tipsCapturedCount).toBe(3);
    expect(summary.grossCapturedMinor).toBe(all.gross);
    expect(summary.ourFeeMinor).toBe(all.fee);
    expect(summary.processingChargeMinor).toBe(all.processing);
    expect(summary.creatorShareMinor).toBe(all.share);
    expect(summary.owedToCreatorsMinor).toBe(all.share);
    expect(summary.razorpayOwesUsMinor).toBe(all.gross);
    expect(summary.testModeTipCount).toBe(0);
    expect(summary.notPosted).toEqual({ count: 0, grossMinor: 0, postableCount: 0, needsLookCount: 0 });
    // Every rupee is accounted for: nothing is invented or lost between the parts.
    expect(summary.creatorShareMinor + summary.ourFeeMinor + summary.processingChargeMinor).toBe(
      summary.grossCapturedMinor,
    );

    const rows = data(await getCreatorEarnings(db, ALL()));
    expect(rows.map((r) => r.creatorId).sort()).toEqual([a, b].sort());
    const ana = rows.find((r) => r.creatorId === a)!;
    const bha = rows.find((r) => r.creatorId === b)!;
    const anaExpected = expected([10000, 25050]);
    expect(ana).toMatchObject({
      name: "Ananya",
      tipCount: 2,
      grossMinor: anaExpected.gross,
      creatorShareMinor: anaExpected.share,
      ourFeeMinor: anaExpected.fee,
      owedNowMinor: anaExpected.share,
    });
    expect(ana.lastTipAt).toBeInstanceOf(Date);
    expect(bha).toMatchObject({ tipCount: 1, grossMinor: 99900, owedNowMinor: expected([99900]).share });
    // The per-creator figures add up to the page total.
    expect(rows.reduce((n, r) => n + r.owedNowMinor, 0)).toBe(summary.owedToCreatorsMinor);
    expect(rows.reduce((n, r) => n + r.ourFeeMinor, 0)).toBe(summary.ourFeeMinor);
    expect(rows.reduce((n, r) => n + r.grossMinor, 0)).toBe(summary.grossCapturedMinor);

    const list = data(await getPayments(db, ALL()));
    expect(list.rows).toHaveLength(3);
    expect(list.truncated).toBe(false);
    expect(list.totals).toEqual({
      tipCount: 3,
      grossMinor: all.gross,
      ourFeeMinor: all.fee,
      processingChargeMinor: all.processing,
      creatorShareMinor: all.share,
    });
    const row = list.rows.find((r) => r.orderId === tips[1].tipId)!;
    const one = splitTip(25050);
    expect(row).toMatchObject({
      grossMinor: 25050,
      live: true,
      posted: true,
      ourFeeMinor: one.platformFeePaise,
      processingChargeMinor: one.processingPaise,
      creatorShareMinor: one.creatorSharePaise,
    });
  });

  test("figures are for the period, balances are for all time", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const old = await tip(pg, { creatorId: c, gross: 20000, capturedAt: "2026-01-10T06:00:00Z" });
    const recent = await tip(pg, { creatorId: c, gross: 10000 });
    await postCaptureAccrual(db, old.paymentRef);
    await postCaptureAccrual(db, recent.paymentRef);

    const lastWeek: DateRange = {
      from: new Date(Date.now() - 7 * 86_400_000),
      to: new Date(Date.now() + 86_400_000),
      label: "Last 7 days",
    };
    const s = data(await getFinanceSummary(db, lastWeek));
    expect(s.tipsCapturedCount).toBe(1);
    expect(s.grossCapturedMinor).toBe(10000);
    expect(s.ourFeeMinor).toBe(expected([10000]).fee);
    // The balance is the whole ledger, not the week.
    expect(s.owedToCreatorsMinor).toBe(expected([20000, 10000]).share);
    expect(s.razorpayOwesUsMinor).toBe(30000);

    const rows = data(await getCreatorEarnings(db, lastWeek));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tipCount: 1,
      grossMinor: 10000,
      creatorShareMinor: expected([10000]).share,
      owedNowMinor: expected([20000, 10000]).share,
    });
  });
});

test.describe("test-mode money", () => {
  test("is left out of every figure and counted on its own", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const live = await tip(pg, { gross: 10000 });
    const testOnlyCreator = await creator(pg, "Tester");
    await tip(pg, { creatorId: testOnlyCreator, gross: 50000, livemode: false });
    await tip(pg, { creatorId: testOnlyCreator, gross: 70000, livemode: null });
    await postMissingAccruals(db);

    const s = data(await getFinanceSummary(db, ALL()));
    expect(s.tipsCapturedCount).toBe(1);
    expect(s.grossCapturedMinor).toBe(10000);
    expect(s.testModeTipCount).toBe(2);
    expect(s.owedToCreatorsMinor).toBe(expected([10000]).share);
    expect(s.razorpayOwesUsMinor).toBe(10000);
    expect(s.notPosted.count).toBe(0);
    expect(data(await getTestModeTipCount(db, ALL()))).toBe(2);

    const rows = data(await getCreatorEarnings(db, ALL()));
    expect(rows.map((r) => r.creatorId)).toEqual([live.creatorId]);

    const list = data(await getPayments(db, ALL()));
    expect(list.rows).toHaveLength(3);
    const test = list.rows.filter((r) => !r.live);
    expect(test).toHaveLength(2);
    expect(test.every((r) => !r.posted && r.ourFeeMinor === 0 && r.creatorShareMinor === 0)).toBe(true);
    // Totals hold the live tip only.
    expect(list.totals.tipCount).toBe(1);
    expect(list.totals.grossMinor).toBe(10000);
  });
});

test.describe("a negative creator balance", () => {
  test("is shown negative, never floored at zero", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const t = await tip(pg, { gross: 10000 });
    await postCaptureAccrual(db, t.paymentRef);
    const share = expected([10000]).share;

    // A later debit bigger than what was earned (what a refund after a payout will
    // look like once those exist): a balanced transaction, so the ledger accepts it.
    await pg.transaction(async (tx) => {
      const id = (
        await tx.query<{ id: string }>(
          `insert into ledger_transactions (event_type, source_type, source_ref, creator_id, currency, effective_at, idempotency_key)
           values ('test_debit', 'test', 'x', $1, 'INR', now(), 'neg-1') returning id::text`,
          [t.creatorId],
        )
      ).rows[0].id;
      const acct = async (code: string) =>
        (await tx.query<{ id: string }>(`select id::text from ledger_accounts where code = $1`, [code])).rows[0].id;
      await tx.query(
        `insert into ledger_entries (ledger_transaction_id, account_id, creator_id, debit_minor) values ($1, $2, $3, 20000)`,
        [id, await acct("creator_payable"), t.creatorId],
      );
      await tx.query(
        `insert into ledger_entries (ledger_transaction_id, account_id, credit_minor) values ($1, $2, 20000)`,
        [id, await acct("refunds_payable")],
      );
    });

    const rows = data(await getCreatorEarnings(db, ALL()));
    expect(rows).toHaveLength(1);
    expect(rows[0].owedNowMinor).toBe(share - 20000);
    expect(rows[0].owedNowMinor).toBeLessThan(0);
    expect(rows[0].creatorShareMinor).toBe(share - 20000);

    const s = data(await getFinanceSummary(db, ALL()));
    expect(s.owedToCreatorsMinor).toBe(share - 20000);
    expect(s.owedToCreatorsMinor).toBeLessThan(0);

    // The tip's own row shows its share net of the later debit.
    const list = data(await getPayments(db, ALL()));
    expect(list.rows[0].creatorShareMinor).toBe(share);
  });
});

test.describe("not yet posted", () => {
  test("an unposted live tip shows as not posted until it is posted", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const posted = await tip(pg, { gross: 10000 });
    await postCaptureAccrual(db, posted.paymentRef);
    const waiting = await tip(pg, { gross: 25000 });
    // Razorpay's captured amount differs from the order: a person has to look.
    await tip(pg, { gross: 40000, capturedAmount: 39900 });

    const s = data(await getFinanceSummary(db, ALL()));
    expect(s.tipsCapturedCount).toBe(3);
    expect(s.grossCapturedMinor).toBe(75000);
    // The books hold only the posted tip.
    expect(s.razorpayOwesUsMinor).toBe(10000);
    expect(s.owedToCreatorsMinor).toBe(expected([10000]).share);
    expect(s.notPosted).toEqual({ count: 2, grossMinor: 65000, postableCount: 1, needsLookCount: 1 });
    expect(data(await getNotPosted(db))).toEqual(s.notPosted);

    const list = data(await getPayments(db, ALL()));
    const unposted = list.rows.find((r) => r.orderId === waiting.tipId)!;
    expect(unposted).toMatchObject({ live: true, posted: false, ourFeeMinor: 0, creatorShareMinor: 0 });
    expect(list.rows.filter((r) => r.posted)).toHaveLength(1);
    // The listed totals count what is posted only for fees and share, gross for every live tip.
    expect(list.totals.grossMinor).toBe(75000);
    expect(list.totals.creatorShareMinor).toBe(expected([10000]).share);

    // The creator with only an unposted tip is listed, with nothing owed yet.
    const rows = data(await getCreatorEarnings(db, ALL()));
    const waitingRow = rows.find((r) => r.creatorId === waiting.creatorId)!;
    expect(waitingRow).toMatchObject({ tipCount: 1, grossMinor: 25000, owedNowMinor: 0, creatorShareMinor: 0 });

    await postMissingAccruals(db);
    const after = data(await getFinanceSummary(db, ALL()));
    expect(after.notPosted).toEqual({ count: 1, grossMinor: 40000, postableCount: 0, needsLookCount: 1 });
    expect(after.owedToCreatorsMinor).toBe(expected([10000, 25000]).share);
  });
});

test.describe("an empty database and an unreadable one", () => {
  test("an empty database reads fine and is all zeros", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const s = data(await getFinanceSummary(db, ALL()));
    expect(s).toMatchObject({
      tipsCapturedCount: 0,
      grossCapturedMinor: 0,
      testModeTipCount: 0,
      creatorShareMinor: 0,
      ourFeeMinor: 0,
      processingChargeMinor: 0,
      owedToCreatorsMinor: 0,
      razorpayOwesUsMinor: 0,
    });
    expect(Object.is(s.razorpayOwesUsMinor, 0)).toBe(true);
    expect(data(await getCreatorEarnings(db, ALL()))).toEqual([]);
    expect(data(await getPayments(db, ALL())).rows).toEqual([]);
    expect(data(await getSettlements(db, ALL()))).toEqual([]);
    expect(data(await getReconciliationSummary(db))).toMatchObject({ totalRuns: 0, recentItems: [] });
  });

  test("a database that fails gives the could-not-read result, not zeros", async () => {
    const broken = (() => Promise.reject(new Error("connection refused"))) as unknown as LedgerDb;
    broken.begin = () => Promise.reject(new Error("connection refused"));

    const results = await silently(() =>
      Promise.all([
        getFinanceSummary(broken, ALL()),
        getCreatorEarnings(broken, ALL()),
        getPayments(broken, ALL()),
        getSettlements(broken, ALL()),
        getReconciliationSummary(broken),
        getNotPosted(broken),
        getTestModeTipCount(broken, ALL()),
      ]),
    );
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("connection refused");
    }
  });

  test("a schema without migration 0023 fails the reads that need it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await tip(pg);
    // What the database looks like before migration 0023: no livemode column.
    await pg.exec(`alter table payment_attempts drop column livemode`);

    const [summary, creators, payments, notPosted] = await silently(() =>
      Promise.all([
        getFinanceSummary(db, ALL()),
        getCreatorEarnings(db, ALL()),
        getPayments(db, ALL()),
        getNotPosted(db),
      ]),
    );
    for (const r of [summary, creators, payments, notPosted]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/livemode/);
    }
    // Reads that do not touch the missing column still work.
    expect((await getSettlements(db, ALL())).ok).toBe(true);
  });
});

test.describe("the payments list", () => {
  test("says when more orders exist than were listed", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    for (let i = 0; i < 3; i += 1) await tip(pg, { creatorId: c, gross: 10000 });
    await postMissingAccruals(db);

    const list = data(await getPayments(db, ALL(), 2));
    expect(list.rows).toHaveLength(2);
    expect(list.truncated).toBe(true);
    // The totals cover the rows listed, no more.
    expect(list.totals.tipCount).toBe(2);
    expect(list.totals.grossMinor).toBe(20000);
  });
});
