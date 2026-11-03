import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { postCaptureAccrual } from "../src/lib/accrual";
import { BULK_MAX, saveCreatorRates, saveSiteRates } from "../src/lib/fee-admin";
import {
  describeRates,
  estimateNote,
  formatPercent,
  getCreatorRates,
  getSiteRates,
  keepOfHundred,
  parsePercent,
  parseRates,
} from "../src/lib/fee-rates";
import {
  MAX_PLATFORM_BPS,
  MAX_PROCESSING_BPS,
  STANDARD_RATES,
  capturePosting,
  feeLines,
  splitTip,
} from "../src/lib/money";
import { estimateShare } from "../src/lib/earnings";
import { tipExtraColumns } from "../src/lib/tip-extras";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// The owner's fee rates (2026-11-03): the money maths with a pair of rates, how a typed percentage is
// read, the layers (standard, site-wide, a creator's own), and that a tip keeps the pair it was made at.

test.describe("a tip split with a pair of rates", () => {
  test("no fees: the creator keeps the whole tip and the books have two lines", () => {
    const none = { platformBps: 0, processingBps: 0 };
    expect(splitTip(10000, none)).toEqual({
      grossPaise: 10000,
      platformFeePaise: 0,
      processingPaise: 0,
      creatorSharePaise: 10000,
    });
    expect(capturePosting(splitTip(10000, none))).toEqual([
      { account: "processor_clearing", debitPaise: 10000, creditPaise: 0 },
      { account: "creator_payable", debitPaise: 0, creditPaise: 10000 },
    ]);
    expect(feeLines(splitTip(10000, none), none)).toEqual([]);
  });

  test("own rates, each part rounded half up, and the fee lines carry the pair", () => {
    const own = { platformBps: 300, processingBps: 150 };
    expect(splitTip(10000, own)).toMatchObject({ platformFeePaise: 300, processingPaise: 150, creatorSharePaise: 9550 });
    expect(feeLines(splitTip(10000, own), own)).toEqual([
      { feeType: "platform_fee", amountPaise: 300, bps: 300 },
      { feeType: "gateway_fee", amountPaise: 150, bps: 150 },
    ]);
    // Only one part charged.
    const onlyProcessing = { platformBps: 0, processingBps: 275 };
    expect(feeLines(splitTip(10000, onlyProcessing), onlyProcessing)).toEqual([
      { feeType: "gateway_fee", amountPaise: 275, bps: 275 },
    ]);
  });

  test("with no pair given it is the standard pair, as before", () => {
    expect(splitTip(10000)).toEqual(splitTip(10000, STANDARD_RATES));
    expect(splitTip(10000).creatorSharePaise).toBe(9225);
  });

  test("the highest allowed pair never leaves the creator less than nothing, and always adds up", () => {
    const top = { platformBps: MAX_PLATFORM_BPS, processingBps: MAX_PROCESSING_BPS };
    for (const gross of [1, 2, 3, 7, 9, 99, 100, 101, 1250, 4999, 10000, 123457, 10000000]) {
      const s = splitTip(gross, top);
      expect(s.creatorSharePaise).toBeGreaterThanOrEqual(0);
      expect(s.platformFeePaise + s.processingPaise + s.creatorSharePaise).toBe(gross);
    }
  });

  test("refuses a pair outside the allowed range, or one that is not whole basis points", () => {
    for (const bad of [
      { platformBps: MAX_PLATFORM_BPS + 1, processingBps: 0 },
      { platformBps: 0, processingBps: MAX_PROCESSING_BPS + 1 },
      { platformBps: -1, processingBps: 0 },
      { platformBps: 1.5, processingBps: 0 },
      { platformBps: NaN, processingBps: 0 },
    ]) {
      expect(() => splitTip(10000, bad)).toThrow(RangeError);
    }
    // A number handed in where the pair belongs (as `array.map(splitTip)` would) is refused, not guessed.
    expect(() => splitTip(10000, 1 as never)).toThrow(RangeError);
  });

  test("the dashboard estimate follows the pair", () => {
    expect(estimateShare(10000)).toBe(9225);
    expect(estimateShare(10000, { platformBps: 0, processingBps: 0 })).toBe(10000);
  });
});

