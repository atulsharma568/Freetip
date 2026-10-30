import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { findMissedPayments } from "../src/lib/razorpay-sweep";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const LIVE = "rzp_live_abc";

async function attempt(pg: PGlite, n: number, paymentRef: string | null, status: string | null) {
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1,$2,$3) returning id::text`,
    [`g${n}`, `c${n}@example.com`, `creator${n}`],
  );
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,$2,10000,'payment_pending') returning id::text`,
    [u.rows[0].id, `tip_${n}`],
  );
  await pg.query(
    `insert into payment_attempts (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status, amount_minor, idempotency_key)
     values ($1,'razorpay',$2,$3,$4,10000,$5)`,
    [t.rows[0].id, `order_${n}`, paymentRef, status, `tip_${n}`],
  );
}

const payment = (id: string, order: string | null, status = "captured") => ({
  id,
  order_id: order,
  amount: 10000,
  status,
  method: "upi",
  created_at: 1_790_000_000,
});

const fakeFetch = (items: unknown[], calls: string[] = []) =>
  (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    calls.push(u.search);
    const skip = Number(u.searchParams.get("skip") ?? 0);
    const count = Number(u.searchParams.get("count") ?? 100);
    return new Response(JSON.stringify({ items: items.slice(skip, skip + count) }), { status: 200 });
  }) as typeof fetch;

test.describe("missed Razorpay payments", () => {
  test("only checks live mode and needs keys", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    expect(await findMissedPayments(db, { keyId: undefined, keySecret: undefined })).toEqual({ ok: false, reason: "no_keys" });
    expect(await findMissedPayments(db, { keyId: "rzp_test_x", keySecret: "s" })).toEqual({ ok: false, reason: "not_live_mode" });
  });

  test("finds a payment the site never saved and one it never marked captured", async () => {
    const pg = await freshDatabase();
    await attempt(pg, 1, "pay_ok", "captured");
    await attempt(pg, 2, null, null); // order saved, capture webhook missed
    const out = await findMissedPayments(asLedgerDb(pg), {
      keyId: LIVE,
      keySecret: "s",
      fetchImpl: fakeFetch([
        payment("pay_ok", "order_1"),
        payment("pay_missed", "order_2"),
        payment("pay_stranger", "order_unknown"),
        payment("pay_failed", "order_3", "failed"),
      ]),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.checked).toBe(3);
    expect(out.problems.map((p) => [p.paymentId, p.kind]).sort()).toEqual(
      [
        ["pay_missed", "not_marked_captured"],
        ["pay_stranger", "unknown_order"],
      ].sort(),
    );
  });

  test("a payment tied to an order but under a different payment id is flagged", async () => {
    const pg = await freshDatabase();
    await attempt(pg, 1, "pay_other", "captured");
    const out = await findMissedPayments(asLedgerDb(pg), {
      keyId: LIVE,
      keySecret: "s",
      fetchImpl: fakeFetch([payment("pay_new", "order_1")]),
    });
    expect(out.ok && out.problems.map((p) => p.kind)).toEqual(["not_marked_captured"]);
  });

  test("reads every page", async () => {
    const pg = await freshDatabase();
    const items = Array.from({ length: 130 }, (_, i) => payment(`pay_${i}`, `order_x${i}`));
    const calls: string[] = [];
    const out = await findMissedPayments(asLedgerDb(pg), { keyId: LIVE, keySecret: "s", fetchImpl: fakeFetch(items, calls) });
    expect(calls).toHaveLength(2);
    expect(out.ok && out.checked).toBe(130);
  });

  test("a Razorpay error is reported, not thrown", async () => {
    const pg = await freshDatabase();
    const bad = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    expect(await findMissedPayments(asLedgerDb(pg), { keyId: LIVE, keySecret: "s", fetchImpl: bad })).toEqual({
      ok: false,
      reason: "razorpay_error",
      detail: "HTTP 500",
    });
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await findMissedPayments(asLedgerDb(pg), { keyId: LIVE, keySecret: "s", fetchImpl: boom })).toEqual({
      ok: false,
      reason: "razorpay_error",
      detail: "offline",
    });
  });
});
