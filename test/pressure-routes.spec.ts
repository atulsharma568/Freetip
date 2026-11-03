import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { defaultPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock, setChoice, setMeterGoal } from "../src/lib/page-doc/edit";
import { meterForHandle, meterForToken, obsBody, pageBody } from "../src/lib/page-doc/pressure-api";
import type { PageDoc } from "../src/lib/page-doc/types";
import { createWindowLimiter } from "../src/lib/window-limit";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// What the two Pressure meter endpoints answer (page builder phase 4), against the real schema.

let seq = 0;
const NOW = new Date("2026-11-05T10:00:00Z");

function meterDoc(patch: { where?: string; show?: string; goal?: number } = {}): PageDoc {
  let doc = addBlock(defaultPageDoc(), "pressureMeter").doc;
  if (patch.where) doc = setChoice(doc, "pressureMeter", "where", patch.where).doc;
  if (patch.show) doc = setChoice(doc, "pressureMeter", "show", patch.show).doc;
  if (patch.goal) doc = setMeterGoal(doc, patch.goal).doc;
  return doc;
}

async function creator(
  pg: PGlite,
  o: { features?: string[]; doc?: PageDoc | null; status?: string } = {},
): Promise<{ id: number; handle: string; tokenHash: string }> {
  seq += 1;
  const handle = `meter${seq}`;
  const tokenHash = `hash${seq}`.padEnd(64, "0");
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, page_published, overlay_token_hash)
     values ($1, $2, $3, $4, $5, $6, $7) returning id::text`,
    [`mr${seq}`, `mr${seq}@example.com`, handle, o.status ?? "active", o.features ?? ["pageBuilder", "pressureMeter"], o.doc === null ? null : JSON.stringify(o.doc ?? meterDoc()), tokenHash],
  );
  return { id: Number(r.rows[0].id), handle, tokenHash };
}

async function goal(pg: PGlite, creatorId: number, rupees = 1000, title = "New mic") {
  const r = await pg.query<{ id: string }>(
    `insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over, started_at)
     values ($1, $2, $3, 'weekly', 'Asia/Kolkata', false, '2026-01-01T00:00:00Z') returning id::text`,
    [creatorId, title, rupees * 100],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, rupees: number) {
  seq += 1;
  await pg.query(`insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at) values ($1, $2, $3, 'captured', '2026-11-04T10:00:00Z')`, [
    creatorId,
    `prt_${seq}`,
    rupees * 100,
  ]);
}

test.describe("the tip page endpoint", () => {
  test("gives the reading for a visible meter with both switches on", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await goal(pg, c.id, 1000);
    await tip(pg, c.id, 250);
    const a = await meterForHandle(db, c.handle, NOW);
    expect(a.found).toBe(true);
    if (!a.found) return;
    expect(pageBody(a)).toEqual({
      meter: { title: "New mic", repeat: "weekly", period: "this week", percent: 25, word: "Supernova", reached: false, raisedPaise: 25000, targetPaise: 100000 },
    });
  });

  test("a creator with no goal is found but has no reading", async () => {
    const pg = await freshDatabase();
    const a = await meterForHandle(asLedgerDb(pg), (await creator(pg)).handle, NOW);
    expect(a).toMatchObject({ found: true, reading: null });
  });

  test("either switch off, nothing published, a hidden meter, a closed account, or the OBS-only setting all give none", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const hidden = meterDoc();
    hidden.blocks.find((b) => b.type === "pressureMeter")!.visible = false;
    const cases = [
      await creator(pg, { features: ["pageBuilder"] }),
      await creator(pg, { features: ["pressureMeter"] }),
      await creator(pg, { features: [] }),
      await creator(pg, { doc: null }),
      await creator(pg, { doc: defaultPageDoc() }),
      await creator(pg, { doc: hidden }),
      await creator(pg, { status: "suspended" }),
      await creator(pg, { doc: meterDoc({ where: "obs" }) }),
    ];
    for (const c of cases) {
      await goal(pg, c.id);
      expect(await meterForHandle(db, c.handle, NOW), c.handle).toEqual({ found: false });
    }
  });

  test("an unknown handle, and handles that are not handles, give none", async () => {
    const db = asLedgerDb(await freshDatabase());
    for (const h of ["nobody", "", "A", "../x", "a b", "x".repeat(40), "'; drop table users; --"]) expect(await meterForHandle(db, h, NOW)).toEqual({ found: false });
  });

  test("percent only: the body and its JSON carry no amount at all", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { doc: meterDoc({ show: "percent" }) });
    await goal(pg, c.id, 123456);
    await tip(pg, c.id, 54321);
    const a = await meterForHandle(asLedgerDb(pg), c.handle, NOW);
    if (!a.found) throw new Error("expected a meter");
    const json = JSON.stringify(pageBody(a));
    expect(json).not.toMatch(/Paise|5432100|12345600|54321|123456/);
    expect(pageBody(a).meter).toMatchObject({ percent: 44, word: "Supernova" });
  });

  test("a meter pointing at another creator's goal shows the creator's own goal", async () => {
    const pg = await freshDatabase();
    const other = await creator(pg);
    const theirs = await goal(pg, other.id, 100, "Theirs");
    await tip(pg, other.id, 90);
    const c = await creator(pg, { doc: meterDoc({ goal: theirs }) });
    await goal(pg, c.id, 1000, "Mine");
    const a = await meterForHandle(asLedgerDb(pg), c.handle, NOW);
    expect(a.found && a.reading?.title).toBe("Mine");
    expect(a.found && a.reading?.percent).toBe(0);
  });
});

test.describe("the OBS endpoint", () => {
  test("gives the reading and only the settings the bar needs", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { doc: meterDoc({ where: "obs" }) });
    await goal(pg, c.id, 1000);
    const a = await meterForToken(asLedgerDb(pg), c.tokenHash, NOW);
    if (!a.found) throw new Error("expected a meter");
    const body = obsBody(a);
    expect(Object.keys(body).sort()).toEqual(["meter", "settings"]);
    expect(body.settings).toEqual({ heading: "", fill: null, celebrate: true, show: "rupees" });
  });

  test("set for the tip page only, a wrong token, or a switch off give none", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const pageOnly = await creator(pg, { doc: meterDoc({ where: "page" }) });
    const off = await creator(pg, { features: ["pageBuilder"], doc: meterDoc() });
    expect(await meterForToken(db, pageOnly.tokenHash, NOW)).toEqual({ found: false });
    expect(await meterForToken(db, off.tokenHash, NOW)).toEqual({ found: false });
    expect(await meterForToken(db, "0".repeat(64), NOW)).toEqual({ found: false });
  });

  test("percent only keeps amounts out of the OBS body too", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { doc: meterDoc({ where: "both", show: "percent" }) });
    await goal(pg, c.id, 777);
    await tip(pg, c.id, 333);
    const a = await meterForToken(asLedgerDb(pg), c.tokenHash, NOW);
    if (!a.found) throw new Error("expected a meter");
    expect(JSON.stringify(obsBody(a))).not.toMatch(/Paise|77700|33300|777|333/);
  });
});

test.describe("the in-memory request limiter", () => {
  test("allows the limit inside a window, then refuses, then opens again", () => {
    const allow = createWindowLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => allow("a", 0))).toEqual([true, true, true, false]);
    expect(allow("b", 0)).toBe(true);
    expect(allow("a", 999)).toBe(false);
    expect(allow("a", 1000)).toBe(true);
  });

  test("never holds more keys than its cap", () => {
    const allow = createWindowLimiter(1, 1_000_000, 3);
    for (const k of ["a", "b", "c", "d", "e"]) expect(allow(k, 0)).toBe(true);
    expect(allow("e", 0)).toBe(false);
  });
});
