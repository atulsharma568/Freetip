import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { findUnpostableCaptures, postCaptureAccrual, postMissingAccruals } from "../src/lib/accrual";
import { postTipReversal } from "../src/lib/reversal";
import { afterCapture } from "../src/lib/capture-follow-up";
import { LEGACY_RATES, splitTip } from "../src/lib/money";
import { asLedgerDb, freshDatabase, migrationFiles, readMigration } from "./helpers/pg";

// Runs the real schema and the real money code in an in-memory Postgres. It
// proves the posting rules, idempotency and the database's own guards; it cannot
// prove lock behaviour under real concurrency (one connection, no pooler).

let seq = 0;

async function creator(pg: PGlite): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1, $2, $3) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `creator${seq}`],
  );
  return Number(r.rows[0].id);
}

interface TipOptions {
  gross?: number;
  creatorId?: number;
  livemode?: boolean | null;
  tipStatus?: string;
  providerStatus?: string;
  attemptAmount?: number;
  capturedAmount?: number | null;
  capturedCurrency?: string | null;
}

async function tip(pg: PGlite, o: TipOptions = {}) {
  seq += 1;
  const gross = o.gross ?? 10000;
  const creatorId = o.creatorId ?? (await creator(pg));
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, $4, now()) returning id::text`,
    [creatorId, `tip_${seq}`, gross, o.tipStatus ?? "captured"],
  );
  const paymentRef = `pay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, $4, $5, $6, $7, $8, $9, now())`,
    [
      t.rows[0].id,
      `order_${seq}`,
      paymentRef,
      o.providerStatus ?? "captured",
      o.attemptAmount ?? gross,
      `tip_${seq}`,
      "livemode" in o ? o.livemode : true,
      "capturedAmount" in o ? o.capturedAmount : gross,
      "capturedCurrency" in o ? o.capturedCurrency : "INR",
    ],
  );
  return { tipId: Number(t.rows[0].id), paymentRef, creatorId, gross };
}

const count = async (pg: PGlite, table: string) =>
  Number((await pg.query<{ n: string }>(`select count(*)::text as n from ${table}`)).rows[0].n);

async function balances(pg: PGlite) {
  const r = await pg.query<{ code: string; debit: string; credit: string }>(
    `select a.code, coalesce(sum(e.debit_minor),0)::text as debit, coalesce(sum(e.credit_minor),0)::text as credit
       from ledger_accounts a left join ledger_entries e on e.account_id = a.id
      group by a.code`,
  );
  return Object.fromEntries(r.rows.map((x) => [x.code, { debit: Number(x.debit), credit: Number(x.credit) }]));
}

async function everyTransactionBalances(pg: PGlite) {
  const r = await pg.query<{ bad: string }>(
    `select count(*)::text as bad from (
       select ledger_transaction_id from ledger_entries
        group by ledger_transaction_id, currency
       having sum(debit_minor) <> sum(credit_minor)) x`,
  );
  return Number(r.rows[0].bad) === 0;
}

test.describe("migrations", () => {
  test("every migration can be run a second time", async () => {
    const pg = await freshDatabase();
    for (const file of migrationFiles()) {
      await pg.exec(readMigration(file));
    }
    expect(await count(pg, "ledger_accounts")).toBeGreaterThan(0);
  });
});

test.describe("posting a captured tip", () => {
  test("a ₹100 live tip posts a balanced transaction and two fee lines", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    const res = await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    expect(res).toEqual({ status: "posted" });

    const b = await balances(pg);
    expect(b.processor_clearing).toEqual({ debit: 10000, credit: 0 });
    expect(b.creator_payable).toEqual({ debit: 0, credit: 9225 });
    expect(b.platform_fee_revenue).toEqual({ debit: 0, credit: 500 });
    expect(b.gateway_fee_expense).toEqual({ debit: 0, credit: 275 });
    expect(await everyTransactionBalances(pg)).toBe(true);

    const entry = await pg.query<{ creator_id: string }>(
      `select e.creator_id::text from ledger_entries e join ledger_accounts a on a.id = e.account_id
        where a.code = 'creator_payable'`,
    );
    expect(Number(entry.rows[0].creator_id)).toBe(t.creatorId);

    const tx = await pg.query<{ source_type: string; source_ref: string; idempotency_key: string }>(
      `select source_type, source_ref, idempotency_key from ledger_transactions`,
    );
    expect(tx.rows).toEqual([
      { source_type: "tip_order", source_ref: String(t.tipId), idempotency_key: `capture:${t.paymentRef}` },
    ]);

    const fees = await pg.query<{ fee_type: string; amount_minor: string; source: string; rule_version: string }>(
      `select fee_type, amount_minor::text, source, rule_version from fee_lines order by fee_type`,
    );
    expect(fees.rows).toEqual([
      { fee_type: "gateway_fee", amount_minor: "275", source: "accrual", rule_version: "2026-11-03.1" },
      { fee_type: "platform_fee", amount_minor: "500", source: "accrual", rule_version: "2026-11-03.1" },
    ]);
  });

  test("posting twice, or at the same moment, posts once", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    const db = asLedgerDb(pg);
    expect(await postCaptureAccrual(db, t.paymentRef)).toEqual({ status: "posted" });
    expect(await postCaptureAccrual(db, t.paymentRef)).toEqual({ status: "already" });
    expect(await count(pg, "ledger_transactions")).toBe(1);
    expect(await count(pg, "ledger_entries")).toBe(4);
    expect(await count(pg, "fee_lines")).toBe(2);

    const t2 = await tip(pg);
    const both = await Promise.all([postCaptureAccrual(db, t2.paymentRef), postCaptureAccrual(db, t2.paymentRef)]);
    expect(both.map((r) => r.status).sort()).toEqual(["already", "posted"]);
    expect(await count(pg, "ledger_transactions")).toBe(2);
  });

  const refusals: [string, TipOptions, string][] = [
    ["test-mode money", { livemode: false }, "test_mode"],
    ["a payment made before the mode was recorded", { livemode: null }, "test_mode"],
    ["a tip that was refunded before posting", { tipStatus: "refunded" }, "not_captured"],
    ["a tip that was disputed before posting", { tipStatus: "disputed" }, "not_captured"],
    ["a payment that is not captured", { providerStatus: "failed" }, "not_captured"],
    ["a payment with no captured amount saved", { capturedAmount: null }, "no_captured_facts"],
    ["a payment with no currency saved", { capturedCurrency: null }, "no_captured_facts"],
    ["Razorpay capturing less than the order", { capturedAmount: 9900 }, "amount_mismatch"],
    ["Razorpay capturing more than the order", { capturedAmount: 10100 }, "amount_mismatch"],
    ["an attempt whose amount differs from the tip", { attemptAmount: 9000 }, "amount_mismatch"],
    ["a payment in another currency", { capturedCurrency: "USD" }, "amount_mismatch"],
  ];
  for (const [name, options, reason] of refusals) {
    test(`refuses ${name}`, async () => {
      const pg = await freshDatabase();
      const t = await tip(pg, options);
      expect(await postCaptureAccrual(asLedgerDb(pg), t.paymentRef)).toEqual({ status: "skipped", reason });
      expect(await count(pg, "ledger_transactions")).toBe(0);
      expect(await count(pg, "ledger_entries")).toBe(0);
      expect(await count(pg, "fee_lines")).toBe(0);
    });
  }

  test("an unknown payment id posts nothing", async () => {
    const pg = await freshDatabase();
    expect(await postCaptureAccrual(asLedgerDb(pg), "pay_nope")).toEqual({
      status: "skipped",
      reason: "no_such_payment",
    });
  });

  test("the ledger share equals the published split for awkward amounts", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const amounts = [100, 101, 149, 150, 199, 250, 999, 1250, 4999, 5001, 200000, 200001, 12345678];
    for (const gross of amounts) {
      const t = await tip(pg, { gross });
      expect(await postCaptureAccrual(db, t.paymentRef)).toEqual({ status: "posted" });
      const share = await pg.query<{ share: string }>(
        `select coalesce(sum(e.credit_minor - e.debit_minor),0)::text as share
           from ledger_entries e join ledger_accounts a on a.id = e.account_id
           join ledger_transactions lt on lt.id = e.ledger_transaction_id
          where a.code = 'creator_payable' and lt.source_ref = $1`,
        [String(t.tipId)],
      );
      // The fixture saves no pair on the order, so it carries the column default, the legacy
      // 5% + 2.75%; the ledger reads the pair saved on the order, not today's standard.
      expect(Number(share.rows[0].share)).toBe(splitTip(gross, LEGACY_RATES).creatorSharePaise);
      // The dashboard's SQL rounding gives the same figure.
      const sql = await pg.query<{ share: string }>(
        `select ($1::bigint - (($1::bigint * 500 + 5000) / 10000) - (($1::bigint * 275 + 5000) / 10000))::text as share`,
        [gross],
      );
      expect(Number(sql.rows[0].share)).toBe(splitTip(gross, LEGACY_RATES).creatorSharePaise);
    }
    expect(await everyTransactionBalances(pg)).toBe(true);
  });

  test("a tip too small for any fee still posts, with no zero lines", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg, { gross: 1 });
    expect(await postCaptureAccrual(asLedgerDb(pg), t.paymentRef)).toEqual({ status: "posted" });
    expect(await count(pg, "ledger_entries")).toBe(2);
    expect(await count(pg, "fee_lines")).toBe(0);
  });
});

test.describe("the ledger's own guards", () => {
  async function header(pg: PGlite, key: string) {
    const r = await pg.query<{ id: string }>(
      `insert into ledger_transactions (event_type, source_type, source_ref, currency, effective_at, idempotency_key)
       values ('test', 'test', 't', 'INR', now(), $1) returning id::text`,
      [key],
    );
    return r.rows[0].id;
  }
  const account = async (pg: PGlite, code: string) =>
    (await pg.query<{ id: string }>(`select id::text from ledger_accounts where code = $1`, [code])).rows[0].id;

  test("an unbalanced transaction is refused at commit and nothing is kept", async () => {
    const pg = await freshDatabase();
    const clearing = await account(pg, "processor_clearing");
    const fees = await account(pg, "platform_fee_revenue");
    await expect(
      pg.transaction(async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into ledger_transactions (event_type, source_type, source_ref, currency, effective_at, idempotency_key)
             values ('test','test','t','INR', now(), 'k1') returning id::text`,
          )
        ).rows[0].id;
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, debit_minor) values ($1,$2,100)`, [id, clearing]);
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, credit_minor) values ($1,$2,99)`, [id, fees]);
      }),
    ).rejects.toThrow(/does not balance/);
    expect(await count(pg, "ledger_transactions")).toBe(0);
    expect(await count(pg, "ledger_entries")).toBe(0);
  });

  test("a transaction must balance in each currency", async () => {
    const pg = await freshDatabase();
    const clearing = await account(pg, "processor_clearing");
    const fees = await account(pg, "platform_fee_revenue");
    await expect(
      pg.transaction(async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into ledger_transactions (event_type, source_type, source_ref, currency, effective_at, idempotency_key)
             values ('test','test','t','INR', now(), 'k2') returning id::text`,
          )
        ).rows[0].id;
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, debit_minor, currency) values ($1,$2,100,'INR')`, [id, clearing]);
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, credit_minor, currency) values ($1,$2,100,'USD')`, [id, fees]);
      }),
    ).rejects.toThrow(/does not balance/);
  });

  test("a transaction with no entries is refused at commit", async () => {
    const pg = await freshDatabase();
    await expect(header(pg, "empty")).rejects.toThrow(/has no entries/);
    expect(await count(pg, "ledger_transactions")).toBe(0);
  });

  test("an entry on creator_payable must name the creator", async () => {
    const pg = await freshDatabase();
    const payable = await account(pg, "creator_payable");
    const clearing = await account(pg, "processor_clearing");
    await expect(
      pg.transaction(async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into ledger_transactions (event_type, source_type, source_ref, currency, effective_at, idempotency_key)
             values ('test','test','t','INR', now(), 'k3') returning id::text`,
          )
        ).rows[0].id;
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, debit_minor) values ($1,$2,100)`, [id, clearing]);
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, credit_minor) values ($1,$2,100)`, [id, payable]);
      }),
    ).rejects.toThrow(/must name the creator/);
  });

  test("posted history cannot be changed or removed", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    await expect(pg.query(`update ledger_entries set credit_minor = credit_minor + 1`)).rejects.toThrow(/append-only/);
    await expect(pg.query(`delete from ledger_entries`)).rejects.toThrow(/append-only/);
    await expect(pg.query(`delete from ledger_transactions`)).rejects.toThrow(/append-only/);
  });

  test("a posting can be reversed only once", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    const original = (await pg.query<{ id: string }>(`select id::text from ledger_transactions`)).rows[0].id;
    const clearing = await account(pg, "processor_clearing");
    const fees = await account(pg, "platform_fee_revenue");
    const reverse = (key: string) =>
      pg.transaction(async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into ledger_transactions (event_type, source_type, source_ref, currency, effective_at, idempotency_key, reversal_of)
             values ('test','test','t','INR', now(), $1, $2) returning id::text`,
            [key, original],
          )
        ).rows[0].id;
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, credit_minor) values ($1,$2,5)`, [id, clearing]);
        await tx.query(`insert into ledger_entries (ledger_transaction_id, account_id, debit_minor) values ($1,$2,5)`, [id, fees]);
      });
    await reverse("rev1");
    await expect(reverse("rev2")).rejects.toThrow(/duplicate key|unique/i);
  });

  test("a fee line cannot be posted twice for the same tip, type and rule", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    const dup = () =>
      pg.query(
        `insert into fee_lines (tip_order_id, creator_id, fee_type, amount_minor, rule_version, effective_at, source)
         select tip_order_id, creator_id, fee_type, amount_minor, rule_version, now(), 'accrual' from fee_lines limit 1`,
      );
    await expect(dup()).rejects.toThrow(/duplicate key|unique/i);
  });
});

