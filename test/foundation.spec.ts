import { expect, test } from "@playwright/test";
import { FEATURES, FeatureOffError, hasFeature, planFeatures, requireFeature, type FeatureKey } from "../src/lib/plans";
import { resolveAlertExtras, loadAlertExtras, type Sql } from "../src/lib/alert-extras";
import { tipExtraColumns } from "../src/lib/tip-extras";
import {
  checkAllowance,
  checkMediaFile,
  initialReviewState,
  isOwnBlobUrl,
  mediaPathPrefix,
  playable,
  sniffMedia,
} from "../src/lib/media";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Phase 2 shared foundation: the generic `needs` rule, the server-side gate, the
// extras on a tip, the alert extras resolver and the media rules (migration 0036).

const NO_FLAGS = planFeatures(null);

function bytes(...parts: (string | number[])[]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") for (const ch of p) out.push(ch.charCodeAt(0));
    else out.push(...p);
  }
  while (out.length < 32) out.push(0);
  return Uint8Array.from(out);
}

test.describe("feature needs and the server gate", () => {
  test("a feature that needs another is off while that one is off", () => {
    expect(planFeatures({ paid_features: ["clipHelper"] }).clipHelper).toBe(false);
    expect(planFeatures({ paid_features: ["timestamps", "clipHelper"] }).clipHelper).toBe(true);
  });

  test("needs are declared only between real features", () => {
    const keys = new Set<FeatureKey>(FEATURES.map((f) => f.key));
    for (const f of FEATURES) for (const n of f.needs ?? []) expect(keys.has(n)).toBe(true);
  });

  test("requireFeature throws when off and passes when on", () => {
    expect(hasFeature({ paid_features: [] }, "supportStreak")).toBe(false);
    expect(() => requireFeature({ paid_features: [] }, "supportStreak")).toThrow(FeatureOffError);
    expect(() => requireFeature(null, "supportStreak")).toThrow(FeatureOffError);
    expect(() => requireFeature({ paid_features: ["supportStreak"] }, "supportStreak")).not.toThrow();
  });

  test("a feature that is not built is never on, even if stored", () => {
    expect(hasFeature({ paid_features: ["voiceNotes"] }, "voiceNotes")).toBe(false);
  });
});

test.describe("tip extras", () => {
  test("a plain tip sets no extra column", () => {
    expect(tipExtraColumns({ soundId: null, voice: false })).toEqual({});
  });

  test("a sound or the voice sets its own column", () => {
    expect(tipExtraColumns({ soundId: 7, voice: false })).toEqual({ sound_id: 7 });
    expect(tipExtraColumns({ soundId: null, voice: true })).toEqual({ tts_requested: true });
  });
});

test.describe("alert extras", () => {
  const raw = { voiceRequested: false, bannedWords: ["x"], sound: { url: "https://b/s.wav", volume: 80, ms: 900 } };

  test("the alert card keeps the sound; the follow-up message card has none", () => {
    expect(resolveAlertExtras(raw, { kind: "alert", features: NO_FLAGS }).sound).not.toBeNull();
    expect(resolveAlertExtras(raw, { kind: "message", features: NO_FLAGS }).sound).toBeNull();
  });

  test("a voice tip has no sound, not even the default", () => {
    const out = resolveAlertExtras({ ...raw, voiceRequested: true }, { kind: "alert", features: NO_FLAGS });
    expect(out.sound).toBeNull();
    expect(out.voiceRequested).toBe(true);
  });

  test("the paid extras are absent until their features ship", () => {
    const out = resolveAlertExtras(raw, { kind: "alert", features: NO_FLAGS });
    expect([out.media, out.theme, out.level, out.birthday, out.voiceNote, out.highlight]).toEqual([null, null, null, null, null, null]);
  });

  test("the loader reads the sound, the voice choice and the banned words from a real database", async () => {
    const pg = await freshDatabase();
    const u = await pg.query<{ id: string }>(
      `insert into users (google_id, email, handle, creator_status, banned_words) values ('g1','a@example.com','handle1','active','spam') returning id::text`,
    );
    const creatorId = Number(u.rows[0].id);
    const s = await pg.query<{ id: string }>(
      `insert into creator_sounds (creator_id, name, blob_url, duration_ms, size_bytes) values ($1,'Ding','https://x.public.blob.vercel-storage.com/sounds/1/d.wav',500,1000) returning id::text`,
      [creatorId],
    );
    await pg.query(`update users set default_sound_id = $1 where id = $2`, [s.rows[0].id, creatorId]);
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
      [creatorId],
    );
    const tipId = Number(t.rows[0].id);

    const out = await loadAlertExtras(asLedgerDb(pg) as unknown as Sql, { tipId, creatorId, kind: "alert" });
    expect(out.sound?.ms).toBe(500);
    expect(out.bannedWords).toEqual(["spam"]);
    expect(out.voiceRequested).toBe(false);

    await pg.query(`update tip_orders set tts_requested = true where id = $1`, [tipId]);
    const voice = await loadAlertExtras(asLedgerDb(pg) as unknown as Sql, { tipId, creatorId, kind: "alert" });
    expect(voice.voiceRequested).toBe(true);
    expect(voice.sound).toBeNull();
  });
});

