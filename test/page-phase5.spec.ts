import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { kindsFor, replaceAssetId, usableFor, usedAssetIds } from "../src/lib/page-doc/assets";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock, setAsset, swapAsset } from "../src/lib/page-doc/edit";
import { parsePageDoc } from "../src/lib/page-doc/parse";
import { asTemplate, copyPageFrom, loadDraft, publishDraft, resolvePageDoc } from "../src/lib/page-doc/store";
import type { Block, PageDoc } from "../src/lib/page-doc/types";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Page builder phase 5: a picture on the Pressure meter, and a creator's page copied to another as
// a template.

const find = <T extends Block["type"]>(doc: PageDoc, type: T) => doc.blocks.find((b) => b.type === type) as Block<T>;

function withMeter(patch: Record<string, unknown> = {}): PageDoc {
  const doc = addBlock(defaultPageDoc(), "pressureMeter").doc;
  return { ...doc, blocks: doc.blocks.map((b) => (b.type === "pressureMeter" ? ({ ...b, settings: { ...b.settings, ...patch } } as Block) : b)) };
}

test.describe("the meter picture", () => {
  test("a new meter has no picture, and a stored picture id is kept", () => {
    expect(find(addBlock(defaultPageDoc(), "pressureMeter").doc, "pressureMeter").settings.picture).toBeNull();
    const parsed = parsePageDoc(withMeter({ picture: 7 }));
    expect(find(parsed!.doc, "pressureMeter").settings.picture).toBe(7);
  });

  test("a document stored before phase 5 has no picture", () => {
    const old = JSON.parse(JSON.stringify(withMeter()));
    delete old.blocks.find((b: Block) => b.type === "pressureMeter").settings.picture;
    expect(find(parsePageDoc(old)!.doc, "pressureMeter").settings.picture).toBeNull();
  });

  test("a bad id is removed with a note", () => {
    for (const bad of [0, -1, 1.5, "7", {}]) {
      const parsed = parsePageDoc(withMeter({ picture: bad }))!;
      expect(find(parsed.doc, "pressureMeter").settings.picture, String(bad)).toBeNull();
      expect(parsed.notes).toContain("The meter picture was not valid and was removed.");
    }
  });

  test("a picture or GIF fits the meter, a video does not", () => {
    expect(kindsFor("meter")).toEqual(["image", "gif"]);
    expect(usableFor("webm", "meter")).toBe(false);
    expect(usableFor("gif", "meter")).toBe(true);
  });

  test("the editor sets and clears it, and it counts as a use of the file", () => {
    const doc = withMeter();
    const set = setAsset(doc, "pressureMeter", 5);
    expect(set).toMatchObject({ changed: true, problems: [] });
    expect(usedAssetIds(set.doc)).toEqual([5]);
    expect(setAsset(set.doc, "pressureMeter", 5).changed).toBe(false);
    expect(usedAssetIds(setAsset(set.doc, "pressureMeter", null).doc)).toEqual([]);
    expect(setAsset(doc, "pressureMeter", 0).problems).toEqual(["That picture is not valid."]);
  });

  test("Replace moves it to the new file, unless the new file is a video", () => {
    const doc = setAsset(withMeter(), "pressureMeter", 5).doc;
    expect(find(swapAsset(doc, 5, 6, "image").doc, "pressureMeter").settings.picture).toBe(6);
    expect(replaceAssetId(doc, 5, 6, "webm").changed).toBe(false);
    expect(swapAsset(doc, 5, 6, "webm")).toMatchObject({ changed: false, problems: ["The new file cannot be used where the old one was."] });
  });
});

test.describe("a page as a template", () => {
  test("asTemplate takes out the pictures and the goal pick and nothing else", () => {
    const doc = ownerPageDoc();
    const full: PageDoc = {
      ...doc,
      blocks: [
        ...doc.blocks.map((b) =>
          b.type === "backdrop"
            ? ({ ...b, settings: { style: "media", asset: 3, dim: 55 } } as Block)
            : b.type === "header"
              ? ({ ...b, settings: { bannerAsset: 4 } } as Block)
              : b.type === "strip"
                ? ({ ...b, settings: { left: "Keep me", right: "" } } as Block)
                : b,
        ),
        { id: "pressureMeter", type: "pressureMeter", visible: true, slot: "side", settings: { ...withMeter({}).blocks.find((b) => b.type === "pressureMeter")!.settings, goal: 9, picture: 8, heading: "Heat" } } as Block,
      ],
    };
    const out = asTemplate(full);
    expect(out.removed).toEqual(["the backdrop picture", "the banner picture", "the meter picture", "the meter's goal pick"]);
    expect(usedAssetIds(out.doc)).toEqual([]);
    expect(find(out.doc, "pressureMeter").settings).toMatchObject({ goal: null, picture: null, heading: "Heat" });
    expect(find(out.doc, "backdrop").settings).toMatchObject({ style: "media", asset: null, dim: 55 });
    expect(find(out.doc, "strip").settings.left).toBe("Keep me");
    expect(out.doc.theme).toEqual(full.theme);
    // The given document is not changed.
    expect(usedAssetIds(full)).toEqual([3, 4, 8]);
  });

  test("a page with nothing of the creator's own comes through unchanged", () => {
    const doc = defaultPageDoc();
    expect(asTemplate(doc)).toEqual({ doc, removed: [] });
  });
});

