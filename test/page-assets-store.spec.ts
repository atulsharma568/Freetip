import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { ASSET_LIMITS } from "../src/lib/page-doc/assets";
import { insertAsset, listAssets, loadPageAssets, referencedUrls, removeAsset, resolveAssets, takeDownAsset, usageOf, type NewAsset } from "../src/lib/page-doc/asset-store";
import { ownerPageDoc } from "../src/lib/page-doc/defaults";
import { publishDraft, saveDraft } from "../src/lib/page-doc/store";
import type { Block, PageDoc } from "../src/lib/page-doc/types";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// The database half of the tip page pictures (migration 0052): one creator's files never reach
// another creator's page, a file cannot be removed while a stored page uses it, and the limits hold.

let seq = 0;
async function creator(pg: PGlite, features: string[] = ["pageBuilder"]): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features) values ($1, $2, $3, 'active', $4::text[]) returning id::text`,
    [`ga${seq}`, `a${seq}@example.com`, `assets${seq}`, features],
  );
  return Number(r.rows[0].id);
}

const MB = 1024 * 1024;
const HOST = "https://store1.public.blob.vercel-storage.com";

function file(creatorId: number, patch: Partial<NewAsset> = {}): NewAsset {
  const kind = patch.kind ?? "image";
  const tag = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    kind,
    name: "Smoke",
    blobUrl: `${HOST}/page/${creatorId}/${tag}.${kind === "webm" ? "webm" : kind === "gif" ? "gif" : "png"}`,
    posterUrl: kind === "image" ? null : `${HOST}/page/${creatorId}/poster-${tag}.webp`,
    mime: kind === "webm" ? "video/webm" : kind === "gif" ? "image/gif" : "image/png",
    sizeBytes: 100_000,
    posterBytes: kind === "image" ? null : 20_000,
    width: 800,
    height: 450,
    durationMs: kind === "webm" ? 6000 : null,
    ...patch,
  };
}

const setColumn = (pg: PGlite, id: number, column: "page_draft" | "page_published" | "page_previous", doc: unknown) =>
  pg.query(`update users set ${column} = $1::jsonb where id = $2`, [JSON.stringify(doc), id]);

function backdropUsing(assetId: number): PageDoc {
  const doc = ownerPageDoc();
  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.type === "backdrop" ? ({ ...b, settings: { style: "media", asset: assetId, dim: 40 } } as Block) : b)),
  };
}

const audit = async (pg: PGlite, id: number) =>
  (await pg.query<{ action: string }>(`select action from audit_events where entity_ref = $1 and action like 'creator.page_asset_%' order by id`, [String(id)])).rows.map((r) => r.action);

test.describe("migration 0052", () => {
  test("can be run twice, and an animated file needs its still", async () => {
    const pg = await freshDatabase();
    await pg.exec(readMigration("0052_page_assets.sql"));
    const id = await creator(pg);
    await expect(
      pg.query(`insert into page_assets (creator_id, kind, name, blob_url, mime, size_bytes) values ($1, 'webm', 'x', 'u', 'video/webm', 10)`, [id]),
    ).rejects.toThrow();
    await pg.query(`insert into page_assets (creator_id, kind, name, blob_url, mime, size_bytes) values ($1, 'image', 'x', 'u', 'image/png', 10)`, [id]);
  });
});

test.describe("adding a file", () => {
  test("is saved, listed with where it is used, and audited", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id, { kind: "gif", name: "Embers" }));
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const list = await listAssets(db, id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: added.id, kind: "gif", name: "Embers", usedBy: [] });
    expect(list[0].posterUrl).toContain("/page/");
    expect(await audit(pg, id)).toEqual(["creator.page_asset_added"]);
  });

  test("is refused while the Custom tip page switch is off or for a creator that does not exist", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const off = await creator(pg, []);
    const refused = await insertAsset(db, off, file(off));
    expect(refused).toMatchObject({ ok: false });
    expect(await insertAsset(db, 999_999, file(999_999))).toMatchObject({ ok: false, message: "That creator was not found." });
    expect((await pg.query(`select 1 from page_assets`)).rows).toHaveLength(0);
  });

  test("stops at ten files, and at 40 MB with the stills counted", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    for (let i = 0; i < ASSET_LIMITS.files; i++) expect((await insertAsset(db, id, file(id))).ok).toBe(true);
    expect(await insertAsset(db, id, file(id))).toMatchObject({ ok: false });

    const other = await creator(pg);
    for (let i = 0; i < 4; i++) expect((await insertAsset(db, other, file(other, { sizeBytes: 8 * MB, kind: "webm", posterBytes: 1000 }))).ok).toBe(true);
    // 32 MB and 4 KB used: another 8 MB WebM with its still no longer fits.
    expect(await insertAsset(db, other, file(other, { sizeBytes: 8 * MB, kind: "webm", posterBytes: 300 * 1024 }))).toMatchObject({ ok: false });
    // A removed file frees its room.
    const [first] = await listAssets(db, other);
    expect((await removeAsset(db, other, first.id)).ok).toBe(true);
    expect((await insertAsset(db, other, file(other, { sizeBytes: 8 * MB, kind: "webm", posterBytes: 1000 }))).ok).toBe(true);
  });

  test("two creators each have their own allowance", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    for (let i = 0; i < ASSET_LIMITS.files; i++) await insertAsset(db, a, file(a));
    expect((await insertAsset(db, b, file(b))).ok).toBe(true);
  });
});

test.describe("which files a page may draw", () => {
  test("only the creator's own live files, and only the ones asked for", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    const mine = await insertAsset(db, a, file(a));
    const theirs = await insertAsset(db, b, file(b));
    if (!mine.ok || !theirs.ok) throw new Error("setup");

    expect(Object.keys(await resolveAssets(db, a, [mine.id])).map(Number)).toEqual([mine.id]);
    // Another creator's id gives nothing: a document cannot borrow someone else's picture.
    expect(await resolveAssets(db, a, [theirs.id])).toEqual({});
    // A file nobody has made.
    expect(await resolveAssets(db, a, [424242])).toEqual({});
    // Nothing asked for, nothing read; the editor asks for all.
    expect(await resolveAssets(db, a, [])).toEqual({});
    expect(Object.keys(await resolveAssets(db, a)).map(Number)).toEqual([mine.id]);
  });

  test("a removed file and a file whose address is not in the creator's folder give nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    const removed = await insertAsset(db, a, file(a));
    const elsewhere = await insertAsset(db, a, file(a, { blobUrl: `${HOST}/page/${b}/stolen.png` }));
    const outside = await insertAsset(db, a, file(a, { blobUrl: "https://evil.example.com/page/1/x.png" }));
    const noStill = await insertAsset(db, a, file(a, { kind: "gif", posterUrl: `${HOST}/media/${a}/x.webp` }));
    if (!removed.ok || !elsewhere.ok || !outside.ok || !noStill.ok) throw new Error("setup");
    await removeAsset(db, a, removed.id);
    const got = await resolveAssets(db, a);
    expect(Object.keys(got)).toEqual([]);
    expect((await listAssets(db, a)).length).toBe(0);
  });

  test("a gif keeps its still, an image has none", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const g = await insertAsset(db, a, file(a, { kind: "gif" }));
    const i = await insertAsset(db, a, file(a, { kind: "image" }));
    if (!g.ok || !i.ok) throw new Error("setup");
    const got = await resolveAssets(db, a);
    expect(got[g.id].posterUrl).toContain("poster-");
    expect(got[i.id].posterUrl).toBeNull();
  });

  test("a missing table (migration 0052 not run) is logged and gives nothing, not an error", async () => {
    const pg = await freshDatabase();
    await pg.exec("drop table page_assets");
    const a = await creator(pg);
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      expect(await loadPageAssets(asLedgerDb(pg), a, [1])).toEqual({});
    } finally {
      console.error = original;
    }
    expect(errors.length).toBe(1);
  });
});

test.describe("removing a file", () => {
  test("is refused while the draft, the published page or the previous version uses it, and says which", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id));
    if (!added.ok) throw new Error("setup");
    for (const [column, label] of [
      ["page_draft", "the draft"],
      ["page_published", "the published page"],
      ["page_previous", "the previous version"],
    ] as const) {
      await setColumn(pg, id, column, backdropUsing(added.id));
      const refused = await removeAsset(db, id, added.id);
      expect(refused, column).toMatchObject({ ok: false });
      if (!refused.ok) expect(refused.message).toContain(label);
      await pg.query(`update users set ${column} = null where id = $1`, [id]);
    }
    expect((await listAssets(db, id)).length).toBe(1);
    expect(await audit(pg, id)).toEqual(["creator.page_asset_added"]);
  });

  test("shows where a file is used in the list", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id));
    if (!added.ok) throw new Error("setup");
    await setColumn(pg, id, "page_draft", backdropUsing(added.id));
    await setColumn(pg, id, "page_published", backdropUsing(added.id));
    expect((await listAssets(db, id))[0].usedBy).toEqual(["the draft", "the published page"]);
    expect(usageOf({ page_draft: backdropUsing(7), page_published: null, page_previous: "garbage" }, 7)).toEqual(["the draft"]);
  });

  test("works once nothing uses it: the row is kept as removed, the addresses come back for deletion, one audit row", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id, { kind: "webm" }));
    if (!added.ok) throw new Error("setup");
    const removed = await removeAsset(db, id, added.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.urls).toHaveLength(2);
    const row = (await pg.query<{ review_state: string; removed_at: unknown }>(`select review_state, removed_at from page_assets where id = $1`, [added.id])).rows[0];
    expect(row.review_state).toBe("removed");
    expect(row.removed_at).not.toBeNull();
    expect(await audit(pg, id)).toEqual(["creator.page_asset_added", "creator.page_asset_removed"]);
  });

  test("a second remove (a double click) says it is gone and writes nothing more", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id));
    if (!added.ok) throw new Error("setup");
    expect((await removeAsset(db, id, added.id)).ok).toBe(true);
    expect(await removeAsset(db, id, added.id)).toEqual({ ok: false, message: "That file is already gone." });
    expect(await audit(pg, id)).toHaveLength(2);
  });

  test("cannot remove another creator's file", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    const theirs = await insertAsset(db, b, file(b));
    if (!theirs.ok) throw new Error("setup");
    expect(await removeAsset(db, a, theirs.id)).toMatchObject({ ok: false });
    expect((await listAssets(db, b)).length).toBe(1);
  });
});

test.describe("the owner's take-down", () => {
  test("works even while a page uses the file, and the page then draws nothing for it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id));
    if (!added.ok) throw new Error("setup");
    await setColumn(pg, id, "page_published", backdropUsing(added.id));
    const down = await takeDownAsset(db, added.id, "not allowed");
    expect(down.ok).toBe(true);
    if (down.ok) expect(down.creatorId).toBe(id);
    expect(await resolveAssets(db, id, [added.id])).toEqual({});
    expect(await takeDownAsset(db, added.id, "again")).toMatchObject({ ok: false });
    expect(await audit(pg, id)).toEqual(["creator.page_asset_added", "creator.page_asset_taken_down"]);
  });
});

test.describe("one row per stored file", () => {
  test("the same file or still cannot be saved twice", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const first = file(id, { kind: "gif" });
    expect((await insertAsset(db, id, first)).ok).toBe(true);
    await expect(insertAsset(db, id, { ...first })).rejects.toThrow();
    // A different file that reuses the first one's still is refused too.
    await expect(insertAsset(db, id, file(id, { kind: "gif", posterUrl: first.posterUrl }))).rejects.toThrow();
    expect((await listAssets(db, id)).length).toBe(1);
  });

  test("referencedUrls names the addresses a live row points at, as file or still, and not a removed one", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const f = file(id, { kind: "webm" });
    const saved = await insertAsset(db, id, f);
    if (!saved.ok) throw new Error("setup");
    const stranger = `${HOST}/page/${id}/nobody.png`;
    expect([...(await referencedUrls(db, [f.blobUrl, f.posterUrl!, stranger]))].sort()).toEqual([f.blobUrl, f.posterUrl!].sort());
    await removeAsset(db, id, saved.id);
    expect((await referencedUrls(db, [f.blobUrl, f.posterUrl!])).size).toBe(0);
  });
});

test.describe("publishing a page that uses a picture", () => {
  test("is refused when the picture is gone, and works while it is live", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const added = await insertAsset(db, id, file(id));
    if (!added.ok) throw new Error("setup");
    const draft = backdropUsing(added.id);
    expect((await saveDraft(db, id, null, draft)).ok).toBe(true);
    expect((await publishDraft(db, id)).ok).toBe(true);

    // Taken down by the owner while the draft still names it: the next publish says so.
    await takeDownAsset(db, added.id, "test");
    await pg.query(`update users set page_published = null, page_previous = null where id = $1`, [id]);
    const refused = await publishDraft(db, id);
    expect(refused).toMatchObject({ ok: false });
    if (!refused.ok) expect(refused.message).toMatch(/no longer in the library/);
  });

  test("is refused when the picture belongs to another creator", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const b = await creator(pg);
    const theirs = await insertAsset(db, b, file(b));
    if (!theirs.ok) throw new Error("setup");
    expect((await saveDraft(db, a, null, backdropUsing(theirs.id))).ok).toBe(true);
    expect(await publishDraft(db, a)).toMatchObject({ ok: false });
  });

  test("a page with no pictures publishes without touching the pictures table", async () => {
    const pg = await freshDatabase();
    await pg.exec("drop table page_assets");
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    expect((await saveDraft(db, id, null, ownerPageDoc())).ok).toBe(true);
    expect((await publishDraft(db, id)).ok).toBe(true);
  });
});
