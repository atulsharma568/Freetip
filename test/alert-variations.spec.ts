import { expect, test } from "@playwright/test";
import { FEATURES, planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import type { AlertRule } from "../src/lib/alert-rules";
import { baseColours } from "../src/lib/alert-text";
import {
  MAX_VARIATIONS_PER_CREATOR,
  mergeAlertText,
  parseVariation,
  pickVariation,
  variationStayMs,
  variationText,
  type AlertVariation,
} from "../src/lib/alert-variations";
import type { MediaCandidate } from "../src/lib/media";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert variations by tip size (alert studio, item 3): which variation a tip gets, what a fan's
// own choice always beats, the separate switches for each part, and what is refused.

const ALL = planFeatures({ paid_features: ["alertVariations", "customAlertMedia", "alertText", "alertRules"] });
const VAR_ONLY = planFeatures({ paid_features: ["alertVariations"] });
const OFF = planFeatures(null);
const LIME = baseColours("classic", "#bfe84a");

const snd = (n: number) => ({ url: `https://b/s${n}.wav`, volume: 80, ms: 900 });
const variation = (id: number, rupees: number, over: Partial<AlertVariation> = {}): AlertVariation => ({
  id,
  minPaise: rupees * 100,
  mediaId: null,
  sound: null,
  text: null,
  stayMs: null,
  ...over,
});
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
const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };
const withVars = (list: AlertVariation[], rupees: number, picked = false) => ({
  list,
  amountPaise: rupees * 100,
  picked,
});

test.describe("which variation a tip gets", () => {
  const list = [variation(1, 100), variation(2, 500), variation(3, 2000)];

  test("the highest size at or below the tip", () => {
    expect(pickVariation(list, 99 * 100)).toBeNull();
    expect(pickVariation(list, 100 * 100)?.id).toBe(1);
    expect(pickVariation(list, 499 * 100)?.id).toBe(1);
    expect(pickVariation(list, 500 * 100)?.id).toBe(2);
    expect(pickVariation(list, 99_999 * 100)?.id).toBe(3);
  });

  test("the order of the list does not matter, and an empty list gives none", () => {
    expect(pickVariation([...list].reverse(), 600 * 100)?.id).toBe(2);
    expect(pickVariation([], 600 * 100)).toBeNull();
  });

  test("a long stay counts only from ₹1,000 up and within 10 seconds to 5 minutes", () => {
    expect(variationStayMs({ minPaise: 100_000, stayMs: 60_000 })).toBe(60_000);
    expect(variationStayMs({ minPaise: 99_900, stayMs: 60_000 })).toBeNull();
    expect(variationStayMs({ minPaise: 100_000, stayMs: 9_000 })).toBeNull();
    expect(variationStayMs({ minPaise: 100_000, stayMs: 301_000 })).toBeNull();
    expect(variationStayMs({ minPaise: 100_000, stayMs: null })).toBeNull();
  });
});

test.describe("the wording and colours", () => {
  test("the variation's fields sit on top of the standard text", () => {
    const standard = { headline: "{name} tipped", bg: "#101010", text: "#ffffff" };
    expect(mergeAlertText(standard, { headline: "{name} went big {amount}" }, LIME)).toEqual({
      headline: "{name} went big {amount}",
      bg: "#101010",
      text: "#ffffff",
    });
    expect(mergeAlertText(standard, null, LIME)).toEqual(standard);
    expect(mergeAlertText(null, null, LIME)).toBeNull();
  });

  test("colours that do not read on the creator's own card keep only the wording", () => {
    const standard = { bg: "#101010", text: "#ffffff" };
    // Dark text on the creator's dark card is unreadable: the wording stays, the colours do not.
    expect(mergeAlertText(standard, { headline: "{name}!", text: "#111111" }, LIME)).toEqual({
      headline: "{name}!",
      bg: "#101010",
      text: "#ffffff",
    });
  });

  test("a stored value is checked again: junk and unreadable colours are dropped", () => {
    expect(variationText({ headline: "{evil}", bg: "url(x)" }, null, LIME)).toBeNull();
    expect(variationText('{"headline":"{name} wow"}', null, LIME)).toEqual({ headline: "{name} wow" });
    // Text the same as the lime card: dropped, the rest kept.
    expect(variationText({ headline: "{name} wow", text: "#bfe84a" }, null, LIME)).toEqual({ headline: "{name} wow" });
  });
});