let seq = 0;
async function creator(pg: PGlite, features: string[] = ["pageBuilder"]): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features) values ($1, $2, $3, 'active', $4::text[]) returning id::text`,
    [`gp5${seq}`, `p5${seq}@example.com`, `copy${seq}`, features],
  );
  return Number(r.rows[0].id);
}

const setColumn = (pg: PGlite, id: number, column: "page_draft" | "page_published" | "page_previous", doc: unknown) =>
  pg.query(`update users set ${column} = $1::jsonb where id = $2`, [JSON.stringify(doc), id]);

const columns = async (pg: PGlite, id: number) =>
  (await pg.query<{ page_draft: unknown; page_published: unknown; page_previous: unknown }>(`select page_draft, page_published, page_previous from users where id = $1`, [id])).rows[0];

const audit = async (pg: PGlite, id: number) =>
  (await pg.query<{ action: string; after_json: unknown }>(`select action, after_json from audit_events where entity_ref = $1 and action = 'creator.page_copied' order by id`, [String(id)])).rows;

function custom(): PageDoc {
  const doc = withMeter({ goal: 12, picture: 99 });
  return { ...doc, blocks: doc.blocks.map((b) => (b.type === "strip" ? b : b.type === "send" ? ({ ...b, settings: { heading: "", buttonLabel: "Tip" } } as Block) : b)) };
}

test.describe("copying a page into another creator's draft", () => {
  test("the source's published page lands in the target's draft, cleaned, and nothing is published", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const source = await creator(pg);
    const target = await creator(pg);
    await setColumn(pg, source, "page_published", custom());
    const result = await copyPageFrom(db, source, target, defaultPageDoc());
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Not copied, because they belong to the other creator: the meter picture, the meter's goal pick.");
    const row = await columns(pg, target);
    expect(row.page_published).toBeNull();
    expect(row.page_previous).toBeNull();
    const draft = parsePageDoc(row.page_draft)!.doc;
    expect(find(draft, "pressureMeter").settings).toMatchObject({ goal: null, picture: null });
    expect(find(draft, "send").settings.buttonLabel).toBe("Tip");
    // The source is untouched.
    expect(parsePageDoc((await columns(pg, source)).page_published)!.doc).toEqual(parsePageDoc(custom())!.doc);
  });

  test("the editor opens on the copy", async () => {
    const pg = await freshDatabase();
    const source = await creator(pg);
    const target = await creator(pg);
    await setColumn(pg, source, "page_published", custom());
    await copyPageFrom(asLedgerDb(pg), source, target, defaultPageDoc());
    const state = await loadDraft(asLedgerDb(pg), target, defaultPageDoc());
    expect(state?.source).toBe("draft");
    expect(find(state!.doc, "pressureMeter")).toBeTruthy();
  });

  test("it replaces the target's draft, and the copy can then be published", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const source = await creator(pg);
    const target = await creator(pg);
    await setColumn(pg, source, "page_published", custom());
    await setColumn(pg, target, "page_draft", ownerPageDoc());
    await copyPageFrom(db, source, target, defaultPageDoc());
    expect(find(parsePageDoc((await columns(pg, target)).page_draft)!.doc, "pressureMeter")).toBeTruthy();
    // The meter is visible and the target has no meter switch, so publish says so (the existing rule).
    expect(await publishDraft(db, target)).toMatchObject({ ok: false });
    await pg.query(`update users set paid_features = array['pageBuilder','pressureMeter'] where id = $1`, [target]);
    expect(await publishDraft(db, target)).toEqual({ ok: true, message: "Published." });
  });

  test("a source whose switch is off, or with no page, gives the fallback (the normal page)", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const off = await creator(pg, []);
    const none = await creator(pg);
    const target = await creator(pg);
    // What fans see for `off` is the normal page, not the stored one.
    await setColumn(pg, off, "page_published", custom());
    await copyPageFrom(db, off, target, defaultPageDoc());
    expect(parsePageDoc((await columns(pg, target)).page_draft)!.doc).toEqual(defaultPageDoc());
    // The owner's own page is the fallback for the owner.
    await copyPageFrom(db, none, target, ownerPageDoc());
    expect(parsePageDoc((await columns(pg, target)).page_draft)!.doc).toEqual(parsePageDoc(ownerPageDoc())!.doc);
    // And resolvePageDoc agrees with what was copied.
    expect(resolvePageDoc({ paid_features: [], page_published: custom() }, defaultPageDoc())).toEqual(defaultPageDoc());
  });

  test("it is refused for yourself, for a missing creator and for a target with the switch off", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const a = await creator(pg);
    const off = await creator(pg, []);
    expect(await copyPageFrom(db, a, a, defaultPageDoc())).toEqual({ ok: false, message: "Pick a different creator to copy from." });
    expect(await copyPageFrom(db, 987654, a, defaultPageDoc())).toEqual({ ok: false, message: "The creator to copy from was not found." });
    expect(await copyPageFrom(db, a, 987654, defaultPageDoc())).toEqual({ ok: false, message: "That creator was not found." });
    expect(await copyPageFrom(db, a, off, defaultPageDoc())).toEqual({ ok: false, message: 'Switch on "Custom tip page" for this creator first.' });
    expect((await columns(pg, off)).page_draft).toBeNull();
    expect(await audit(pg, off)).toEqual([]);
  });

  test("it writes one audit row against the target, naming the source", async () => {
    const pg = await freshDatabase();
    const source = await creator(pg);
    const target = await creator(pg);
    await copyPageFrom(asLedgerDb(pg), source, target, defaultPageDoc());
    expect(await audit(pg, target)).toEqual([{ action: "creator.page_copied", after_json: { source_creator_id: source } }]);
    expect(await audit(pg, source)).toEqual([]);
  });
});