test.describe("the sweep", () => {
  test("posts what was missed, leaves the rest, and can run again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await tip(pg);
    const b = await tip(pg, { gross: 25000 });
    const c = await tip(pg, { gross: 100 });
    await tip(pg, { livemode: false });
    const posted = await tip(pg);
    await postCaptureAccrual(db, posted.paymentRef);
    const bad = await tip(pg, { capturedAmount: 1 });
    const nofacts = await tip(pg, { capturedAmount: null, capturedCurrency: null });

    const first = await postMissingAccruals(db);
    expect(first).toMatchObject({ looked: 3, posted: 3, already: 0, failed: 0 });
    expect(await count(pg, "ledger_transactions")).toBe(4);
    const second = await postMissingAccruals(db);
    expect(second).toMatchObject({ looked: 0, posted: 0 });

    const unpostable = await findUnpostableCaptures(db);
    expect(unpostable.map((u) => [u.paymentRef, u.reason]).sort()).toEqual(
      [
        [bad.paymentRef, "amount_mismatch"],
        [nofacts.paymentRef, "no_captured_facts"],
      ].sort(),
    );
    expect([a, b, c].every((t) => t.paymentRef)).toBe(true);
    expect(await everyTransactionBalances(pg)).toBe(true);
  });

  test("a failed posting leaves nothing half-written and the next sweep heals it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await tip(pg);
    await tip(pg);
    // Break one account so every posting fails at commit.
    await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue_x' where code = 'platform_fee_revenue'`);
    const realError = console.error;
    console.error = () => {};
    let broken;
    try {
      broken = await postMissingAccruals(db);
    } finally {
      console.error = realError;
    }
    expect(broken).toMatchObject({ looked: 2, posted: 0, failed: 2 });
    expect(await count(pg, "ledger_transactions")).toBe(0);
    expect(await count(pg, "ledger_entries")).toBe(0);
    expect(await count(pg, "fee_lines")).toBe(0);

    await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue' where code = 'platform_fee_revenue_x'`);
    expect(await postMissingAccruals(db)).toMatchObject({ looked: 2, posted: 2, failed: 0 });
    expect(await everyTransactionBalances(pg)).toBe(true);
  });
});