test.describe("the form", () => {
  const ctx = { base: LIME, standard: null, textOn: true };

  test("a good variation is stored as paise, ids and clean text", () => {
    const r = parseVariation({ minRupees: "500", mediaId: "3", soundId: 4, text: { headline: "{name} went big" } }, ctx);
    expect(r).toEqual({
      ok: true,
      value: { minPaise: 50_000, mediaId: 3, soundId: 4, staySeconds: null, text: { headline: "{name} went big" } },
    });
  });

  test("the size must be a whole rupee amount from ₹1", () => {
    for (const bad of ["", "abc", 0, -5, 1.5, 100_001]) {
      expect(parseVariation({ minRupees: bad, soundId: 1 }, ctx).ok, String(bad)).toBe(false);
    }
    expect(parseVariation({ minRupees: 1, soundId: 1 }, ctx).ok).toBe(true);
  });

  test("it must do something", () => {
    expect(parseVariation({ minRupees: 500 }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, text: { headline: "" } }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 1000, staySeconds: 30 }, ctx).ok).toBe(true);
  });

  test("a long stay only from ₹1,000 and within range", () => {
    expect(parseVariation({ minRupees: 999, staySeconds: 30 }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 1000, staySeconds: 9 }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 1000, staySeconds: 301 }, ctx)).toMatchObject({ ok: false });
  });

  test("ids must be real numbers", () => {
    expect(parseVariation({ minRupees: 500, mediaId: "x" }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, soundId: -1 }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, soundId: "" }, ctx)).toMatchObject({ ok: false });
  });

  test("text is refused when its own switch is off, and the headline rules apply", () => {
    expect(parseVariation({ minRupees: 500, soundId: 1, text: { headline: "{name}" } }, { ...ctx, textOn: false })).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, text: { headline: "no name here" } }, ctx)).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, text: { bg: "red" } }, ctx)).toMatchObject({ ok: false });
  });

  test("colours are judged on the card they sit on, next to the standard text", () => {
    // Fine alone on the lime card, unreadable on the creator's own dark card.
    const standard = { bg: "#101010", text: "#ffffff" };
    const r = parseVariation({ minRupees: 500, text: { text: "#111111" } }, { ...ctx, standard });
    expect(r).toMatchObject({ ok: false });
    expect(parseVariation({ minRupees: 500, text: { text: "#111111" } }, ctx).ok).toBe(true);
  });

  test("a bright amount is fine on the creator's dark card, though it would not read on the plain lime card", () => {
    const standard = { bg: "#101010", text: "#ffffff" };
    expect(parseVariation({ minRupees: 500, text: { amount: "#ffcc00" } }, { ...ctx, standard }).ok).toBe(true);
    expect(parseVariation({ minRupees: 500, text: { amount: "#ffcc00" } }, ctx).ok).toBe(false);
  });

  test("there is a cap on how many a creator keeps", () => {
    expect(MAX_VARIATIONS_PER_CREATOR).toBe(10);
  });
});

test.describe("what a fan's own choice always beats", () => {
  const list = [variation(1, 100, { sound: snd(1), mediaId: 7 })];
  const media = [file(7), file(8)];
  const raw = { ...base, media, sound: snd(9), variations: withVars(list, 500) };

  test("a plain tip gets the variation's media and sound", () => {
    const out = resolveAlertExtras({ ...raw, soundPicked: false }, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.sound).toEqual(snd(1));
    expect(out.media?.url).toContain("/f7.gif");
  });

  test("a tip that picked an alert rule gets no variation", () => {
    const rule: AlertRule = { id: 5, minPaise: 50_000, mediaId: 8, sound: snd(2) };
    const out = resolveAlertExtras(
      { ...raw, rules: [rule], pickedRuleId: 5, variations: withVars(list, 500, true) },
      { kind: "alert", features: ALL, tipId: 1 },
    );
    expect(out.sound).toEqual(snd(2));
    expect(out.media?.url).toContain("/f8.gif");
    // Even if the rule feature is off at play time, the pick still blocks the variation.
    const off = resolveAlertExtras(
      { ...raw, variations: withVars(list, 500, true), media: [file(8)] },
      { kind: "alert", features: ALL, tipId: 1 },
    );
    expect(off.sound).toEqual(snd(9));
  });

  test("a soundboard sound the fan picked beats the variation's sound, but its media still shows", () => {
    const out = resolveAlertExtras({ ...raw, soundPicked: true }, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.sound).toEqual(snd(9));
    expect(out.media?.url).toContain("/f7.gif");
  });

  test("a voice tip has no sound at all, not even the variation's", () => {
    const out = resolveAlertExtras({ ...raw, voiceRequested: true }, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.sound).toBeNull();
    expect(out.media?.url).toContain("/f7.gif");
  });

  test("a variation sound beats the creator's default sound", () => {
    const out = resolveAlertExtras(raw, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.sound).toEqual(snd(1));
    const none = resolveAlertExtras({ ...raw, variations: withVars([variation(1, 100)], 500) }, { kind: "alert", features: ALL, tipId: 1 });
    expect(none.sound).toEqual(snd(9));
  });
});