test.describe("reading what the owner types", () => {
  test("whole and decimal percentages become basis points", () => {
    expect(parsePercent("5", MAX_PLATFORM_BPS)).toBe(500);
    expect(parsePercent("2.75", MAX_PROCESSING_BPS)).toBe(275);
    expect(parsePercent("0", MAX_PLATFORM_BPS)).toBe(0);
    expect(parsePercent("4.5", MAX_PLATFORM_BPS)).toBe(450);
    expect(parsePercent(" 7.05 % ", MAX_PLATFORM_BPS)).toBe(705);
    expect(parsePercent(30, MAX_PLATFORM_BPS)).toBe(3000);
  });

  test("anything else, or anything above the top, is refused", () => {
    for (const bad of ["", " ", "abc", "-1", "5.555", "1e2", "5,5", ".5", "5.", "30.01", "31", "100", null, undefined]) {
      expect(parsePercent(bad, MAX_PLATFORM_BPS)).toBeNull();
    }
    expect(parsePercent("10.01", MAX_PROCESSING_BPS)).toBeNull();
    expect(parsePercent("10", MAX_PROCESSING_BPS)).toBe(1000);
  });

  test("a rate form is read as a pair, with a message naming the wrong box", () => {
    expect(parseRates("0", "0")).toEqual({ ok: true, rates: { platformBps: 0, processingBps: 0 } });
    expect(parseRates("5", "2.75")).toEqual({ ok: true, rates: STANDARD_RATES });
    const a = parseRates("50", "2");
    expect(a.ok === false && a.error).toContain("platform fee");
    const b = parseRates("5", "abc");
    expect(b.ok === false && b.error).toContain("processing charge");
  });

  test("words for a pair", () => {
    expect(formatPercent(500)).toBe("5");
    expect(formatPercent(275)).toBe("2.75");
    expect(formatPercent(450)).toBe("4.5");
    expect(formatPercent(0)).toBe("0");
    expect(describeRates(STANDARD_RATES)).toBe("5% + 2.75%");
    expect(describeRates({ platformBps: 0, processingBps: 0 })).toBe("no fees");
    expect(keepOfHundred(STANDARD_RATES)).toBe("₹92.25");
    expect(keepOfHundred({ platformBps: 0, processingBps: 0 })).toBe("₹100.00");
    expect(estimateNote(STANDARD_RATES)).toBe("each tip less our 5% fee and the 2.75% processing charge");
    expect(estimateNote({ platformBps: 0, processingBps: 275 })).toBe("each tip less the 2.75% processing charge");
    expect(estimateNote({ platformBps: 0, processingBps: 0 })).toContain("no fee");
  });

  test("a tip saves its pair only when it is not the standard one", () => {
    expect(tipExtraColumns({ soundId: null, voice: false, rates: STANDARD_RATES })).toEqual({});
    expect(tipExtraColumns({ soundId: null, voice: false })).toEqual({});
    expect(tipExtraColumns({ soundId: null, voice: false, rates: { platformBps: 0, processingBps: 0 } })).toEqual({
      platform_bps: 0,
      processing_bps: 0,
    });
  });
});

