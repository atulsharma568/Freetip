import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual } from "../src/lib/accrual";
import { afterCapture } from "../src/lib/capture-follow-up";
import { syncBooks } from "../src/lib/books-sync";
import { applyBackfill, findMissedPayments } from "../src/lib/razorpay-sweep";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const LIVE = "rzp_live_abc";
let seq = 0;

interface Seed {
  gross?: number;
  livemode?: boolean | null;
  capturedAmount?: number | null;
  capturedCurrency?: string | null;
  providerStatus?: string;
  paymentRef?: string | null;
  tipId?: number;
  creatorId?: number;
}

// A tip the webhook has captured, with the live-mode flag and captured facts as
// the test chooses (null = the site failed to save them).
async function seed(pg: PGlite, o: Seed = {}) {
  seq += 1;
  const gross = o.gross ?? 10000;
  let creatorId = o.creatorId;
  if (creatorId === undefined) {
    const u = await pg.query<{ id: string }>(
      `insert into users (google_id, email, handle) values ($1,$2,$3) returning id::text`,
      [`bg${seq}`, `b${seq}@example.com`, `books${seq}`],
    );
    creatorId = Number(u.rows[0].id);
  }
  let tipId = o.tipId;
  if (tipId === undefined) {
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
       values ($1,$2,$3,'captured', now()) returning id::text`,
      [creatorId, `btip_${seq}`, gross],
    );
    tipId = Number(t.rows[0].id);
  }
  const paymentRef = o.paymentRef === undefined ? `bpay_${seq}` : o.paymentRef;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1,'razorpay',$2,$3,$4,$5,$6,$7,$8,$9, now())`,
    [
      tipId,
      `border_${seq}`,
      paymentRef,
      o.providerStatus ?? "captured",
      gross,
      `btip_${seq}_${Math.random()}`,
      "livemode" in o ? o.livemode : true,
      "capturedAmount" in o ? o.capturedAmount : gross,
      "capturedCurrency" in o ? o.capturedCurrency : "INR",
    ],
  );
  return { tipId, creatorId, paymentRef: paymentRef as string, orderRef: `border_${seq}`, gross };
}

const count = async (pg: PGlite, table: string) =>
  Number((await pg.query<{ n: string }>(`select count(*)::text as n from ${table}`)).rows[0].n);

const razorpayPayment = (id: string, order: string, over: Record<string, unknown> = {}) => ({
  id,
  order_id: order,
  amount: 10000,
  currency: "INR",
  status: "captured",
  method: "upi",
  fee: 236,
  tax: 36,
  created_at: 1_790_000_000,
  ...over,
});

const fakeFetch = (items: unknown[]) =>
  (async () => new Response(JSON.stringify({ items }), { status: 200 })) as unknown as typeof fetch;

test.describe("one capture per tip", () => {
  test("a second payment id for the same tip cannot be posted", async () => {
    const pg = await freshDatabase();
    const a = await seed(pg);
    const b = await seed(pg, { tipId: a.tipId, creatorId: a.creatorId, paymentRef: "bpay_second" });
    const db = asLedgerDb(pg);
    expect(await postCaptureAccrual(db, a.paymentRef)).toEqual({ status: "posted" });
    await expect(postCaptureAccrual(db, b.paymentRef)).rejects.toThrow(/duplicate key|unique/i);
    expect(await count(pg, "ledger_transactions")).toBe(1);
    expect(await count(pg, "fee_lines")).toBe(2);
  });
});

test.describe("the event log", () => {
  const event = (ref: string) => ({ id: ref, order_id: "order_x", amount: 10000, currency: "INR", method: "upi", fee: 236, tax: 36 });

  test("records an outcome only when it is final", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);

    const live = await seed(pg);
    await afterCapture(db, event(live.paymentRef), "evt_live");
    const test = await seed(pg, { livemode: false });
    await afterCapture(db, event(test.paymentRef), "evt_test");
    // Razorpay's captured amount disagrees with the order: not final, so not logged.
    const bad = await seed(pg, { capturedAmount: 9900 });
    const realError = console.error;
    console.error = () => {};
    try {
      await afterCapture(db, event(bad.paymentRef), "evt_bad");
    } finally {
      console.error = realError;
    }

    const rows = await pg.query<{ event_id: string; processing_status: string; kind: string }>(
      `select event_id, processing_status, jsonb_typeof(payload) as kind from provider_events order by event_id`,
    );
    expect(rows.rows).toEqual([
      { event_id: "evt_live", processing_status: "processed", kind: "object" },
      { event_id: "evt_test", processing_status: "ignored", kind: "object" },
    ]);
  });

  test("a string bound to jsonb is refused by the test database", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await expect(db`select ${'{"a":1}'}::jsonb as j`).rejects.toThrow(/double-encode/);
  });
});