test.describe("media rules", () => {
  test("recognises each allowed format from its first bytes", () => {
    expect(sniffMedia(bytes("GIF89a", [0x0a, 0, 0x14, 0]))).toMatchObject({ kind: "gif", width: 10, height: 20 });
    expect(
      sniffMedia(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], "IHDR", [0, 0, 1, 0, 0, 0, 0, 200])),
    ).toMatchObject({ kind: "image", mime: "image/png", width: 256, height: 200 });
    expect(sniffMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ kind: "image", mime: "image/jpeg" });
    expect(sniffMedia(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toMatchObject({ kind: "image", mime: "image/webp" });
    expect(sniffMedia(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], "webm"))).toMatchObject({
      kind: "webm",
    });
  });

  test("refuses everything else: a Matroska video, an SVG, an MP4, text, a short file", () => {
    expect(sniffMedia(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x88], "matroska"))).toBeNull();
    expect(sniffMedia(bytes("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffMedia(bytes([0, 0, 0, 0x18], "ftypmp42"))).toBeNull();
    expect(sniffMedia(bytes("hello world, not media at all"))).toBeNull();
    expect(sniffMedia(Uint8Array.from([0x47, 0x49, 0x46]))).toBeNull();
  });

  test("size caps differ by kind and a huge picture is refused", () => {
    const gif = bytes("GIF89a", [0x0a, 0, 0x14, 0]);
    expect(checkMediaFile(gif, 3 * 1024 * 1024).ok).toBe(true);
    expect(checkMediaFile(gif, 3 * 1024 * 1024 + 1).ok).toBe(false);
    const webm = bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], "webm");
    expect(checkMediaFile(webm, 8 * 1024 * 1024).ok).toBe(true);
    expect(checkMediaFile(webm, 8 * 1024 * 1024 + 1).ok).toBe(false);
    expect(checkMediaFile(bytes("GIF89a", [0xff, 0xff, 0x14, 0]), 1000).ok).toBe(false);
    expect(checkMediaFile(bytes("not media not media not media"), 100).ok).toBe(false);
  });

  test("the per-creator allowance", () => {
    expect(checkAllowance({ files: 0, bytes: 0 }, 1000)).toBeNull();
    expect(checkAllowance({ files: 20, bytes: 0 }, 1000)).not.toBeNull();
    expect(checkAllowance({ files: 2, bytes: 39 * 1024 * 1024 }, 2 * 1024 * 1024)).not.toBeNull();
  });

  test("a URL is trusted only inside our own store and the right folder", () => {
    const p = mediaPathPrefix(5);
    expect(isOwnBlobUrl("https://abc.public.blob.vercel-storage.com/media/5/a.gif", p)).toBe(true);
    expect(isOwnBlobUrl("https://abc.public.blob.vercel-storage.com/media/6/a.gif", p)).toBe(false);
    expect(isOwnBlobUrl("https://abc.public.blob.vercel-storage.com/media/5/../6/a.gif", p)).toBe(false);
    expect(isOwnBlobUrl("https://evil.example.com/media/5/a.gif", p)).toBe(false);
    expect(isOwnBlobUrl("http://abc.public.blob.vercel-storage.com/media/5/a.gif", p)).toBe(false);
    expect(isOwnBlobUrl("not a url", p)).toBe(false);
  });

  test("new files go live at once; only approved, enabled files play", () => {
    expect(initialReviewState()).toBe("approved");
    expect(playable({ enabled: true, review_state: "approved" })).toBe(true);
    expect(playable({ enabled: true, review_state: "new" })).toBe(false);
    expect(playable({ enabled: true, review_state: "removed" })).toBe(false);
    expect(playable({ enabled: false, review_state: "approved" })).toBe(false);
  });
});

test.describe("migration 0036", () => {
  test("creates the tables with their rules, and a deleted media is cleared from a rule", async () => {
    const pg = await freshDatabase();
    const u = await pg.query<{ id: string }>(
      `insert into users (google_id, email, handle, creator_status) values ('g1','a@example.com','handle1','active') returning id::text`,
    );
    const id = Number(u.rows[0].id);
    const m = await pg.query<{ id: string; review_state: string; placement: string }>(
      `insert into creator_media (creator_id, kind, name, blob_url, mime, size_bytes)
       values ($1,'gif','Party','https://x.public.blob.vercel-storage.com/media/1/p.gif','image/gif',1000) returning id::text, review_state, placement`,
      [id],
    );
    expect(m.rows[0].review_state).toBe("new");
    expect(m.rows[0].placement).toBe("above");
    await pg.query(`insert into alert_rules (creator_id, min_paise, media_id) values ($1, 10000, $2)`, [id, m.rows[0].id]);
    await expect(pg.query(`insert into alert_rules (creator_id, min_paise) values ($1, 10000)`, [id])).rejects.toThrow();
    await expect(
      pg.query(`insert into creator_media (creator_id, kind, name, blob_url, mime, size_bytes) values ($1,'mp4','x','u','video/mp4',1)`, [id]),
    ).rejects.toThrow();
    await pg.query(`delete from creator_media where id = $1`, [m.rows[0].id]);
    const r = await pg.query<{ media_id: string | null }>(`select media_id::text from alert_rules where creator_id = $1`, [id]);
    expect(r.rows[0].media_id).toBeNull();
  });
});
