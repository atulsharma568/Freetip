import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual } from "../src/lib/accrual";
import { LEGACY_RATES, splitTip } from "../src/lib/money";
import {
  FIRST_PAYOUT_MAX_PAISE,
  MIN_PAYOUT_PAISE,
  PAYOUT_MAX_PAISE,
  amountToRequest,
  cancelPayout,
  checkUtr,
  markPayoutPaid,
  requestPayout,
} from "../src/lib/payouts";
import { loadEarningsSummary } from "../src/lib/creator-earnings";
import { getCreatorBalances } from "../src/lib/admin/balance-queries";
import { listOpenPayouts, listRecentPayouts } from "../src/lib/admin/payout-queries";
import { buildPayoutRequestEmail } from "../src/lib/payout-notification";
import { postTipReversal } from "../src/lib/reversal";
import { getFinanceSummary } from "../src/lib/admin/finance-queries";
import { getCreatorEarnings } from "../src/lib/admin/creator-queries";
import { rangeAllTime } from "../src/lib/admin/date-range";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-05T06:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000);

test.describe("payout amounts and references (pure)", () => {
  test("a request is for everything available, up to the ceiling, and never below the minimum", () => {
    expect(amountToRequest(MIN_PAYOUT_PAISE - 1, false)).toBe(0);
    expect(amountToRequest(MIN_PAYOUT_PAISE, false)).toBe(MIN_PAYOUT_PAISE);
    expect(amountToRequest(0, true)).toBe(0);
    expect(amountToRequest(-100, true)).toBe(0);
    // The first payout has the lower ceiling; later ones the higher.
    expect(amountToRequest(2_000_000, false)).toBe(FIRST_PAYOUT_MAX_PAISE);
    expect(amountToRequest(2_000_000, true)).toBe(2_000_000);
    expect(amountToRequest(9_000_000, true)).toBe(PAYOUT_MAX_PAISE);
  });

  test("a UTR is letters and digits only, 6 to 30 long, and is stored in capitals", () => {
    expect(checkUtr(" 4123 ")).toBeNull();
    expect(checkUtr("412345678901")).toBe("412345678901");
    expect(checkUtr("axisb1234567")).toBe("AXISB1234567");
    expect(checkUtr("41234567890'; drop")).toBeNull();
    expect(checkUtr("12345")).toBeNull();
    expect(checkUtr("1".repeat(31))).toBeNull();
    expect(checkUtr(undefined)).toBeNull();
    expect(checkUtr(412345678901)).toBeNull();
  });
});

let seq = 0;

async function creator(pg: PGlite, extra: { status?: string; upi?: string | null } = {}): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, onboarding_state, upi_vpa)
     values ($1, $2, $3, $4, $5, $6, $7) returning id::text`,
    [
      `pg${seq}`,
      `pc${seq}@example.com`,
      `pcreator${seq}`,
      `Creator ${seq}`,
      extra.status ?? "active",
      extra.status === undefined || extra.status === "active" ? "active" : "not_started",
      extra.upi === undefined ? "a@upi" : extra.upi,
    ],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, o: { gross: number; capturedAt: Date; method?: string }) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, 'captured', $4::timestamptz) returning id::text`,
    [creatorId, `ptip_${seq}`, o.gross, o.capturedAt.toISOString()],
  );
  const paymentRef = `ppay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status, payment_method,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, $6, true, $5, 'INR', $7::timestamptz)`,
    [t.rows[0].id, `porder_${seq}`, paymentRef, o.method ?? "upi", o.gross, `pkey_${seq}`, o.capturedAt.toISOString()],
  );
  await postCaptureAccrual(asLedgerDb(pg), paymentRef);
  // The fixture saves no pair on the order, so it carries the column default (the legacy 5% + 2.75%).
  return splitTip(o.gross, LEGACY_RATES).creatorSharePaise;
}

async function balanceOf(pg: PGlite, account: string, creatorId?: number): Promise<number> {
  const r = await pg.query<{ b: string }>(
    `select coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as b
       from ledger_entries e join ledger_accounts a on a.id = e.account_id
      where a.code = $1 and ($2::bigint is null or e.creator_id = $2)`,
    [account, creatorId ?? null],
  );
  return Number(r.rows[0].b);
}