test.describe("each part follows its own switch at play time", () => {
  const list = [
    variation(1, 1000, {
      sound: snd(1),
      mediaId: 7,
      text: { headline: "{name} went huge {amount}", bg: "#101010", text: "#ffffff" },
      stayMs: 60_000,
    }),
  ];
  const raw = {
    ...base,
    media: [file(7), file(8)],
    sound: snd(9),
    alertText: { value: null, accent: "#bfe84a" },
    variations: withVars(list, 1500),
  };

  test("everything on: media, sound, text and stay all apply", () => {
    const out = resolveAlertExtras(raw, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.media?.url).toContain("/f7.gif");
    expect(out.sound).toEqual(snd(1));
    expect(out.text).toEqual({ headline: "{name} went huge {amount}", bg: "#101010", text: "#ffffff" });
    expect(out.stayMs).toBe(60_000);
  });

  test("the variations switch off: the normal alert whatever is stored", () => {
    const features = planFeatures({ paid_features: ["customAlertMedia", "alertText", "alertRules"] });
    const out = resolveAlertExtras(raw, { kind: "alert", features, tipId: 1 });
    expect(out.sound).toEqual(snd(9));
    expect(out.text).toBeNull();
    expect(out.stayMs).toBeNull();
    expect(resolveAlertExtras(raw, { kind: "alert", features: OFF }).text).toBeNull();
  });

  test("without the media switch the variation's file is not shown", () => {
    const features = planFeatures({ paid_features: ["alertVariations", "alertText"] });
    const out = resolveAlertExtras(raw, { kind: "alert", features, tipId: 1 });
    expect(out.media).toBeNull();
    expect(out.sound).toEqual(snd(1));
    expect(out.text?.headline).toBe("{name} went huge {amount}");
  });

  test("without the text switch the wording and colours are not used", () => {
    const features = planFeatures({ paid_features: ["alertVariations", "customAlertMedia"] });
    const out = resolveAlertExtras({ ...raw, alertText: undefined }, { kind: "alert", features, tipId: 1 });
    expect(out.text).toBeNull();
    expect(out.media?.url).toContain("/f7.gif");
  });

  test("a file that is not playable falls back to the normal rotation", () => {
    const out = resolveAlertExtras(
      { ...raw, media: [file(7, { review_state: "removed" }), file(8)] },
      { kind: "alert", features: ALL, tipId: 1 },
    );
    expect(out.media?.url).toContain("/f8.gif");
  });

  test("the message card wears the colours and wording, but has no sound, media or stay", () => {
    const out = resolveAlertExtras(raw, { kind: "message", features: ALL, tipId: 1 });
    expect(out.sound).toBeNull();
    expect(out.media).toBeNull();
    expect(out.stayMs).toBeNull();
    expect(out.text?.bg).toBe("#101010");
  });

  test("a tip below every size gets the standard alert", () => {
    const out = resolveAlertExtras({ ...raw, variations: withVars(list, 500) }, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.sound).toEqual(snd(9));
    expect(out.stayMs).toBeNull();
    expect(out.text).toBeNull();
  });

  test("a stay on a variation under the big-tip size is ignored even if stored", () => {
    const small = [variation(1, 500, { stayMs: 60_000 })];
    const out = resolveAlertExtras({ ...raw, variations: withVars(small, 600) }, { kind: "alert", features: ALL, tipId: 1 });
    expect(out.stayMs).toBeNull();
  });

  test("the variation's colours combine with the standard text, and are dropped if unreadable together", () => {
    const merged = resolveAlertExtras(
      {
        ...raw,
        alertText: { value: { bg: "#101010", text: "#ffffff" }, accent: "#bfe84a" },
        variations: withVars([variation(1, 1000, { text: { headline: "{name} wow", amount: "#ffcc00" } })], 1500),
      },
      { kind: "alert", features: ALL, tipId: 1 },
    );
    expect(merged.text).toEqual({ bg: "#101010", text: "#ffffff", headline: "{name} wow", amount: "#ffcc00" });
    const clash = resolveAlertExtras(
      {
        ...raw,
        alertText: { value: { bg: "#101010", text: "#ffffff" }, accent: "#bfe84a" },
        variations: withVars([variation(1, 1000, { text: { headline: "{name} wow", text: "#111111" } })], 1500),
      },
      { kind: "alert", features: ALL, tipId: 1 },
    );
    expect(clash.text).toEqual({ bg: "#101010", text: "#ffffff", headline: "{name} wow" });
  });

  test("the feature is built and listed with the alert box", () => {
    const f = FEATURES.find((x) => x.key === "alertVariations");
    expect(f?.built).toBe(true);
    expect(f?.group).toBe("Alert box");
    expect(VAR_ONLY.alertVariations).toBe(true);
  });
});