test.describe("backfill from Razorpay", () => {
  test("a live payment the site did not finish saving is found and filled in", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const t = await seed(pg, { livemode: null, capturedAmount: null, capturedCurrency: null });

    const out = await findMissedPayments(db, {
      keyId: LIVE,
      keySecret: "s",
      fetchImpl: fakeFetch([razorpayPayment(t.paymentRef, t.orderRef)]),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.problems).toEqual([]);
    expect(out.backfill).toEqual([
      { paymentId: t.paymentRef, amountPaise: 10000, currency: "INR", feePaise: 236, taxPaise: 36 },
    ]);

    expect(await applyBackfill(db, out.backfill)).toBe(1);
    const row = await pg.query<{ livemode: boolean; a: string; c: string; f: string }>(
      `select livemode, captured_amount_minor::text a, captured_currency c, provider_fee_minor::text f
         from payment_attempts where provider_payment_ref = $1`,
      [t.paymentRef],
    );
    expect(row.rows[0]).toEqual({ livemode: true, a: "10000", c: "INR", f: "236" });
    // Nothing left to fill, so a second run changes nothing.
    expect(await applyBackfill(db, out.backfill)).toBe(0);
  });

  test("never overwrites a value the site already saved", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const t = await seed(pg, { livemode: null, capturedAmount: 10000, capturedCurrency: "INR" });
    await applyBackfill(db, [
      { paymentId: t.paymentRef, amountPaise: 99999, currency: "USD", feePaise: null, taxPaise: null },
    ]);
    const row = await pg.query<{ a: string; c: string; livemode: boolean }>(
      `select captured_amount_minor::text a, captured_currency c, livemode from payment_attempts where provider_payment_ref = $1`,
      [t.paymentRef],
    );
    expect(row.rows[0]).toEqual({ a: "10000", c: "INR", livemode: true });
  });

  test("does not touch an attempt that is not captured under that payment id", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const notCaptured = await seed(pg, { livemode: null, providerStatus: "failed" });
    expect(
      await applyBackfill(db, [
        { paymentId: notCaptured.paymentRef, amountPaise: 10000, currency: "INR", feePaise: null, taxPaise: null },
      ]),
    ).toBe(0);
    expect(await applyBackfill(db, [{ paymentId: "pay_unknown", amountPaise: 1, currency: "INR", feePaise: null, taxPaise: null }])).toBe(0);
  });

  test("a payment under a different id for a known order is flagged, not backfilled", async () => {
    const pg = await freshDatabase();
    const t = await seed(pg, { livemode: null, capturedAmount: null });
    const out = await findMissedPayments(asLedgerDb(pg), {
      keyId: LIVE,
      keySecret: "s",
      fetchImpl: fakeFetch([razorpayPayment("pay_other", t.orderRef)]),
    });
    expect(out.ok && out.backfill).toEqual([]);
    expect(out.ok && out.problems.map((p) => p.kind)).toEqual(["not_marked_captured"]);
  });
});

test.describe("sync: check, backfill, then post", () => {
  test("a live tip that lost its flag and amount ends up on the books", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const t = await seed(pg, { livemode: null, capturedAmount: null, capturedCurrency: null });
    // Not postable before the sync: it looks like test money.
    expect(await postCaptureAccrual(db, t.paymentRef)).toEqual({ status: "skipped", reason: "test_mode" });

    const r = await syncBooks(db, { keyId: LIVE, keySecret: "s" }, fakeFetch([razorpayPayment(t.paymentRef, t.orderRef)]));
    expect(r.backfilled).toBe(1);
    expect(r.sweep).toMatchObject({ looked: 1, posted: 1, failed: 0 });
    const share = await pg.query<{ share: string }>(
      `select sum(e.credit_minor - e.debit_minor)::text as share
         from ledger_entries e join ledger_accounts a on a.id = e.account_id where a.code = 'creator_payable'`,
    );
    expect(share.rows[0].share).toBe("9250");
  });

  test("without live keys it still posts what can be posted", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await seed(pg);
    const r = await syncBooks(db, { keyId: "rzp_test_x", keySecret: "s" });
    expect(r.check).toEqual({ ok: false, reason: "not_live_mode" });
    expect(r.backfilled).toBe(0);
    expect(r.sweep).toMatchObject({ looked: 1, posted: 1 });
  });

  test("a Razorpay failure does not stop the posting", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await seed(pg);
    const down = (async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    const r = await syncBooks(db, { keyId: LIVE, keySecret: "s" }, down);
    expect(r.check).toEqual({ ok: false, reason: "razorpay_error", detail: "HTTP 503" });
    expect(r.sweep).toMatchObject({ posted: 1 });
  });
});
