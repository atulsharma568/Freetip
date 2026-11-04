import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual } from "../src/lib/accrual";
import { postTipReversal } from "../src/lib/reversal";
import { LEGACY_RATES, STANDARD_RATES, splitTip } from "../src/lib/money";
import { HOLD_DAYS_UPI } from "../src/lib/balances";
import { loadEarningsSummary, loadStatement } from "../src/lib/creator-earnings";
import { statementCsv, toStatementRow } from "../src/lib/earnings-statement";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-10T10:00:00Z");

test.describe("statement rows", () => {
  const base = { tipId: 1, fanName: "Riya", grossPaise: 10000, netPaise: 9200, method: "upi" };

  test("a recent tip is pending until its hold ends, an old one is released", () => {
    const fresh = toStatementRow({ ...base, capturedAt: new Date(now.getTime() - DAY / 2), rates: STANDARD_RATES }, false, now);
    expect(fresh.status).toBe("held");
    expect(fresh.releasesAt?.getTime()).toBe(new Date(now.getTime() - DAY / 2).getTime() + HOLD_DAYS_UPI * DAY);
    const old = toStatementRow({ ...base, capturedAt: new Date(now.getTime() - 30 * DAY), rates: STANDARD_RATES }, false, now);
    expect(old).toMatchObject({ status: "released", releasesAt: null });
  });

  test("the two charges follow the pair saved on the order, and net is the ledger's figure", () => {
    const a = toStatementRow({ ...base, capturedAt: now, rates: STANDARD_RATES }, false, now);
    expect([a.platformFeePaise, a.processingPaise, a.netPaise]).toEqual([500, 300, 9200]);
    const b = toStatementRow({ ...base, netPaise: 9225, capturedAt: now, rates: LEGACY_RATES }, false, now);
    expect([b.platformFeePaise, b.processingPaise, b.netPaise]).toEqual([500, 275, 9225]);
  });

  test("a tip the ledger nets to nothing is reversed and never pending", () => {
    const r = toStatementRow({ ...base, netPaise: 0, capturedAt: now, rates: STANDARD_RATES }, false, now);
    expect(r).toMatchObject({ status: "reversed", releasesAt: null });
  });

  test("a blank name reads Anonymous", () => {
    expect(toStatementRow({ ...base, fanName: "  ", capturedAt: now, rates: STANDARD_RATES }, false, now).name).toBe("Anonymous");
    expect(toStatementRow({ ...base, fanName: null, capturedAt: now, rates: STANDARD_RATES }, false, now).name).toBe("Anonymous");
  });
});

test.describe("statement CSV", () => {
  test("plain numbers, a header, and typed text cannot run as a formula", () => {
    const row = toStatementRow(
      { tipId: 1, fanName: "=HYPERLINK(1)", grossPaise: 10000, netPaise: 9200, method: "upi", capturedAt: now, rates: STANDARD_RATES },
      false,
      now,
    );
    const csv = statementCsv([row]);
    expect(csv.startsWith("﻿Date (IST),Fan,Tip (INR),Freetip fee (INR),Processing charge (INR),You keep (INR),Status,Pending until (IST)")).toBe(true);
    const line = csv.split("\r\n")[1];
    expect(line).toContain("'=HYPERLINK(1)");
    expect(line).toContain(",100.00,5.00,3.00,92.00,Pending,");
  });
});