const payoutRow = async (pg: PGlite, id: number) =>
  (await pg.query<Record<string, unknown>>(`select * from creator_payouts where id = $1`, [id])).rows[0];

test.describe("requesting a payout", () => {
  test("asks for what is available, moves it off the balance at once and balances the books", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const old = await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const fresh = await tip(pg, c, { gross: 60000, capturedAt: hoursAgo(2) });

    // Before: balance holds both, but today's UPI tip is still inside its one-day hold.
    expect((await loadEarningsSummary(db, c, NOW)).availablePaise).toBe(old);

    const r = await requestPayout(db, c, NOW);
    expect(r).toMatchObject({ status: "requested", amountPaise: old });
    if (r.status !== "requested") throw new Error("unreachable");

    const row = await payoutRow(pg, r.payoutId);
    expect(row).toMatchObject({ status: "initiated", upi_vpa: "a@upi", first_payout: true });
    expect(Number(row.amount_minor)).toBe(old);

    // The creator's balance dropped by the request; the new tip is still there and still held.
    const after = await loadEarningsSummary(db, c, NOW);
    expect(after.balancePaise).toBe(fresh);
    expect(after.availablePaise).toBe(0);
    expect(await balanceOf(pg, "payouts_in_flight")).toBe(old);

    // Audited under the creator.
    const a = await pg.query(`select actor_role, action, entity_ref from audit_events where entity_type = 'creator_payout'`);
    expect(a.rows).toEqual([{ actor_role: "creator", action: "payout.requested", entity_ref: String(r.payoutId) }]);
  });

  test("a second request while one waits is refused, and nothing is paid twice", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const first = await requestPayout(db, c, NOW);
    expect(first.status).toBe("requested");
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(2) });
    expect(await requestPayout(db, c, NOW)).toEqual({ status: "refused", reason: "open_request" });
    const n = await pg.query(`select count(*)::int as n from creator_payouts`);
    expect(n.rows[0]).toEqual({ n: 1 });
  });

  test("refuses below the minimum, without a UPI ID, and for an account that is not active", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);

    const small = await creator(pg);
    await tip(pg, small, { gross: 40000, capturedAt: daysAgo(3) }); // about ₹369: under ₹500
    expect(await requestPayout(db, small, NOW)).toEqual({ status: "refused", reason: "below_minimum" });

    const noUpi = await creator(pg, { upi: null });
    await tip(pg, noUpi, { gross: 100000, capturedAt: daysAgo(3) });
    expect(await requestPayout(db, noUpi, NOW)).toEqual({ status: "refused", reason: "no_upi" });

    const suspended = await creator(pg, { status: "suspended" });
    await tip(pg, suspended, { gross: 100000, capturedAt: daysAgo(3) });
    expect(await requestPayout(db, suspended, NOW)).toEqual({ status: "refused", reason: "not_active" });

    expect(await requestPayout(db, 999999, NOW)).toEqual({ status: "refused", reason: "no_creator" });
    const n = await pg.query(`select count(*)::int as n from creator_payouts`);
    expect(n.rows[0]).toEqual({ n: 0 });
  });

  test("a card tip waits far longer than a UPI tip, so it is not asked for", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(10), method: "card" });
    expect(await requestPayout(db, c, NOW)).toEqual({ status: "refused", reason: "below_minimum" });
  });

  test("the first payout is capped, and the rest stays available for the next one", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const share = await tip(pg, c, { gross: 2_000_000, capturedAt: daysAgo(3) }); // ₹20,000 tip
    const r = await requestPayout(db, c, NOW);
    expect(r).toMatchObject({ status: "requested", amountPaise: FIRST_PAYOUT_MAX_PAISE });
    if (r.status !== "requested") throw new Error("unreachable");

    const s = await loadEarningsSummary(db, c, NOW);
    expect(s.balancePaise).toBe(share - FIRST_PAYOUT_MAX_PAISE);
    expect(s.availablePaise).toBe(share - FIRST_PAYOUT_MAX_PAISE);
  });
});

