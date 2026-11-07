import { expect, test } from "@playwright/test";
import { bannerStillUsable, isLibraryFile, listCreatorBanners, usableBanner, createDecorItem, grantDecor, listAllDecor, listCreatorDecor, removeOwnItem, resolveWornItems, revokeDecor, takeDownDecor, updateOwnItem, usableItem, type NewDecorItem } from "../src/lib/decor-library";
import { parseTipDecor, type DecorPlacement } from "../src/lib/page-doc/decor";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

const ring: DecorPlacement = { anchor: "ring", size: 144, dx: 0, dy: 0 };
const blob = (creator: number, name: string) => `https://abc.public.blob.vercel-storage.com/decor/${creator}/${name}`;
const item = (creator: number, name: string, kind: "avatar" | "frame" = "frame"): NewDecorItem => ({
  kind, name, blobUrl: blob(creator, `${kind}-${name}.png`), posterUrl: null, mime: "image/png", sizeBytes: 1000, width: 512, height: 512, animated: false, placement: ring,
});

async function setup() {
  const pg = await freshDatabase();
  const ids: number[] = [];
  for (const h of ["ace", "kabir", "mira"]) {
    const r = await pg.query<{ id: string }>(`insert into users (google_id, email, handle, name, creator_status) values ($1, $2, $3, $3, 'active') returning id::text`, [`g-${h}`, `${h}@example.com`, h]);
    ids.push(Number(r.rows[0].id));
  }
  return { pg, db: asLedgerDb(pg), ace: ids[0], kabir: ids[1], mira: ids[2] };
}

