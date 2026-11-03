import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { planFeatures, sanitizeFeatureKeys } from "../src/lib/plans";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { discardDraft, getPageSummary, loadDraft, loadPageRow, publishDraft, resetPage, resolvePageDoc, restorePrevious, saveDraft } from "../src/lib/page-doc/store";
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
    expect(result).toEqual({ ok: false, message: "The header, amount, note and send blocks must stay on the page." });
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
    expect(await getPageSummary(db, id)).toEqual({ switchOn: true, hasDraft: false, hasPublished: false, hasPrevious: false, publishedUnreadable: false, lastChange: null });
    await setColumn(pg, id, "page_draft", owner);
    await setColumn(pg, id, "page_published", normal);
    expect(await getPageSummary(db, id)).toEqual({ switchOn: true, hasDraft: true, hasPublished: true, hasPrevious: false, publishedUnreadable: false, lastChange: null });
    const off = await creator(pg, []);
    expect((await getPageSummary(db, off)).switchOn).toBe(false);
  });
});

// Page builder phase 2: the draft the editor works on.
const withWords = (doc: PageDoc, heading: string): PageDoc => {
  const copy = structuredClone(doc);
  (copy.blocks.find((b) => b.type === "send") as Block<"send">).settings.heading = heading;
  return copy;
};

test.describe("opening the editor", () => {
  test("a creator with nothing saved starts from the page they would show", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const state = (await loadDraft(asLedgerDb(pg), id, owner))!;
    expect(state).toMatchObject({ switchOn: true, source: "default", base: null, published: null });
    expect(state.doc).toEqual(owner);
  });

  test("with a published page and no draft, the published page is the start", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_published", withWords(normal, "Go"));
    const state = (await loadDraft(asLedgerDb(pg), id, owner))!;
    expect(state.source).toBe("published");
    expect(state.base).toBeNull();
    expect(state.doc).toEqual(withWords(normal, "Go"));
  });

  test("a saved draft wins, and base is exactly what is stored", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_published", normal);
    await setColumn(pg, id, "page_draft", withWords(normal, "Draft"));
    const state = (await loadDraft(asLedgerDb(pg), id, owner))!;
    expect(state.source).toBe("draft");
    expect(state.base).toEqual(withWords(normal, "Draft"));
    expect(state.published).toEqual(normal);
  });

  test("a draft that is not a page is ignored, but still the base to replace", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_draft", { hello: "world" });
    const state = (await loadDraft(asLedgerDb(pg), id, normal))!;
    expect(state.source).toBe("default");
    expect(state.base).toEqual({ hello: "world" });
    // The editor can save over it with that base.
    expect((await saveDraft(asLedgerDb(pg), id, state.base, state.doc)).ok).toBe(true);
  });

  test("the switch off is reported, and a missing creator gives null", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, []);
    expect((await loadDraft(asLedgerDb(pg), id, normal))!.switchOn).toBe(false);
    expect(await loadDraft(asLedgerDb(pg), 999999, normal)).toBeNull();
  });
});

