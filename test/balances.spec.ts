import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual } from "../src/lib/accrual";
import { postTipReversal } from "../src/lib/reversal";
import { LEGACY_RATES, splitTip } from "../src/lib/money";
import {
  HOLD_DAYS_NEW_CREATOR,
  HOLD_DAYS_OTHER,
  HOLD_DAYS_UPI,
  MIN_PAYOUT_PAISE,
  holdDays,
  workOutBalance,
} from "../src/lib/balances";
import { getCreatorBalances } from "../src/lib/admin/balance-queries";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-03T06:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

test.describe("hold rules (pure)", () => {
  test("UPI waits 7 days; anything else 30, or 60 for a creator with no completed payout", () => {
    expect(holdDays("upi", false)).toBe(HOLD_DAYS_UPI);
    expect(holdDays("upi", true)).toBe(HOLD_DAYS_UPI);
    expect(holdDays("card", true)).toBe(HOLD_DAYS_OTHER);
    expect(holdDays("card", false)).toBe(HOLD_DAYS_NEW_CREATOR);
    // A method we never recorded is treated as the slowest kind, not the fastest.
    expect(holdDays(null, true)).toBe(HOLD_DAYS_OTHER);
    expect(holdDays("wallet", false)).toBe(HOLD_DAYS_NEW_CREATOR);
  });

  test("a tip is held up to the last moment and free exactly when its hold ends", () => {
    const tip = (capturedAt: Date) => [{ capturedAt, method: "upi", netPaise: 9000 }];
    const justInside = new Date(NOW.getTime() - HOLD_DAYS_UPI * DAY + 1);
    expect(workOutBalance(9000, tip(justInside), true, NOW).availablePaise).toBe(0);
    const justOutside = new Date(NOW.getTime() - HOLD_DAYS_UPI * DAY);
    expect(workOutBalance(9000, tip(justOutside), true, NOW).availablePaise).toBe(9000);
  });

  test("available is the balance less what is held, and never below zero", () => {
    const tips = [
      { capturedAt: daysAgo(1), method: "upi", netPaise: 4000 },
      { capturedAt: daysAgo(20), method: "upi", netPaise: 6000 },
    ];
    const b = workOutBalance(10000, tips, true, NOW);
    expect(b).toMatchObject({ balancePaise: 10000, heldPaise: 4000, availablePaise: 6000 });
    expect(b.nextReleaseAt?.getTime()).toBe(daysAgo(1).getTime() + HOLD_DAYS_UPI * DAY);

    // Part of the balance already paid out or taken back: held can exceed the balance.
    expect(workOutBalance(1000, tips, true, NOW).availablePaise).toBe(0);
    expect(workOutBalance(-500, [], true, NOW)).toMatchObject({ availablePaise: 0, balancePaise: -500 });
  });

  test("a tip whose net is zero (taken back) is not held", () => {
    const b = workOutBalance(0, [{ capturedAt: daysAgo(1), method: "upi", netPaise: 0 }], false, NOW);
    expect(b).toMatchObject({ heldPaise: 0, availablePaise: 0, nextReleaseAt: null });
  });
});

let seq = 0;

async function creator(pg: PGlite, extra: { status?: string; upi?: string | null } = {}): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, upi_vpa)
     values ($1, $2, $3, $4, $5, $6) returning id::text`,
    [`bg${seq}`, `bc${seq}@example.com`, `bcreator${seq}`, `Creator ${seq}`, extra.status ?? "active", extra.upi === undefined ? "a@upi" : extra.upi],
  );
  return Number(r.rows[0].id);
}

async function postedTip(
  pg: PGlite,
  creatorId: number,
  o: { gross: number; capturedAt: Date; method: string | null },
) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, 'captured', $4::timestamptz) returning id::text`,
    [creatorId, `btip_${seq}`, o.gross, o.capturedAt.toISOString()],
  );
  const paymentRef = `bpay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status, payment_method,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, $6, true, $5, 'INR', $7::timestamptz)`,
    [t.rows[0].id, `border_${seq}`, paymentRef, o.method, o.gross, `bkey_${seq}`, o.capturedAt.toISOString()],
  );
  await postCaptureAccrual(asLedgerDb(pg), paymentRef);
  // The fixture saves no pair on the order, so it carries the column default (the legacy 5% + 2.75%).
  return { paymentRef, share: splitTip(o.gross, LEGACY_RATES).creatorSharePaise };
}