test.describe("paying a payout", () => {
  async function requested(pg: PGlite, gross = 100000) {
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const share = await tip(pg, c, { gross, capturedAt: daysAgo(3) });
    const r = await requestPayout(db, c, NOW);
    if (r.status !== "requested") throw new Error("not requested");
    return { db, c, share, id: r.payoutId };
  }

  test("needs a proper UTR and the name check, and records both", async () => {
    const pg = await freshDatabase();
    const { db, c, share, id } = await requested(pg);

    expect(await markPayoutPaid(db, id, { utr: "12", nameMatched: true })).toEqual({ status: "refused", reason: "bad_utr" });
    expect(await markPayoutPaid(db, id, { utr: "412345678901", nameMatched: false })).toEqual({
      status: "refused",
      reason: "name_not_checked",
    });
    expect((await payoutRow(pg, id)).status).toBe("initiated");

    expect(await markPayoutPaid(db, id, { utr: "axis412345678", nameMatched: true })).toEqual({ status: "paid" });
    expect(await payoutRow(pg, id)).toMatchObject({
      status: "completed",
      provider_transfer_ref: "AXIS412345678",
      name_matched: true,
    });
    // The money left "requested, not paid" and the creator's balance is unchanged by paying.
    expect(await balanceOf(pg, "payouts_in_flight")).toBe(0);
    expect(await balanceOf(pg, "creator_payable", c)).toBe(0);
    expect(share).toBeGreaterThan(0);

    const s = await loadEarningsSummary(db, c, NOW);
    expect(s.paidOutPaise).toBe(share);
    expect(s.hasCompletedPayout).toBe(true);

    const audit = await pg.query(`select actor_role, action from audit_events where entity_type = 'creator_payout' order by id`);
    expect(audit.rows).toEqual([
      { actor_role: "creator", action: "payout.requested" },
      { actor_role: "owner", action: "payout.paid" },
    ]);
  });

  test("recording twice changes nothing, and one UTR cannot be used for two payouts", async () => {
    const pg = await freshDatabase();
    const a = await requested(pg);
    expect(await markPayoutPaid(a.db, a.id, { utr: "412345678901", nameMatched: true })).toEqual({ status: "paid" });
    expect(await markPayoutPaid(a.db, a.id, { utr: "412345678901", nameMatched: true })).toEqual({ status: "already" });
    const txns = await pg.query(`select count(*)::int as n from ledger_transactions where source_type = 'creator_payout'`);
    expect(txns.rows[0]).toEqual({ n: 2 }); // one request, one paid

    const b = await requested(pg);
    expect(await markPayoutPaid(b.db, b.id, { utr: "412345678901", nameMatched: true })).toEqual({
      status: "refused",
      reason: "utr_used",
    });
    expect((await payoutRow(pg, b.id)).status).toBe("initiated");
  });

  test("a payout that is not there cannot be recorded", async () => {
    const pg = await freshDatabase();
    expect(await markPayoutPaid(asLedgerDb(pg), 424242, { utr: "412345678901", nameMatched: true })).toEqual({
      status: "refused",
      reason: "missing",
    });
  });

  test("after the first payout is paid the creator can ask again, with the higher ceiling", async () => {
    const pg = await freshDatabase();
    const { db, c, id } = await requested(pg);
    await markPayoutPaid(db, id, { utr: "412345678901", nameMatched: true });
    const more = await tip(pg, c, { gross: 2_000_000, capturedAt: daysAgo(2) });
    const r = await requestPayout(db, c, NOW);
    expect(r).toMatchObject({ status: "requested", amountPaise: more });
    if (r.status !== "requested") throw new Error("unreachable");
    expect((await payoutRow(pg, r.payoutId)).first_payout).toBe(false);
  });
});

