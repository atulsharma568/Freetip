import { expect, test } from "@playwright/test";
import { planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import { parseRuleRupees, resolveRule, ruleHasEffect, type AlertRule } from "../src/lib/alert-rules";
import type { MediaCandidate } from "../src/lib/media";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert rules by tip size (phase 2, feature 2): which rule a tip gets, who wins
// between a rule's sound and the fan's own pick, and the switches checked at play time.

const BOTH = planFeatures({ paid_features: ["alertRules", "customAlertMedia"] });
const RULES_ONLY = planFeatures({ paid_features: ["alertRules"] });
const OFF = planFeatures(null);

const snd = (n: number) => ({ url: `https://b/s${n}.wav`, volume: 80, ms: 900 });
const rule = (id: number, rupees: number, over: Partial<AlertRule> = {}): AlertRule => ({
  id,
  minPaise: rupees * 100,
  mediaId: null,
  sound: null,
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

test.describe("which rule a tip gets", () => {
  const rules = [rule(1, 100), rule(2, 500), rule(3, 0)];

  test("the highest size at or below the tip", () => {
    expect(resolveRule(rules, 50_000)?.id).toBe(2);
    expect(resolveRule(rules, 49_999)?.id).toBe(1);
    expect(resolveRule(rules, 10_000)?.id).toBe(1);
    expect(resolveRule(rules, 100)?.id).toBe(3);
  });

  test("no rule when none reaches the tip, or there are none", () => {
    expect(resolveRule([rule(1, 100)], 9_999)).toBeNull();
    expect(resolveRule([], 5000)).toBeNull();
  });

  test("rupees are whole numbers within range", () => {
    expect(parseRuleRupees("500")).toBe(500);
    expect(parseRuleRupees(0)).toBe(0);
    for (const bad of ["", "abc", -1, 1.5, 100_001, null, undefined]) expect(parseRuleRupees(bad)).toBeNull();
    expect(ruleHasEffect(null, null)).toBe(false);
    expect(ruleHasEffect(3, null)).toBe(true);
    expect(ruleHasEffect(null, 4)).toBe(true);
  });
});

test.describe("what the alert carries", () => {
  const ctx = { kind: "alert" as const, features: BOTH, tipId: 7, amountPaise: 60_000 };

  test("a rule's sound replaces the default sound", () => {
    const out = resolveAlertExtras({ ...base, sound: snd(1), rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(out.sound?.url).toBe("https://b/s2.wav");
  });

  test("the fan's own pick beats the rule's sound", () => {
    const out = resolveAlertExtras(
      { ...base, sound: snd(1), soundPicked: true, rules: [rule(1, 500, { sound: snd(2) })] },
      ctx,
    );
    expect(out.sound?.url).toBe("https://b/s1.wav");
  });

  test("a rule gives a sound even when the creator has no default", () => {
    const out = resolveAlertExtras({ ...base, rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(out.sound?.url).toBe("https://b/s2.wav");
  });

  test("a rule's media plays instead of the rotation", () => {
    const out = resolveAlertExtras(
      { ...base, media: [file(1), file(2)], rules: [rule(1, 500, { mediaId: 2 })] },
      ctx,
    );
    expect(out.media?.url).toContain("/f2.gif");
  });

  test("a rule whose media is not playable falls back to the rotation", () => {
    const out = resolveAlertExtras(
      { ...base, media: [file(1), file(2, { enabled: false })], rules: [rule(1, 500, { mediaId: 2 })] },
      ctx,
    );
    expect(out.media?.url).toContain("/f1.gif");
  });

  test("a voice tip keeps the rule's media but plays no sound", () => {
    const out = resolveAlertExtras(
      { ...base, voiceRequested: true, media: [file(2)], rules: [rule(1, 500, { mediaId: 2, sound: snd(2) })] },
      ctx,
    );
    expect(out.sound).toBeNull();
    expect(out.media?.url).toContain("/f2.gif");
  });

  test("a tip below every rule plays as normal", () => {
    const out = resolveAlertExtras(
      { ...base, sound: snd(1), rules: [rule(1, 500, { sound: snd(2) })] },
      { ...ctx, amountPaise: 10_000 },
    );
    expect(out.sound?.url).toBe("https://b/s1.wav");
  });
});

test.describe("the switches are checked at play time", () => {
  const rules = [rule(1, 0, { mediaId: 2, sound: snd(2) })];

  test("rules off: the default sound and the plain rotation", () => {
    const out = resolveAlertExtras(
      { ...base, sound: snd(1), media: [file(1), file(2)], rules },
      { kind: "alert", features: planFeatures({ paid_features: ["customAlertMedia"] }), tipId: 2, amountPaise: 5000 },
    );
    expect(out.sound?.url).toBe("https://b/s1.wav");
    expect(out.media?.url).toContain("/f1.gif");
  });

  test("media off: the rule's sound still plays, no media", () => {
    const out = resolveAlertExtras(
      { ...base, media: [file(2)], rules },
      { kind: "alert", features: RULES_ONLY, tipId: 2, amountPaise: 5000 },
    );
    expect(out.sound?.url).toBe("https://b/s2.wav");
    expect(out.media).toBeNull();
  });

  test("everything off: the plain card", () => {
    const out = resolveAlertExtras({ ...base, media: [file(2)], rules }, { kind: "alert", features: OFF, tipId: 2, amountPaise: 5000 });
    expect(out.sound).toBeNull();
    expect(out.media).toBeNull();
  });

  test("the follow-up message card never gets a rule", () => {
    const out = resolveAlertExtras({ ...base, media: [file(2)], rules }, { kind: "message", features: BOTH, tipId: 2, amountPaise: 5000 });
    expect(out.sound).toBeNull();
    expect(out.media).toBeNull();
  });
});

test("the loader applies the creator's rules to the tip's amount", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features)
     values ('g1','a@example.com','handle1','active', array['alertRules','customAlertMedia']) returning id::text`,
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
  await pg.query(`insert into alert_rules (creator_id, min_paise, media_id, sound_id) values ($1, 50000, $2, $3)`, [
    creatorId,
    Number(m.rows[0].id),
    Number(s.rows[0].id),
  ]);
  const tip = async (paise: number) => {
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,$2,$3,'captured') returning id::text`,
      [creatorId, `tip_${paise}`, paise],
    );
    return Number(t.rows[0].id);
  };
  const db = asLedgerDb(pg) as unknown as Sql;

  const big = await loadAlertExtras(db, { tipId: await tip(60_000), creatorId, kind: "alert" });
  expect(big.sound?.url).toContain("horn.wav");
  expect(big.media?.url).toContain("/big.gif");

  const small = await loadAlertExtras(db, { tipId: await tip(10_000), creatorId, kind: "alert" });
  expect(small.sound).toBeNull();
  // The creator's media still rotates in without a rule.
  expect(small.media?.url).toContain("/big.gif");

  await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
  const off = await loadAlertExtras(db, { tipId: await tip(70_000), creatorId, kind: "alert" });
  expect(off.sound).toBeNull();
  expect(off.media).toBeNull();
});
