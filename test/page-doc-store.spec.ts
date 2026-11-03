import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { planFeatures, sanitizeFeatureKeys } from "../src/lib/plans";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { getPageSummary, loadPageRow, publishDraft, resetPage, resolvePageDoc, restorePrevious } from "../src/lib/page-doc/store";
import type { Block, PageDoc } from "../src/lib/page-doc/types";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// Storing, reading, publishing and restoring a creator's tip page document (migration 0051).

let seq = 0;
async function creator(pg: PGlite, features: string[] = ["pageBuilder"]): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features) values ($1, $2, $3, 'active', $4::text[]) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `store${seq}`, features],
  );
  return Number(r.rows[0].id);
}

const setColumn = (pg: PGlite, id: number, column: "page_draft" | "page_published" | "page_previous", doc: unknown) =>
  pg.query(`update users set ${column} = $1::jsonb where id = $2`, [JSON.stringify(doc), id]);

const columns = async (pg: PGlite, id: number) =>
  (await pg.query<{ page_draft: unknown; page_published: unknown; page_previous: unknown }>(`select page_draft, page_published, page_previous from users where id = $1`, [id])).rows[0];

const auditRows = async (pg: PGlite, id: number) =>
  (await pg.query<{ action: string; after_json: unknown }>(`select action, after_json from audit_events where entity_ref = $1 and action like 'creator.page_%' order by id`, [String(id)])).rows;

function withHiddenSend(doc: PageDoc): PageDoc {
  const copy = structuredClone(doc);
  copy.blocks.find((b) => b.type === "send")!.visible = false;
  return copy;
}

const owner = ownerPageDoc();
const normal = defaultPageDoc();

test.describe("migration 0051 and the switch", () => {
  test("adds three empty columns and can be run twice", async () => {
    const pg = await freshDatabase();
    await pg.exec(readMigration("0051_page_builder.sql"));
    const id = await creator(pg);
    expect(await columns(pg, id)).toEqual({ page_draft: null, page_published: null, page_previous: null });
  });

  test("pageBuilder is a built, per-creator switch that is off until ticked", () => {
    expect(planFeatures({ paid_features: ["pageBuilder"] }).pageBuilder).toBe(true);
    expect(planFeatures({ paid_features: [] }).pageBuilder).toBe(false);
    expect(planFeatures(null).pageBuilder).toBe(false);
    expect(sanitizeFeatureKeys(["pageBuilder", "nonsense"])).toEqual(["pageBuilder"]);
  });
});

test.describe("which page a creator gets", () => {
  const on = { paid_features: ["pageBuilder"] };

  test("the switch off ignores a published document", () => {
    expect(resolvePageDoc({ paid_features: [], page_published: owner }, normal)).toBe(normal);
    expect(resolvePageDoc(null, normal)).toBe(normal);
  });

  test("the switch on shows the published document", () => {
    expect(resolvePageDoc({ ...on, page_published: owner }, normal)).toEqual(owner);
  });

  test("nothing published, or something that is not a page, gives the normal page", () => {
    expect(resolvePageDoc({ ...on, page_published: null }, normal)).toBe(normal);
    for (const garbage of ["nope", 5, [], {}, { version: 2, blocks: [] }]) {
      expect(resolvePageDoc({ ...on, page_published: garbage }, normal)).toBe(normal);
    }
  });

  test("a document that hides the pay button is still payable", () => {
    const doc = resolvePageDoc({ ...on, page_published: withHiddenSend(owner) }, normal);
    expect((doc.blocks.find((b) => b.type === "send") as Block<"send">).visible).toBe(true);
  });

  test("a database without the new columns gives no row, not an error", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const handle = (await pg.query<{ handle: string }>(`select handle from users where id = $1`, [id])).rows[0].handle;
    const db = asLedgerDb(pg);
    expect((await loadPageRow(db, handle))?.paid_features).toEqual(["pageBuilder"]);
    await pg.exec("alter table users drop column page_published");
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(await loadPageRow(db, handle)).toBeNull();
    } finally {
      console.error = quiet;
    }
  });
});

