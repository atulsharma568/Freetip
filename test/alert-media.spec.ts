import { expect, test } from "@playwright/test";
import { planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import { cleanDimension, mediaFileName, pickMedia, type MediaCandidate } from "../src/lib/media";
import { closeCreatorAccount } from "../src/lib/account-close";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Custom alert media (phase 2, feature 1): which file plays for a tip, the switch
// that is checked at play time, and what closing an account does with the files.

const ON = planFeatures({ paid_features: ["customAlertMedia"] });
const OFF = planFeatures(null);
const raw = { voiceRequested: false, bannedWords: [], sound: null };

const file = (id: number, over: Partial<MediaCandidate> = {}): MediaCandidate => ({
  id,
  kind: "gif",
  blob_url: `https://x.public.blob.vercel-storage.com/media/1/f${id}.gif`,
  placement: "above",
  duration_ms: null,
  enabled: true,
  review_state: "approved",
  ...over,
});

test.describe("which file plays", () => {
  test("none when the creator has no playable file", () => {
    expect(pickMedia([], 5)).toBeNull();
    expect(pickMedia([file(1, { review_state: "new" }), file(2, { enabled: false }), file(3, { review_state: "removed" })], 5)).toBeNull();
  });

  test("a file that is held, switched off or taken down is skipped", () => {
    const out = pickMedia([file(1, { review_state: "new" }), file(2), file(3, { enabled: false })], 7);
    expect(out?.url).toContain("/f2.gif");
  });

  test("the same tip always gets the same file, and several files take turns", () => {
    const files = [file(1), file(2), file(3)];
    expect(pickMedia(files, 10)).toEqual(pickMedia(files, 10));
    const seen = new Set([0, 1, 2].map((tip) => pickMedia(files, tip)?.url));
    expect(seen.size).toBe(3);
  });

  test("carries the placement and a WebM's length", () => {
    expect(pickMedia([file(1, { kind: "webm", placement: "fullscreen", duration_ms: 4200 })], 1)).toEqual({
      url: "https://x.public.blob.vercel-storage.com/media/1/f1.gif",
      kind: "webm",
      placement: "fullscreen",
      durationMs: 4200,
    });
  });
});

test.describe("the alert carries media only while the switch is on", () => {
  test("off: the plain card, whatever files exist", () => {
    expect(resolveAlertExtras({ ...raw, media: [file(1)] }, { kind: "alert", features: OFF, tipId: 1 }).media).toBeNull();
  });

  test("on: the alert card gets a file, the follow-up message card does not", () => {
    expect(resolveAlertExtras({ ...raw, media: [file(1)] }, { kind: "alert", features: ON, tipId: 1 }).media).not.toBeNull();
    expect(resolveAlertExtras({ ...raw, media: [file(1)] }, { kind: "message", features: ON, tipId: 1 }).media).toBeNull();
  });

  test("a voice tip loses its sound but still shows media", () => {
    const sound = { url: "https://b/s.wav", volume: 80, ms: 900 };
    const out = resolveAlertExtras(
      { ...raw, voiceRequested: true, sound, media: [file(1)] },
      { kind: "alert", features: ON, tipId: 1 },
    );
    expect(out.sound).toBeNull();
    expect(out.media).not.toBeNull();
  });

  test("the loader reads only approved, enabled files, and only when the switch is on", async () => {
    const pg = await freshDatabase();
    const u = await pg.query<{ id: string }>(
      `insert into users (google_id, email, handle, creator_status, paid_features) values ('g1','a@example.com','handle1','active', array['customAlertMedia']) returning id::text`,
    );
    const creatorId = Number(u.rows[0].id);
    const add = (name: string, state: string, enabled = true) =>
      pg.query(
        `insert into creator_media (creator_id, kind, name, blob_url, mime, size_bytes, review_state, enabled)
         values ($1,'gif',$2,$3,'image/gif',1000,$4,$5)`,
        [creatorId, name, `https://x.public.blob.vercel-storage.com/media/${creatorId}/${name}.gif`, state, enabled],
      );
    await add("held", "new");
    await add("hidden", "approved", false);
    await add("gone", "removed");
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
      [creatorId],
    );
    const tipId = Number(t.rows[0].id);
    const db = asLedgerDb(pg) as unknown as Sql;

    expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).media).toBeNull();

    await add("live", "approved");
    const live = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
    expect(live.media?.url).toContain("/live.gif");

    await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
    expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).media).toBeNull();
  });
});

test.describe("small helpers", () => {
  test("a stored name is a slug plus the real extension", () => {
    expect(mediaFileName("Big Party!!", "image/gif")).toBe("big-party.gif");
    expect(mediaFileName("  ", "video/webm")).toBe("media.webm");
    expect(mediaFileName("x", "image/jpeg")).toBe("x.jpg");
  });

  test("a claimed size or length is kept only when it is a sane whole number", () => {
    expect(cleanDimension(640, 4096)).toBe(640);
    expect(cleanDimension(12.4, 4096)).toBe(12);
    for (const bad of [0, -1, 5000, NaN, Infinity, "10", null, undefined]) expect(cleanDimension(bad, 4096)).toBeNull();
  });
});

test("closing an account erases the media rows and hands back the files still stored", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status) values ('g9','z@example.com','closer','active') returning id::text`,
  );
  const id = Number(u.rows[0].id);
  const add = (name: string, state: string) =>
    pg.query(
      `insert into creator_media (creator_id, kind, name, blob_url, mime, size_bytes, review_state)
       values ($1,'gif',$2,$3,'image/gif',1000,$4)`,
      [id, name, `https://x.public.blob.vercel-storage.com/media/${id}/${name}.gif`, state],
    );
  await add("live", "approved");
  await add("held", "new");
  await add("gone", "removed");

  const res = await closeCreatorAccount(asLedgerDb(pg), id, { role: "creator", userId: id });
  expect(res.status).toBe("closed");
  if (res.status === "closed") {
    expect(res.blobUrls.sort()).toEqual([
      `https://x.public.blob.vercel-storage.com/media/${id}/held.gif`,
      `https://x.public.blob.vercel-storage.com/media/${id}/live.gif`,
    ]);
  }
  expect((await pg.query(`select 1 from creator_media where creator_id = $1`, [id])).rows).toHaveLength(0);
});