function data<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Expected a readable result, got: ${r.error}`);
  return r.data;
}

test.describe("balances from the ledger", () => {
  test("held and available follow each tip's method and age", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const old = await postedTip(pg, c, { gross: 100000, capturedAt: daysAgo(10), method: "upi" });
    const fresh = await postedTip(pg, c, { gross: 50000, capturedAt: daysAgo(2), method: "upi" });
    const card = await postedTip(pg, c, { gross: 20000, capturedAt: daysAgo(10), method: "card" });

    const { rows, minPayoutMinor } = data(await getCreatorBalances(db, NOW));
    expect(minPayoutMinor).toBe(MIN_PAYOUT_PAISE);
    expect(rows).toHaveLength(1);
    // No completed payout yet, so the card tip waits 60 days; the fresh UPI tip waits 7.
    expect(rows[0]).toMatchObject({
      creatorId: c,
      balanceMinor: old.share + fresh.share + card.share,
      heldMinor: fresh.share + card.share,
      availableMinor: old.share,
      hasCompletedPayout: false,
      payableNow: true,
    });
  });

  test("a completed payout shortens the card hold to 30 days", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const card = await postedTip(pg, c, { gross: 20000, capturedAt: daysAgo(31), method: "card" });
    await pg.query(`insert into creator_payouts (creator_id, amount_minor, status) values ($1, 100, 'completed')`, [c]);
    const [row] = data(await getCreatorBalances(asLedgerDb(pg), NOW)).rows;
    expect(row.hasCompletedPayout).toBe(true);
    expect(row.heldMinor).toBe(0);
    expect(row.availableMinor).toBe(card.share);
  });

  test("a tip Razorpay took back is neither owed nor held", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const gone = await postedTip(pg, c, { gross: 30000, capturedAt: daysAgo(1), method: "upi" });
    const kept = await postedTip(pg, c, { gross: 10000, capturedAt: daysAgo(30), method: "upi" });
    expect((await postTipReversal(db, gone.paymentRef, 30000, "refund")).status).toBe("reversed");

    const [row] = data(await getCreatorBalances(db, NOW)).rows;
    expect(row).toMatchObject({ balanceMinor: kept.share, heldMinor: 0, availableMinor: kept.share });
  });

  test("a payout needs at least the minimum, an active creator and a UPI ID", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const big = { gross: 100000, capturedAt: daysAgo(30), method: "upi" };
    const pending = await creator(pg, { status: "pending" });
    await postedTip(pg, pending, big);
    const noUpi = await creator(pg, { upi: null });
    await postedTip(pg, noUpi, big);
    const ok = await creator(pg);
    await postedTip(pg, ok, big);
    const tiny = await creator(pg);
    await postedTip(pg, tiny, { ...big, gross: 50000 }); // share 46,125 paise, just under ₹500

    const rows = data(await getCreatorBalances(db, NOW)).rows;
    const by = (id: number) => rows.find((r) => r.creatorId === id)!;
    expect(by(ok).payableNow).toBe(true);
    expect(by(pending).payableNow).toBe(false);
    expect(by(noUpi).payableNow).toBe(false);
    expect(by(tiny).availableMinor).toBeLessThan(MIN_PAYOUT_PAISE);
    expect(by(tiny).payableNow).toBe(false);
  });

  test("an empty ledger lists nobody and a missing table says so", async () => {
    const pg = await freshDatabase();
    expect(data(await getCreatorBalances(asLedgerDb(pg), NOW)).rows).toEqual([]);

    const real = console.error;
    console.error = () => {};
    try {
      await pg.exec(`drop table creator_payouts cascade`);
      const r = await getCreatorBalances(asLedgerDb(pg), NOW);
      expect(r.ok).toBe(false);
    } finally {
      console.error = real;
    }
  });
});