test.describe("cancelling a payout request", () => {
  test("puts the money back on the balance with a reversal, and the creator can ask again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const share = await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const r = await requestPayout(db, c, NOW);
    if (r.status !== "requested") throw new Error("not requested");
    expect((await loadEarningsSummary(db, c, NOW)).balancePaise).toBe(0);

    expect(await cancelPayout(db, r.payoutId, "wrong UPI ID")).toEqual({ status: "cancelled" });
    expect(await payoutRow(pg, r.payoutId)).toMatchObject({ status: "cancelled", cancel_reason: "wrong UPI ID" });
    expect((await loadEarningsSummary(db, c, NOW)).balancePaise).toBe(share);
    expect(await balanceOf(pg, "payouts_in_flight")).toBe(0);

    // The cancel posting reverses the request posting, once.
    const rev = await pg.query<{ reversal_of: string | null; request_id: string }>(
      `select c.reversal_of::text, q.id::text as request_id
         from ledger_transactions c, ledger_transactions q
        where c.idempotency_key = $1 and q.idempotency_key = $2`,
      [`payout:${r.payoutId}:cancel`, `payout:${r.payoutId}:request`],
    );
    expect(rev.rows[0].reversal_of).toBe(rev.rows[0].request_id);

    expect(await cancelPayout(db, r.payoutId, null)).toEqual({ status: "already" });
    expect(await requestPayout(db, c, NOW)).toMatchObject({ status: "requested", amountPaise: share });
  });

  test("a paid payout cannot be cancelled, and a missing one is refused", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const r = await requestPayout(db, c, NOW);
    if (r.status !== "requested") throw new Error("not requested");
    await markPayoutPaid(db, r.payoutId, { utr: "412345678901", nameMatched: true });
    expect(await cancelPayout(db, r.payoutId, null)).toEqual({ status: "refused", reason: "not_open" });
    expect(await cancelPayout(db, 424242, null)).toEqual({ status: "refused", reason: "missing" });
  });
});

test.describe("what the owner sees", () => {
  test("a request leaves the creator's available amount at once", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const before = await getCreatorBalances(db, NOW);
    if (!before.ok) throw new Error(before.error);
    expect(before.data.rows[0]).toMatchObject({ creatorId: c, payableNow: true });

    await requestPayout(db, c, NOW);
    const after = await getCreatorBalances(db, NOW);
    if (!after.ok) throw new Error(after.error);
    // Nothing left to ask for: the row shows a zero balance and is no longer ready.
    expect(after.data.rows[0]).toMatchObject({ creatorId: c, balanceMinor: 0, availableMinor: 0, payableNow: false });
  });
});