test.describe("decoration library", () => {
  test("an item is the owner's; another creator cannot use it until it is granted", async () => {
    const { db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    expect(await usableItem(db, ace, id)).toMatchObject({ id, name: "wings" });
    expect(await usableItem(db, kabir, id)).toBeNull();
    expect((await listCreatorDecor(db, kabir)).shared).toEqual([]);

    const r = await grantDecor(db, id, [kabir], "for the launch");
    expect(r).toEqual({ ok: true, granted: 1 });
    expect(await usableItem(db, kabir, id)).toMatchObject({ id });
    const lists = await listCreatorDecor(db, kabir);
    expect(lists.shared.map((i) => i.id)).toEqual([id]);
    expect(lists.shared[0].ownerHandle).toBe("ace");
    expect(lists.mine).toEqual([]);
  });

  test("a grant never goes to the owner of the item, and an unknown creator is refused", async () => {
    const { db, ace } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    expect(await grantDecor(db, id, [ace], null)).toEqual({ ok: false, message: "None of those creators can be given this picture." });
    expect(await grantDecor(db, id, [], null)).toMatchObject({ ok: false });
    expect(await grantDecor(db, 99999, [ace], null)).toMatchObject({ ok: false });
  });

  test("revoking a grant takes the picture off that creator's page, and it can be granted again", async () => {
    const { db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    await grantDecor(db, id, [kabir], null);
    const worn = parseTipDecor({ frameUpload: { url: blob(ace, "frame-wings.png"), itemId: id, placement: ring } })!;
    expect((await resolveWornItems(db, kabir, worn)).frameUpload).not.toBeNull();

    expect(await revokeDecor(db, id, kabir, "ended")).toBe(true);
    expect(await revokeDecor(db, id, kabir, "ended")).toBe(false);
    expect((await resolveWornItems(db, kabir, worn)).frameUpload).toBeNull();

    await grantDecor(db, id, [kabir], null);
    expect((await resolveWornItems(db, kabir, worn)).frameUpload).not.toBeNull();
  });

  test("taking an item down stops it everywhere, ends every grant and refuses a second time", async () => {
    const { db, ace, kabir, mira } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    await grantDecor(db, id, [kabir, mira], null);
    const res = await takeDownDecor(db, id, "not ours to share");
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.urls).toEqual([blob(ace, "frame-wings.png")]);
    expect(await usableItem(db, ace, id)).toBeNull();
    expect(await usableItem(db, kabir, id)).toBeNull();
    expect(await takeDownDecor(db, id, null)).toMatchObject({ ok: false });
    expect(await grantDecor(db, id, [mira], null)).toMatchObject({ ok: false });
  });

  test("a creator deletes only their own item; the owner's page keeps a picture saved before the library", async () => {
    const { db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    expect(await removeOwnItem(db, kabir, id)).toMatchObject({ ok: false });
    expect(await removeOwnItem(db, ace, id)).toMatchObject({ ok: true });
    const old = parseTipDecor({ frameUpload: { url: blob(ace, "frame-old.png") } })!;
    expect((await resolveWornItems(db, ace, old)).frameUpload).not.toBeNull();
  });

  test("renaming and remembering a placement work only on the creator's own approved item", async () => {
    const { db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    const p: DecorPlacement = { anchor: "top-right", size: 40, dx: 4, dy: -2 };
    expect(await updateOwnItem(db, kabir, id, { name: "mine now" })).toBe(false);
    expect(await updateOwnItem(db, ace, id, { name: "Big wings.png", placement: p })).toBe(true);
    const got = await usableItem(db, ace, id);
    expect(got).toMatchObject({ name: "Big wings", placement: p });
  });

  test("the owner's list shows owner, grants and how many pages wear the item; the audit trail has the changes", async () => {
    const { pg, db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, item(ace, "wings"));
    await grantDecor(db, id, [kabir], "launch");
    await pg.query(`update users set tip_decor = $1::jsonb where id = $2`, [JSON.stringify({ frameUpload: { url: blob(ace, "frame-wings.png"), itemId: id } }), kabir]);
    const rows = await listAllDecor(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, ownerHandle: "ace", reviewState: "approved", wornBy: 1 });
    expect(rows[0].grants.map((g) => g.handle)).toEqual(["kabir"]);
    await revokeDecor(db, id, kabir, "ended");
    const audit = await pg.query<{ action: string; reason: string | null }>(`select action, reason from audit_events where entity_type = 'decor_item' order by id`);
    expect(audit.rows).toEqual([{ action: "decor.granted", reason: "launch" }, { action: "decor.revoked", reason: "ended" }]);
  });
});

test.describe("banner library (migration 0063)", () => {
  const bannerBlob = (creator: number, name: string) => `https://abc.public.blob.vercel-storage.com/banners/${creator}/${name}`;
  const banner = (creator: number, name: string): NewDecorItem => ({
    kind: "banner", name, blobUrl: bannerBlob(creator, `${name}.webp`), posterUrl: null, mime: "image/webp", sizeBytes: 5 * 1024 * 1024, width: 1600, height: 500, animated: false, placement: ring,
  });

  test("a banner is saved up to 6 MB, listed apart from pictures, and shows its own address", async () => {
    const { db, ace } = await setup();
    const id = await createDecorItem(db, ace, banner(ace, "wide"));
    const { mine } = await listCreatorBanners(db, ace);
    expect(mine.map((b) => b.id)).toEqual([id]);
    expect(mine[0].url).toBe(bannerBlob(ace, "wide.webp"));
    expect((await listCreatorDecor(db, ace)).mine).toEqual([]);
    expect(await usableItem(db, ace, id)).toBeNull();
    expect(await usableBanner(db, ace, id)).toMatchObject({ id });
  });

  test("a granted banner is usable until the grant is withdrawn; a taken-down one stops everywhere", async () => {
    const { db, ace, kabir } = await setup();
    const id = await createDecorItem(db, ace, banner(ace, "wide"));
    const url = bannerBlob(ace, "wide.webp");
    expect(await usableBanner(db, kabir, id)).toBeNull();
    expect(await bannerStillUsable(db, kabir, url)).toBe(false);
    await grantDecor(db, id, [kabir], null);
    expect(await usableBanner(db, kabir, id)).toMatchObject({ id });
    expect(await bannerStillUsable(db, kabir, url)).toBe(true);
    expect((await listCreatorBanners(db, kabir)).shared.map((b) => b.id)).toEqual([id]);
    await revokeDecor(db, id, kabir, null);
    expect(await bannerStillUsable(db, kabir, url)).toBe(false);
    expect(await bannerStillUsable(db, ace, url)).toBe(true);
    await takeDownDecor(db, id, "no");
    expect(await bannerStillUsable(db, ace, url)).toBe(false);
  });

  test("a banner with no library item (a YouTube copy or an old upload) keeps showing; a library file is not erased by a page", async () => {
    const { db, ace } = await setup();
    expect(await bannerStillUsable(db, ace, "https://yt3.googleusercontent.com/x")).toBe(true);
    const id = await createDecorItem(db, ace, banner(ace, "wide"));
    expect(await isLibraryFile(db, bannerBlob(ace, "wide.webp"))).toBe(true);
    await removeOwnItem(db, ace, id);
    expect(await isLibraryFile(db, bannerBlob(ace, "wide.webp"))).toBe(false);
  });
});