let seq = 0;
async function creator(pg: PGlite, handle?: string): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1, $2, $3) returning id::text`,
    [`fg${seq}`, `f${seq}@example.com`, handle ?? `fcreator${seq}`],
  );
  return Number(r.rows[0].id);
}

// A captured live tip, optionally saved with its own pair (as createTipOrder does for non-standard rates).
async function tip(pg: PGlite, creatorId: number, gross = 10000, pair?: { p: number; q: number }) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    pair
      ? `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at, platform_bps, processing_bps)
         values ($1, $2, $3, 'captured', now(), $4, $5) returning id::text`
      : `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
         values ($1, $2, $3, 'captured', now()) returning id::text`,
    pair ? [creatorId, `ftip_${seq}`, gross, pair.p, pair.q] : [creatorId, `ftip_${seq}`, gross],
  );
  const paymentRef = `fpay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, true, $4, 'INR', now())`,
    [t.rows[0].id, `forder_${seq}`, paymentRef, gross, `ftip_${seq}`],
  );
  return { paymentRef, creatorId };
}

const creatorShare = async (pg: PGlite, creatorId: number) =>
  Number(
    (
      await pg.query<{ s: string }>(
        `select coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as s
           from ledger_entries e join ledger_accounts a on a.id = e.account_id
          where a.code = 'creator_payable' and e.creator_id = $1`,
        [creatorId],
      )
    ).rows[0].s,
  );

const feeRows = async (pg: PGlite) =>
  (
    await pg.query<{ fee_type: string; amount_minor: string; rate_value: string }>(
      `select fee_type, amount_minor::text, rate_value::text from fee_lines order by fee_type`,
    )
  ).rows;

test.describe("the layers: standard, site-wide, a creator's own", () => {
  test("with nothing saved everyone is on the standard pair", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const db = asLedgerDb(pg);
    expect(await getSiteRates(db)).toEqual(STANDARD_RATES);
    expect(await getCreatorRates(db, c)).toEqual({ effective: STANDARD_RATES, site: STANDARD_RATES, override: null });
  });

  test("the site pair applies to everyone without their own, and a bad stored value falls back to standard", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const db = asLedgerDb(pg);
    const saved = await saveSiteRates(db, { platformBps: 400, processingBps: 200 }, null);
    expect(saved).toMatchObject({ changed: true, before: STANDARD_RATES, after: { platformBps: 400, processingBps: 200 } });
    expect((await getCreatorRates(db, a)).effective).toEqual({ platformBps: 400, processingBps: 200 });

    await pg.query(`update site_settings set value = 'banana' where key = 'fee_platform_bps'`);
    await pg.query(`update site_settings set value = '99999' where key = 'fee_processing_bps'`);
    expect(await getSiteRates(db)).toEqual(STANDARD_RATES);
  });

  test("a creator's own pair beats the site pair, and handing them back follows the site again", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    const b = await creator(pg);
    const db = asLedgerDb(pg);
    await saveSiteRates(db, { platformBps: 400, processingBps: 200 }, null);
    await saveCreatorRates(db, [a], { platformBps: 0, processingBps: 0 }, null);

    expect((await getCreatorRates(db, a)).effective).toEqual({ platformBps: 0, processingBps: 0 });
    expect((await getCreatorRates(db, b)).effective).toEqual({ platformBps: 400, processingBps: 200 });

    await saveCreatorRates(db, [a], null, null);
    expect((await getCreatorRates(db, a)).override).toBeNull();
    expect((await getCreatorRates(db, a)).effective).toEqual({ platformBps: 400, processingBps: 200 });
  });

  test("a pair is both numbers or neither, and stays inside the limits, enforced by the database too", async () => {
    const pg = await freshDatabase();
    const a = await creator(pg);
    await expect(pg.query(`update users set platform_bps_override = 0 where id = $1`, [a])).rejects.toThrow();
    await expect(
      pg.query(`update users set platform_bps_override = 5001, processing_bps_override = 0 where id = $1`, [a]),
    ).rejects.toThrow();
    await expect(
      pg.query(`update users set platform_bps_override = 4000, processing_bps_override = 3000 where id = $1`, [a]),
    ).rejects.toThrow();
    await expect(tip(pg, a, 10000, { p: 9000, q: 0 })).rejects.toThrow();
  });
});

test.describe("the books use the pair the tip was made at", () => {
  test("a tip made with no fees posts the whole tip to the creator and no fee lines", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const t = await tip(pg, c, 10000, { p: 0, q: 0 });
    expect(await postCaptureAccrual(asLedgerDb(pg), t.paymentRef)).toEqual({ status: "posted" });
    expect(await creatorShare(pg, c)).toBe(10000);
    expect(await feeRows(pg)).toEqual([]);
    const unbalanced = await pg.query<{ bad: string }>(
      `select count(*)::text as bad from (select ledger_transaction_id from ledger_entries
         group by ledger_transaction_id having sum(debit_minor) <> sum(credit_minor)) x`,
    );
    expect(unbalanced.rows[0].bad).toBe("0");
  });

  test("a tip made at its own pair posts those amounts and records the rate on the fee lines", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const t = await tip(pg, c, 10000, { p: 300, q: 100 });
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    expect(await creatorShare(pg, c)).toBe(9600);
    expect(await feeRows(pg)).toEqual([
      { fee_type: "gateway_fee", amount_minor: "100", rate_value: "0.01000000" },
      { fee_type: "platform_fee", amount_minor: "300", rate_value: "0.03000000" },
    ]);
  });

  test("a tip with no saved pair was made at the standard rates", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const t = await tip(pg, c);
    await postCaptureAccrual(asLedgerDb(pg), t.paymentRef);
    expect(await creatorShare(pg, c)).toBe(9225);
  });

  test("changing a rate afterwards never reaches a tip that was already made", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const before = await tip(pg, c); // made at the standard pair, not yet posted
    await saveCreatorRates(db, [c], { platformBps: 0, processingBps: 0 }, null);
    await saveSiteRates(db, { platformBps: 1000, processingBps: 500 }, null);
    await postCaptureAccrual(db, before.paymentRef);
    expect(await creatorShare(pg, c)).toBe(9225);
  });

  test("a pair outside the limits stops the posting loudly instead of posting something odd", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const t = await tip(pg, c, 10000, { p: 4000, q: 1500 }); // inside the database's limit, outside the app's
    await expect(postCaptureAccrual(asLedgerDb(pg), t.paymentRef)).rejects.toThrow(RangeError);
    expect(await creatorShare(pg, c)).toBe(0);
  });
});

test.describe("saving rates", () => {
  test("a bulk change touches only creators that change, writes one audit row each, and counts the rest", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const [a, b, c] = [await creator(pg), await creator(pg), await creator(pg)];
    await saveCreatorRates(db, [c], { platformBps: 250, processingBps: 100 }, null);

    const res = await saveCreatorRates(db, [a, b, c, 999999], { platformBps: 250, processingBps: 100 }, "launch deal");
    expect(res).toEqual({ changed: 2, unchanged: 1, missing: 1 });

    const audit = await pg.query<{ entity_ref: string; before_json: unknown; after_json: unknown; reason: string | null }>(
      `select entity_ref, before_json, after_json, reason from audit_events
        where action = 'creator.fee_rates_changed' and reason = 'launch deal' order by entity_ref::bigint`,
    );
    expect(audit.rows.map((r) => r.entity_ref)).toEqual([String(a), String(b)]);
    expect(audit.rows[0].before_json).toEqual({ mode: "site" });
    expect(audit.rows[0].after_json).toEqual({ mode: "own", platformBps: 250, processingBps: 100 });
  });

  test("handing creators back records where they came from, and an unchanged creator writes nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    expect(await saveCreatorRates(db, [a], null, null)).toEqual({ changed: 0, unchanged: 1, missing: 0 });
    await saveCreatorRates(db, [a], { platformBps: 0, processingBps: 0 }, null);
    await saveCreatorRates(db, [a], null, "back to normal");
    const last = await pg.query<{ before_json: unknown; after_json: unknown }>(
      `select before_json, after_json from audit_events where reason = 'back to normal'`,
    );
    expect(last.rows).toEqual([
      { before_json: { mode: "own", platformBps: 0, processingBps: 0 }, after_json: { mode: "site" } },
    ]);
    const all = await pg.query<{ n: string }>(
      `select count(*)::text as n from audit_events where action = 'creator.fee_rates_changed'`,
    );
    expect(all.rows[0].n).toBe("2");
  });

  test("refuses an empty or too large list and a pair outside the limits", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    await expect(saveCreatorRates(db, [], null, null)).rejects.toThrow(RangeError);
    await expect(
      saveCreatorRates(db, Array.from({ length: BULK_MAX + 1 }, (_, i) => i + 1), null, null),
    ).rejects.toThrow(RangeError);
    await expect(saveCreatorRates(db, [1], { platformBps: 3001, processingBps: 0 }, null)).rejects.toThrow(RangeError);
    await expect(saveSiteRates(db, { platformBps: 0, processingBps: 1001 }, null)).rejects.toThrow(RangeError);
  });

  test("the site pair is audited, counts who follows it, and saving the same pair writes nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    await creator(pg);
    await saveCreatorRates(db, [a], { platformBps: 0, processingBps: 0 }, null);

    const first = await saveSiteRates(db, { platformBps: 400, processingBps: 200 }, "spring");
    expect(first).toMatchObject({ changed: true, following: 1 });
    const again = await saveSiteRates(db, { platformBps: 400, processingBps: 200 }, null);
    expect(again.changed).toBe(false);

    const audit = await pg.query<{ before_json: unknown; after_json: unknown; reason: string }>(
      `select before_json, after_json, reason from audit_events where action = 'site.fee_rates_changed'`,
    );
    expect(audit.rows).toEqual([
      {
        before_json: { platformBps: 500, processingBps: 275 },
        after_json: { platformBps: 400, processingBps: 200 },
        reason: "spring",
      },
    ]);
  });
});

test.describe("migration 0054", () => {
  test("every existing tip gets the standard pair, and the owner's own account starts with no fees, audited once", async () => {
    const pg = await freshDatabase();
    const other = await creator(pg);
    const ace = await creator(pg, "acepressure");
    await tip(pg, other);
    expect(
      (
        await pg.query<{ platform_bps: number; processing_bps: number }>(
          `select platform_bps, processing_bps from tip_orders limit 1`,
        )
      ).rows[0],
    ).toEqual({ platform_bps: 500, processing_bps: 275 });

    // The migration is safe to run again; this is the run that finds the owner's account.
    const sql = readMigration("0054_creator_fee_rates.sql");
    await pg.exec(sql);
    await pg.exec(sql);

    const rows = await pg.query<{ id: string; p: number | null; q: number | null }>(
      `select id::text, platform_bps_override as p, processing_bps_override as q from users order by id`,
    );
    expect(rows.rows.find((r) => Number(r.id) === ace)).toMatchObject({ p: 0, q: 0 });
    expect(rows.rows.find((r) => Number(r.id) === other)).toMatchObject({ p: null, q: null });

    const audit = await pg.query<{ entity_ref: string }>(
      `select entity_ref from audit_events where action = 'creator.fee_rates_changed'`,
    );
    expect(audit.rows).toEqual([{ entity_ref: String(ace) }]);

    // An override set by the owner afterwards is never overwritten by a re-run.
    await saveCreatorRates(asLedgerDb(pg), [ace], { platformBps: 200, processingBps: 100 }, null);
    await pg.exec(sql);
    expect((await getCreatorRates(asLedgerDb(pg), ace)).effective).toEqual({ platformBps: 200, processingBps: 100 });
  });
});

test.describe("only the owner can change a rate", () => {
  const root = join(__dirname, "..", "src");
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  test("every fee action and the fees page check the owner before anything else", () => {
    const actions = read("app/actions/fees.ts");
    const bodies = actions.split(/export async function /).slice(1);
    expect(bodies.length).toBe(3);
    for (const body of bodies) {
      const firstCall = body.slice(body.indexOf("{\n") + 2).trimStart();
      expect(firstCall.startsWith("await requireOwner();")).toBe(true);
    }
    expect(read("app/admin/fees/page.tsx")).toContain("await requireOwner();");
    expect(read("app/admin/layout.tsx")).toContain("await requireOwner();");
  });
});