test.describe("the owner's list of requests", () => {
  test("shows what is waiting with the creator's totals, and moves to the recent list once paid", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const share = await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    const refunded = await tip(pg, c, { gross: 30000, capturedAt: daysAgo(3) });
    const r = await requestPayout(db, c, NOW);
    if (r.status !== "requested") throw new Error("not requested");
    expect(refunded).toBeGreaterThan(0);

    const open = await listOpenPayouts(db);
    if (!open.ok) throw new Error(open.error);
    expect(open.data.rows).toHaveLength(1);
    expect(open.data.rows[0]).toMatchObject({
      id: r.payoutId,
      creatorId: c,
      upiVpa: "a@upi",
      upiChanged: false,
      amountMinor: share + refunded,
      firstPayout: true,
    });
    const split = splitTip(100000, LEGACY_RATES);
    const split2 = splitTip(30000, LEGACY_RATES);
    expect(open.data.totals.get(c)).toEqual({
      tipCount: 2,
      grossMinor: 130000,
      freetipFeeMinor: split.platformFeePaise + split2.platformFeePaise,
      processingMinor: split.processingPaise + split2.processingPaise,
      creatorShareMinor: share + refunded,
      paidOutMinor: 0,
    });

    // A changed UPI ID is flagged, and the request still shows the one it was made for.
    await pg.query(`update users set upi_vpa = 'new@upi' where id = $1`, [c]);
    const changed = await listOpenPayouts(db);
    if (!changed.ok) throw new Error(changed.error);
    expect(changed.data.rows[0]).toMatchObject({ upiVpa: "a@upi", upiChanged: true });

    await markPayoutPaid(db, r.payoutId, { utr: "412345678901", nameMatched: true });
    const after = await listOpenPayouts(db);
    if (!after.ok) throw new Error(after.error);
    expect(after.data.rows).toEqual([]);
    const recent = await listRecentPayouts(db);
    if (!recent.ok) throw new Error(recent.error);
    expect(recent.data[0]).toMatchObject({ id: r.payoutId, status: "completed", utr: "412345678901" });
  });

  test("a refunded tip is netted out of the totals", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });
    // The second tip is refunded by Razorpay and so nets to nothing.
    seq += 1;
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
       values ($1, $2, 50000, 'captured', $3::timestamptz) returning id::text`,
      [c, `ptip_${seq}`, daysAgo(3).toISOString()],
    );
    const ref = `ppay_${seq}`;
    await pg.query(
      `insert into payment_attempts (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
         payment_method, amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
       values ($1, 'razorpay', $2, $3, 'captured', 'upi', 50000, $4, true, 50000, 'INR', $5::timestamptz)`,
      [t.rows[0].id, `porder_${seq}`, ref, `pkey_${seq}`, daysAgo(3).toISOString()],
    );
    await postCaptureAccrual(db, ref);
    expect((await postTipReversal(db, ref, 50000, "refund")).status).toBe("reversed");
    expect(await requestPayout(db, c, NOW)).toMatchObject({ status: "requested", amountPaise: splitTip(100000, LEGACY_RATES).creatorSharePaise });

    const open = await listOpenPayouts(db);
    if (!open.ok) throw new Error(open.error);
    expect(open.data.totals.get(c)).toMatchObject({ grossMinor: 100000, creatorShareMinor: splitTip(100000, LEGACY_RATES).creatorSharePaise });
  });
});

test.describe("the email to the owner", () => {
  test("names the amount and reference, links the page, and never carries the UPI ID", () => {
    const m = buildPayoutRequestEmail({
      creatorName: "Riya\nBcc: x@y.z",
      handle: "riya",
      payoutId: 12,
      amountPaise: 123456,
      firstPayout: true,
      adminUrl: "https://freetip.in/admin/payouts",
    });
    // The subject holds our own words and numbers only, so nothing a creator typed can reach a header.
    expect(m.subject).toBe("Payout request FT-12: ₹1,234.56");
    expect(m.subject).not.toContain("Riya");
    expect(m.text).toContain("(their first payout)");
    expect(m.text).toContain("https://freetip.in/admin/payouts");
    expect(m.text).not.toMatch(/@upi|vpa/i);
  });
});

test.describe("the owner's money pages with a payout in the books", () => {
  test("a request or a payment does not change what creators earned, and a request is still owed until paid", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const share = await tip(pg, c, { gross: 100000, capturedAt: daysAgo(3) });

    const read = async () => {
      const f = await getFinanceSummary(db, rangeAllTime());
      const e = await getCreatorEarnings(db, rangeAllTime());
      if (!f.ok) throw new Error(f.error);
      if (!e.ok) throw new Error(e.error);
      return { finance: f.data, creator: e.data.find((r) => r.creatorId === c) };
    };

    const before = await read();
    expect(before.finance).toMatchObject({ creatorShareMinor: share, owedToCreatorsMinor: share });
    expect(before.creator).toMatchObject({ creatorShareMinor: share, owedNowMinor: share });

    // Asked for: earned is unchanged and the money is still owed (it is not yet paid).
    const r = await requestPayout(db, c, NOW);
    if (r.status !== "requested") throw new Error("not requested");
    const asked = await read();
    expect(asked.finance).toMatchObject({ creatorShareMinor: share, owedToCreatorsMinor: share });
    expect(asked.creator).toMatchObject({ creatorShareMinor: share, owedNowMinor: share });

    // Paid: still earned, nothing owed any more.
    await markPayoutPaid(db, r.payoutId, { utr: "412345678901", nameMatched: true });
    const paid = await read();
    expect(paid.finance).toMatchObject({ creatorShareMinor: share, owedToCreatorsMinor: 0 });
    expect(paid.creator).toMatchObject({ creatorShareMinor: share, owedNowMinor: 0 });
  });
});