test("the loader reads variations for the tip's size, ignores a picked tip, and survives a missing table", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features)
     values ('g1','a@example.com','handle1','active', array['alertVariations','customAlertMedia','alertText','alertRules']) returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const m = await pg.query<{ id: string }>(
    `insert into creator_media (creator_id, kind, name, blob_url, mime, size_bytes, review_state)
     values ($1,'gif','big',$2,'image/gif',1000,'approved') returning id::text`,
    [creatorId, `https://x.public.blob.vercel-storage.com/media/${creatorId}/big.gif`],
  );
  const s = await pg.query<{ id: string }>(
    `insert into creator_sounds (creator_id, name, min_paise, volume, blob_url, duration_ms, size_bytes)
     values ($1,'horn',0,80,'https://x.public.blob.vercel-storage.com/sounds/1/horn.wav',900,1000) returning id::text`,
    [creatorId],
  );
  await pg.query(
    `insert into alert_variations (creator_id, min_paise, media_id, sound_id, text, stay_seconds)
     values ($1, 100000, $2, $3, '{"headline":"{name} went huge"}'::jsonb, 90),
            ($1, 20000, null, null, '{"headline":"{name} wow"}'::jsonb, null)`,
    [creatorId, Number(m.rows[0].id), Number(s.rows[0].id)],
  );
  // Constraints: a long stay under ₹1,000, a size under ₹1 and a duplicate size are refused.
  await expect(pg.query(`insert into alert_variations (creator_id, min_paise, stay_seconds) values ($1, 50000, 60)`, [creatorId])).rejects.toThrow();
  await expect(pg.query(`insert into alert_variations (creator_id, min_paise, text) values ($1, 50, '{}'::jsonb)`, [creatorId])).rejects.toThrow();
  await expect(pg.query(`insert into alert_variations (creator_id, min_paise, text) values ($1, 20000, '{}'::jsonb)`, [creatorId])).rejects.toThrow();

  const ruleId = Number(
    (await pg.query<{ id: string }>(`insert into alert_rules (creator_id, min_paise, sound_id) values ($1, 150000, $2) returning id::text`, [creatorId, Number(s.rows[0].id)])).rows[0].id,
  );
  const tip = async (paise: number, picked = false) => {
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, alert_rule_id) values ($1,$2,$3,'captured',$4) returning id::text`,
      [creatorId, `tip_${paise}_${picked}`, paise, picked ? ruleId : null],
    );
    return Number(t.rows[0].id);
  };
  const db = asLedgerDb(pg) as unknown as Sql;

  const big = await loadAlertExtras(db, { tipId: await tip(120_000), creatorId, kind: "alert" });
  expect(big.sound?.url).toContain("horn.wav");
  expect(big.media?.url).toContain("/big.gif");
  expect(big.text?.headline).toBe("{name} went huge");
  expect(big.stayMs).toBe(90_000);

  const mid = await loadAlertExtras(db, { tipId: await tip(30_000), creatorId, kind: "alert" });
  expect(mid.text?.headline).toBe("{name} wow");
  expect(mid.stayMs).toBeNull();

  const small = await loadAlertExtras(db, { tipId: await tip(5_000), creatorId, kind: "alert" });
  expect(small.text).toBeNull();

  // A tip that picked an alert rule gets the rule's effect and no variation text.
  const picked = await loadAlertExtras(db, { tipId: await tip(150_000, true), creatorId, kind: "alert" });
  expect(picked.text).toBeNull();
  expect(picked.stayMs).toBeNull();

  // A hand-edited row with junk plays as the standard alert.
  await pg.query(`update alert_variations set text = '{"headline":"{evil}","bg":"url(x)"}'::jsonb where min_paise = 20000`);
  expect((await loadAlertExtras(db, { tipId: await tip(31_000), creatorId, kind: "alert" })).text).toBeNull();

  // Deleting the file clears it from the variation; the tip plays on.
  await pg.query(`delete from creator_media where id = $1`, [Number(m.rows[0].id)]);
  const afterDelete = await loadAlertExtras(db, { tipId: await tip(121_000), creatorId, kind: "alert" });
  expect(afterDelete.media).toBeNull();
  expect(afterDelete.text?.headline).toBe("{name} went huge");

  await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
  const off = await loadAlertExtras(db, { tipId: await tip(122_000), creatorId, kind: "alert" });
  expect(off.sound).toBeNull();
  expect(off.text).toBeNull();
  expect(off.stayMs).toBeNull();

  // Migration 0046 not run yet: the alert still plays, standard.
  await pg.query(`update users set paid_features = array['alertVariations','alertText'] where id = $1`, [creatorId]);
  await pg.query(`drop table alert_variations`);
  const missing = await loadAlertExtras(db, { tipId: await tip(123_000), creatorId, kind: "alert" });
  expect(missing.text).toBeNull();
  expect(missing.voiceRequested).toBe(false);
});