test.describe("publishing a draft", () => {
  test("refuses when there is no draft", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    expect(await publishDraft(asLedgerDb(pg), id)).toEqual({ ok: false, message: "There is no draft to publish." });
  });

  test("refuses a draft that hides a pay block and changes nothing", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_published", normal);
    await setColumn(pg, id, "page_draft", withHiddenSend(owner));
    const result = await publishDraft(asLedgerDb(pg), id);
    expect(result).toEqual({ ok: false, message: "The amount, note and send blocks must stay on the page." });
    expect((await columns(pg, id)).page_published).toEqual(normal);
    expect(await auditRows(pg, id)).toEqual([]);
  });

  test("refuses when the creator's switch is off", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, []);
    await setColumn(pg, id, "page_draft", owner);
    const result = await publishDraft(asLedgerDb(pg), id);
    expect(result.ok).toBe(false);
    expect((await columns(pg, id)).page_published).toBeNull();
  });

  test("a good draft becomes the published page and the old one is kept one step back", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_published", normal);
    await setColumn(pg, id, "page_draft", owner);
    expect((await publishDraft(asLedgerDb(pg), id)).ok).toBe(true);
    const after = await columns(pg, id);
    expect(after.page_published).toEqual(owner);
    expect(after.page_previous).toEqual(normal);
    expect(await auditRows(pg, id)).toEqual([{ action: "creator.page_published", after_json: { published: true, previous: true } }]);
  });

  test("a second publish makes the first published page the previous one", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_draft", owner);
    await publishDraft(db, id);
    await setColumn(pg, id, "page_draft", normal);
    await publishDraft(db, id);
    const after = await columns(pg, id);
    expect(after.page_published).toEqual(normal);
    expect(after.page_previous).toEqual(owner);
  });
});

test.describe("restoring the previous version", () => {
  test("refuses when there is nothing earlier", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_published", owner);
    expect(await restorePrevious(asLedgerDb(pg), id)).toEqual({ ok: false, message: "There is no earlier version to restore." });
    expect((await columns(pg, id)).page_published).toEqual(owner);
  });

  test("swaps the published and previous pages, and swaps back the second time", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", owner);
    await setColumn(pg, id, "page_previous", normal);
    expect((await restorePrevious(db, id)).ok).toBe(true);
    expect(await columns(pg, id)).toMatchObject({ page_published: normal, page_previous: owner });
    expect((await restorePrevious(db, id)).ok).toBe(true);
    expect(await columns(pg, id)).toMatchObject({ page_published: owner, page_previous: normal });
    expect((await auditRows(pg, id)).map((r) => r.action)).toEqual(["creator.page_restored", "creator.page_restored"]);
  });

  test("refuses when the creator's switch is off", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, []);
    await setColumn(pg, id, "page_previous", normal);
    expect((await restorePrevious(asLedgerDb(pg), id)).ok).toBe(false);
  });
});

test.describe("resetting to the normal page", () => {
  test("empties all three columns and is audited", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_draft", owner);
    await setColumn(pg, id, "page_published", owner);
    await setColumn(pg, id, "page_previous", normal);
    expect((await resetPage(asLedgerDb(pg), id)).ok).toBe(true);
    expect(await columns(pg, id)).toEqual({ page_draft: null, page_published: null, page_previous: null });
    expect(await auditRows(pg, id)).toEqual([{ action: "creator.page_reset", after_json: { published: false, previous: false } }]);
  });

  test("works even when the switch is off, and a second reset changes and records nothing", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, []);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", owner);
    expect((await resetPage(db, id)).ok).toBe(true);
    expect(await resetPage(db, id)).toEqual({ ok: true, message: "Already the normal page." });
    expect(await auditRows(pg, id)).toHaveLength(1);
  });

  test("a creator that does not exist is refused", async () => {
    const pg = await freshDatabase();
    expect(await resetPage(asLedgerDb(pg), 999999)).toEqual({ ok: false, message: "That creator was not found." });
  });
});

test.describe("the summary the owner console shows", () => {
  test("reports the switch and which versions exist", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    expect(await getPageSummary(db, id)).toEqual({ switchOn: true, hasDraft: false, hasPublished: false, hasPrevious: false });
    await setColumn(pg, id, "page_draft", owner);
    await setColumn(pg, id, "page_published", normal);
    expect(await getPageSummary(db, id)).toEqual({ switchOn: true, hasDraft: true, hasPublished: true, hasPrevious: false });
    const off = await creator(pg, []);
    expect((await getPageSummary(db, off)).switchOn).toBe(false);
  });
});