let seq = 0;
async function creator(pg: PGlite): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1, $2, $3) returning id::text`,
    [`e${seq}`, `e${seq}@example.com`, `earner${seq}`],
  );
  return Number(r.rows[0].id);
}

// A captured live tip with the pair saved on the order (as createTipOrder now does for every order).
async function postedTip(pg: PGlite, creatorId: number, gross: number, name: string | null, capturedAt = now) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at, fan_name, platform_bps, processing_bps)
     values ($1, $2, $3, 'captured', $4, $5, 500, 300) returning id::text`,
    [creatorId, `tip_${seq}`, gross, capturedAt.toISOString(), name],
  );
  const paymentRef = `pay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at, payment_method)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, true, $4, 'INR', $6, 'upi')`,
    [t.rows[0].id, `order_${seq}`, paymentRef, gross, `tip_${seq}`, capturedAt.toISOString()],
  );
  expect(await postCaptureAccrual(asLedgerDb(pg), paymentRef)).toEqual({ status: "posted" });
  return { paymentRef, tipId: Number(t.rows[0].id) };
}

test.describe("creator earnings against the real schema", () => {
  test("balance, pending and the statement agree with each other and with the published split", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const me = await creator(pg);
    const other = await creator(pg);
    await postedTip(pg, me, 10000, "Riya", new Date(now.getTime() - DAY / 2));
    await postedTip(pg, me, 5000, null, new Date(now.getTime() - 40 * DAY));
    await postedTip(pg, other, 99900, "Someone else");

    const rows = await loadStatement(db, me, 25, 0, now);
    expect(rows.map((r) => r.grossPaise)).toEqual([10000, 5000]); // newest first, nobody else's tip
    for (const r of rows) {
      // The ledger's figure for the creator equals the published split at the saved pair.
      expect(r.netPaise).toBe(splitTip(r.grossPaise, STANDARD_RATES).creatorSharePaise);
      expect(r.platformFeePaise + r.processingPaise + r.netPaise).toBe(r.grossPaise);
    }
    expect(rows.map((r) => r.status)).toEqual(["held", "released"]);
    expect(rows[1].name).toBe("Anonymous");

    const s = await loadEarningsSummary(db, me, now);
    expect(s.balancePaise).toBe(9200 + 4600);
    expect(s.pendingPaise).toBe(9200); // only the half-day-old UPI tip is inside its 1-day hold
    expect(s.nextReleaseAt?.getTime()).toBe(now.getTime() - DAY / 2 + HOLD_DAYS_UPI * DAY);
    expect(s.paidOutPaise).toBe(0);
    expect(s.payouts).toEqual([]);
  });

  test("a refunded tip nets to nothing and shows as reversed", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const me = await creator(pg);
    const t = await postedTip(pg, me, 10000, "Riya");
    expect((await postTipReversal(db, t.paymentRef, 10000, "refund")).status).toBe("reversed");

    const [row] = await loadStatement(db, me, 25, 0, now);
    expect(row).toMatchObject({ status: "reversed", netPaise: 0, releasesAt: null });
    const s = await loadEarningsSummary(db, me, now);
    expect([s.balancePaise, s.pendingPaise]).toEqual([0, 0]);
  });

  test("a creator with no posted tips sees an empty statement and zeroes", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const me = await creator(pg);
    expect(await loadStatement(db, me, 25, 0, now)).toEqual([]);
    expect(await loadEarningsSummary(db, me, now)).toMatchObject({ balancePaise: 0, pendingPaise: 0, paidOutPaise: 0 });
  });

  test("paging reads the next rows and a completed payout is counted as paid out", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const me = await creator(pg);
    for (let i = 0; i < 3; i += 1) await postedTip(pg, me, 10000 + i, `Fan ${i}`, new Date(now.getTime() - i * 60_000));
    const first = await loadStatement(db, me, 2, 0, now);
    const second = await loadStatement(db, me, 2, 2, now);
    expect([first.length, second.length]).toEqual([2, 1]);
    expect(new Set([...first, ...second].map((r) => r.tipId)).size).toBe(3);

    await pg.query(`insert into creator_payouts (creator_id, amount_minor, status, completed_at) values ($1, 5000, 'completed', now())`, [me]);
    const s = await loadEarningsSummary(db, me, now);
    expect(s.paidOutPaise).toBe(5000);
    expect(s.payouts).toHaveLength(1);
  });
});