test.describe("after a capture", () => {
  const payment = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    order_id: "order_x",
    amount: 10000,
    currency: "INR",
    method: "upi",
    fee: 236,
    tax: 36,
    ...over,
  });

  test("saves Razorpay's captured facts, posts the share and logs a minimal event", async () => {
    const pg = await freshDatabase();
    // The webhook has captured the tip; the new columns are still empty.
    const t = await tip(pg, { capturedAmount: null, capturedCurrency: null });
    await afterCapture(asLedgerDb(pg), payment(t.paymentRef), "evt_1");

    const facts = await pg.query<{ a: string; c: string; f: string; x: string }>(
      `select captured_amount_minor::text a, captured_currency c, provider_fee_minor::text f, provider_tax_minor::text x
         from payment_attempts where provider_payment_ref = $1`,
      [t.paymentRef],
    );
    expect(facts.rows[0]).toEqual({ a: "10000", c: "INR", f: "236", x: "36" });
    expect((await balances(pg)).creator_payable.credit).toBe(9225);

    const ev = await pg.query<{ event_id: string; payload: Record<string, unknown>; processing_status: string }>(
      `select event_id, payload, processing_status from provider_events`,
    );
    expect(ev.rows).toHaveLength(1);
    expect(ev.rows[0].event_id).toBe("evt_1");
    expect(ev.rows[0].processing_status).toBe("processed");
    // Nothing that identifies the payer is kept.
    expect(Object.keys(ev.rows[0].payload).sort()).toEqual(
      ["amount", "currency", "fee", "method", "order_id", "payment_id", "tax"].sort(),
    );
  });

  test("a repeated delivery changes nothing and a missing event id is fine", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg, { capturedAmount: null, capturedCurrency: null });
    const db = asLedgerDb(pg);
    await afterCapture(db, payment(t.paymentRef), "evt_2");
    await afterCapture(db, payment(t.paymentRef), "evt_2");
    await afterCapture(db, payment(t.paymentRef), null);
    expect(await count(pg, "ledger_transactions")).toBe(1);
    expect(await count(pg, "provider_events")).toBe(1);
  });

  test("a repeated delivery posts a share whose first posting failed", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue_x' where code = 'platform_fee_revenue'`);
    const realError = console.error;
    console.error = () => {};
    try {
      await afterCapture(asLedgerDb(pg), payment(t.paymentRef), "evt_3");
    } finally {
      console.error = realError;
    }
    expect(await count(pg, "ledger_transactions")).toBe(0);
    await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue' where code = 'platform_fee_revenue_x'`);
    await afterCapture(asLedgerDb(pg), payment(t.paymentRef), "evt_3");
    expect(await count(pg, "ledger_transactions")).toBe(1);
  });

  test("never throws, even when the database has not had the migration", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    const real = asLedgerDb(pg);
    // Pretend migration 0023's columns and the ledger do not exist yet.
    const broken = Object.assign(
      (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.join("?");
        if (/captured_amount_minor|ledger_|provider_events|livemode/.test(text)) {
          throw new Error('column "captured_amount_minor" does not exist');
        }
        return real(strings, ...values);
      }) as typeof real,
      { begin: ((fn: never) => real.begin(fn)) as typeof real.begin },
    );
    broken.begin = (async (fn) =>
      real.begin((tx) =>
        fn(
          (async (strings: TemplateStringsArray, ...values: unknown[]) => {
            if (/captured_amount_minor|ledger_|provider_events|livemode/.test(strings.join("?"))) {
              throw new Error("relation does not exist");
            }
            return tx(strings, ...values);
          }) as typeof tx,
        ),
      )) as typeof real.begin;

    const realError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      await expect(afterCapture(broken, payment(t.paymentRef), "evt_4")).resolves.toBeUndefined();
    } finally {
      console.error = realError;
    }
    expect(logged.length).toBeGreaterThan(0);
    // The tip itself is untouched.
    const status = await pg.query<{ status: string }>(`select status from tip_orders`);
    expect(status.rows[0].status).toBe("captured");
    expect(await count(pg, "ledger_transactions")).toBe(0);
  });
});

