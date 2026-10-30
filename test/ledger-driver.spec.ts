import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual, postMissingAccruals, type LedgerDb } from "../src/lib/accrual";
import { afterCapture } from "../src/lib/capture-follow-up";
import { freshDatabase } from "./helpers/pg";

// The same money code, but through the REAL postgres.js driver (the one production
// uses, configured the same way: a small pool and `prepare: false`) talking the
// Postgres wire protocol to the in-memory database. This is what the in-process
// tests cannot show: how postgres.js types and serialises parameters, how it
// returns bigint, and that a failure at commit leaves the connection usable. It
// still cannot show real lock waits, concurrent transactions (PGlite runs one at a
// time and drops interleaved ones) or the Neon pooler: the same payment posted at
// the same instant by the webhook and the sweep is covered by the unique key plus
// `on conflict do nothing`, and has to be exercised on a real database.

async function withDriver(run: (sql: postgres.Sql, pg: PGlite) => Promise<void>) {
  const pg = await freshDatabase();
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: "127.0.0.1" });
  await server.start();
  const [host, port] = server.getServerConn().split(":");
  const sql = postgres({
    host,
    port: Number(port),
    database: "postgres",
    username: "postgres",
    password: "postgres",
    ssl: false,
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  try {
    await run(sql, pg);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
    await server.stop().catch(() => {});
    await pg.close().catch(() => {});
  }
}

let seq = 0;
async function liveTip(pg: PGlite, gross = 10000) {
  seq += 1;
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1,$2,$3) returning id::text`,
    [`dg${seq}`, `d${seq}@example.com`, `driver${seq}`],
  );
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1,$2,$3,'captured', now()) returning id::text`,
    [u.rows[0].id, `dtip_${seq}`, gross],
  );
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1,'razorpay',$2,$3,'captured',$4,$5,true,$4,'INR', now())`,
    [t.rows[0].id, `dorder_${seq}`, `dpay_${seq}`, gross, `dtip_${seq}`],
  );
  return `dpay_${seq}`;
}

const db = (sql: postgres.Sql) => sql as unknown as LedgerDb;

test.describe("through the real postgres.js driver", () => {
  test("posts a captured tip, with null and typed parameters", async () => {
    await withDriver(async (sql, pg) => {
      const ref = await liveTip(pg);
      expect(await postCaptureAccrual(db(sql), ref)).toEqual({ status: "posted" });
      const r = await pg.query<{ code: string; credit: string }>(
        `select a.code, sum(e.credit_minor)::text as credit
           from ledger_entries e join ledger_accounts a on a.id = e.account_id
          group by a.code order by a.code`,
      );
      expect(Object.fromEntries(r.rows.map((x) => [x.code, x.credit]))).toEqual({
        creator_payable: "9250",
        gateway_fee_expense: "250",
        platform_fee_revenue: "500",
        processor_clearing: "0",
      });
    });
  });

  test("the event log stores a JSON object, not a quoted string", async () => {
    await withDriver(async (sql, pg) => {
      const ref = await liveTip(pg);
      await afterCapture(
        db(sql),
        { id: ref, order_id: "order_x", amount: 10000, currency: "INR", method: "upi", fee: 236, tax: 36 },
        "evt_driver",
      );
      const r = await pg.query<{ kind: string; payment_id: string; status: string }>(
        `select jsonb_typeof(payload) as kind, payload->>'payment_id' as payment_id, processing_status as status
           from provider_events`,
      );
      expect(r.rows).toEqual([{ kind: "object", payment_id: ref, status: "processed" }]);
    });
  });

  test("a failure at commit rolls back everything and the connection keeps working", async () => {
    await withDriver(async (sql, pg) => {
      const ref = await liveTip(pg);
      await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue_x' where code = 'platform_fee_revenue'`);
      await expect(postCaptureAccrual(db(sql), ref)).rejects.toThrow(/does not balance/);
      const n = await pg.query<{ n: string }>(`select count(*)::text as n from ledger_transactions`);
      expect(n.rows[0].n).toBe("0");
      // The pool is still healthy and the same payment posts once the account is back.
      await pg.exec(`update ledger_accounts set code = 'platform_fee_revenue' where code = 'platform_fee_revenue_x'`);
      expect(await postCaptureAccrual(db(sql), ref)).toEqual({ status: "posted" });
    });
  });

  test("the sweep posts several tips through the pool", async () => {
    await withDriver(async (sql, pg) => {
      for (let i = 0; i < 5; i += 1) await liveTip(pg, 10000 + i * 100);
      expect(await postMissingAccruals(db(sql))).toMatchObject({ looked: 5, posted: 5, failed: 0 });
    });
  });

  test("driver facts the code relies on", async () => {
    await withDriver(async (sql) => {
      // bigint comes back as a string.
      const [a] = await sql<{ n: unknown }[]>`select 5::bigint as n`;
      expect(typeof a.n).toBe("string");
      // A missing column is reported with Postgres's undefined_column code, which
      // is how createTipOrder decides to retry without the live-mode flag.
      const err = await sql`select no_such_column from users`.then(
        () => null,
        (e: { code?: string }) => e,
      );
      expect(err?.code).toBe("42703");
      // A JSON string bound to a jsonb parameter is encoded a second time and
      // stored as a quoted string; an object is stored as an object. This is why the
      // event log is written from an object.
      const [str] = await sql<{ t: string }[]>`select jsonb_typeof(${'{"a":1}'}::jsonb) as t`;
      const [obj] = await sql<{ t: string }[]>`select jsonb_typeof(${{ a: 1 } as never}::jsonb) as t`;
      expect([str.t, obj.t]).toEqual(["string", "object"]);
    });
  });
});