test.describe("saving the draft", () => {
  test("the first save needs no earlier draft, the next one needs the one just saved", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    const first = await saveDraft(db, id, null, withWords(normal, "One"));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.notes).toEqual([]);
    const second = await saveDraft(db, id, first.doc, withWords(normal, "Two"));
    expect(second.ok).toBe(true);
    expect((await columns(pg, id)).page_draft).toEqual(withWords(normal, "Two"));
  });

  test("a save from an old copy is a conflict and keeps what is stored", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    const first = await saveDraft(db, id, null, withWords(normal, "Tab one"));
    expect(first.ok).toBe(true);
    // A second tab that opened before the first save still holds base null.
    const stale = await saveDraft(db, id, null, withWords(normal, "Tab two"));
    expect(stale).toMatchObject({ ok: false, conflict: true });
    expect((await columns(pg, id)).page_draft).toEqual(withWords(normal, "Tab one"));
    // And an old tab with an older base, after two saves.
    if (!first.ok) return;
    await saveDraft(db, id, first.doc, withWords(normal, "Tab one again"));
    const old = await saveDraft(db, id, first.doc, withWords(normal, "Old"));
    expect(old).toMatchObject({ ok: false, conflict: true });
    expect((await columns(pg, id)).page_draft).toEqual(withWords(normal, "Tab one again"));
  });

  test("a base that is not an object is a conflict, not a crash", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    for (const base of ["x", 5, [], true]) {
      expect(await saveDraft(asLedgerDb(pg), id, base, normal)).toMatchObject({ ok: false, conflict: true });
    }
  });

  test("what is stored and sent back is the cleaned document, with what was changed", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const messy = withWords(normal, "x".repeat(80));
    const saved = await saveDraft(asLedgerDb(pg), id, null, messy);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.notes).toEqual(["The send heading was cut to 30 letters."]);
    expect((saved.doc.blocks.find((b) => b.type === "send") as Block<"send">).settings.heading).toBe("x".repeat(30));
    expect((await columns(pg, id)).page_draft).toEqual(saved.doc);
  });

  test("something that is not a page, or is huge, is refused and nothing is written", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    expect(await saveDraft(db, id, null, "nope")).toMatchObject({ ok: false, conflict: false });
    expect(await saveDraft(db, id, null, { version: 2, blocks: [] })).toMatchObject({ ok: false });
    expect(await saveDraft(db, id, null, { ...normal, theme: { pad: "x".repeat(200_000) } })).toMatchObject({ ok: false, message: "This draft is too big." });
    expect((await columns(pg, id)).page_draft).toBeNull();
  });

  test("the switch off refuses, and a missing creator is refused", async () => {
    const pg = await freshDatabase();
    const off = await creator(pg, []);
    expect(await saveDraft(asLedgerDb(pg), off, null, normal)).toMatchObject({ ok: false, conflict: false });
    expect((await columns(pg, off)).page_draft).toBeNull();
    expect(await saveDraft(asLedgerDb(pg), 999999, null, normal)).toMatchObject({ ok: false, message: "That creator was not found." });
  });

  test("saving writes no audit row", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await saveDraft(asLedgerDb(pg), id, null, normal);
    expect(await auditRows(pg, id)).toEqual([]);
  });

  test("a draft that hides a protected block is saved repaired, and the repair is reported", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const saved = await saveDraft(asLedgerDb(pg), id, null, withHiddenSend(normal));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.notes).toEqual(["The Send block cannot be hidden, so it was shown again."]);
    expect((saved.doc.blocks.find((b) => b.type === "send") as Block<"send">).visible).toBe(true);
  });
});

test.describe("publishing what was saved", () => {
  test("publishes the cleaned draft, keeps the old page as previous, writes one audit row", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", normal);
    const saved = await saveDraft(db, id, null, withWords(normal, "x".repeat(80)));
    expect(saved.ok).toBe(true);
    expect(await publishDraft(db, id)).toEqual({ ok: true, message: "Published." });
    const after = await columns(pg, id);
    expect(after.page_published).toEqual(saved.ok ? saved.doc : null);
    expect(after.page_previous).toEqual(normal);
    expect(await auditRows(pg, id)).toHaveLength(1);
  });

  test("a raw draft with an over-long word is published cleaned, never as it was written", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await setColumn(pg, id, "page_draft", withWords(normal, "x".repeat(80)));
    expect((await publishDraft(asLedgerDb(pg), id)).ok).toBe(true);
    const published = (await columns(pg, id)).page_published as PageDoc;
    expect((published.blocks.find((b) => b.type === "send") as Block<"send">).settings.heading).toBe("x".repeat(30));
  });

  test("publishing the same draft twice is refused the second time and keeps the real previous page", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", normal);
    await setColumn(pg, id, "page_draft", withWords(normal, "New"));
    expect((await publishDraft(db, id)).ok).toBe(true);
    expect(await publishDraft(db, id)).toEqual({ ok: false, message: "The published page is already this draft." });
    const after = await columns(pg, id);
    expect(after.page_previous).toEqual(normal);
    expect(await auditRows(pg, id)).toHaveLength(1);
  });
});

test.describe("throwing the draft away", () => {
  test("clears the draft only, and says so when there was none", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", normal);
    await setColumn(pg, id, "page_draft", owner);
    expect(await discardDraft(db, id)).toEqual({ ok: true, message: "The draft is gone." });
    expect(await columns(pg, id)).toMatchObject({ page_draft: null, page_published: normal });
    expect(await discardDraft(db, id)).toEqual({ ok: true, message: "There was no draft." });
    expect(await discardDraft(db, 999999)).toMatchObject({ ok: false });
  });
});

test.describe("the console summary, phase 2", () => {
  test("says when the published page cannot be read, and when the owner last changed it", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await setColumn(pg, id, "page_published", { not: "a page" });
    expect(await getPageSummary(db, id)).toMatchObject({ hasPublished: true, publishedUnreadable: true, lastChange: null });
    await setColumn(pg, id, "page_draft", owner);
    await setColumn(pg, id, "page_published", null);
    await publishDraft(db, id);
    const summary = await getPageSummary(db, id);
    expect(summary.publishedUnreadable).toBe(false);
    expect(summary.lastChange).toBeInstanceOf(Date);
  });
});