test.describe("a payment Razorpay takes back (record only)", () => {
  test("a lost chargeback reverses the capture and marks the tip disputed", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    const res = await postTipReversal(asLedgerDb(pg), t.paymentRef, t.gross, "dispute_lost");
    expect(res).toEqual({ status: "reversed" });

    const b = await balances(pg);
    expect(b.creator_payable).toEqual({ debit: 9225, credit: 9225 });
    expect(b.processor_clearing).toEqual({ debit: 10000, credit: 10000 });
    expect(await everyTransactionBalances(pg)).toBe(true);
    const s = await pg.query<{ status: string }>(`select status from tip_orders where id = $1`, [t.tipId]);
    expect(s.rows[0].status).toBe("disputed");
  });

  test("a repeated event posts once, a refund marks refunded", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    expect((await postTipReversal(asLedgerDb(pg), t.paymentRef, t.gross, "refund")).status).toBe("reversed");
    expect((await postTipReversal(asLedgerDb(pg), t.paymentRef, t.gross, "refund")).status).toBe("already");
    expect(await count(pg, "ledger_transactions")).toBe(2);
    const s = await pg.query<{ status: string }>(`select status from tip_orders where id = $1`, [t.tipId]);
    expect(s.rows[0].status).toBe("refunded");
  });

  test("a partial amount or an unposted tip is left alone", async () => {
    const pg = await freshDatabase();
    const t = await tip(pg);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    expect(await postTipReversal(asLedgerDb(pg), t.paymentRef, 5000, "refund")).toEqual({
      status: "skipped",
      reason: "partial_amount",
    });
    const test = await tip(pg, { livemode: false });
    expect(await postTipReversal(asLedgerDb(pg), test.paymentRef, test.gross, "refund")).toEqual({
      status: "skipped",
      reason: "no_capture_posting",
    });
    expect(await count(pg, "ledger_transactions")).toBe(1);
  });
});
