import { expect, test } from "@playwright/test";
import { planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import { checkRulePick, parseRuleRupees, parseStaySeconds, ruleHasEffect, type AlertRule } from "../src/lib/alert-rules";
import type { MediaCandidate } from "../src/lib/media";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert rules (phase 2, feature 2): a rule applies only to a tip whose fan picked it on the tip
// page, who wins between a rule's sound and a sound pick, and the switches checked at play time.

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

test.describe("picking a rule on the tip page", () => {
  const ok = { featureOn: true, rule: { min_paise: 5000 }, amountPaise: 5000, message: null, hasSound: false, voice: false };

  test("a pick at the rule's own amount, with no message, sound or voice, is fine", () => {
    expect(checkRulePick(ok)).toBeNull();
    expect(checkRulePick({ ...ok, message: "   " })).toBeNull();
  });

  test("refused when the switch is off, the rule is gone or the amount is not the rule's", () => {
    expect(checkRulePick({ ...ok, featureOn: false })).toMatch(/no longer available/);
    expect(checkRulePick({ ...ok, rule: undefined })).toMatch(/no longer available/);
    expect(checkRulePick({ ...ok, amountPaise: 6000 })).toMatch(/exactly ₹50/);
    expect(checkRulePick({ ...ok, amountPaise: 4000 })).toMatch(/exactly ₹50/);
  });

  test("a pick never comes with a message, a soundboard sound or the voice", () => {
    expect(checkRulePick({ ...ok, message: "hi" })).toMatch(/without a message/);
    expect(checkRulePick({ ...ok, hasSound: true })).toMatch(/not more than one/);
    expect(checkRulePick({ ...ok, voice: true })).toMatch(/not more than one/);
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

test.describe("how long a big tip stays on screen", () => {
  test("a stay is whole seconds from 10 to 300, and only from ₹1,000 up", () => {
    expect(parseStaySeconds(null, 500)).toBeNull();
    expect(parseStaySeconds("", 500)).toBeNull();
    expect(parseStaySeconds(300, 1000)).toBe(300);
    expect(parseStaySeconds("60", 5000)).toBe(60);
    expect(parseStaySeconds(60, 999)).toBeUndefined();
    for (const bad of [9, 301, 1.5, "abc", -5]) expect(parseStaySeconds(bad, 5000)).toBeUndefined();
  });

  test("the alert carries the rule's stay, and none without a rule or with the switch off", () => {
    const ctx = { kind: "alert" as const, features: RULES_ONLY, tipId: 7 };
    const withStay = { ...base, pickedRuleId: 1, rules: [rule(1, 1000, { stayMs: 120_000 })] };
    expect(resolveAlertExtras(withStay, ctx).stayMs).toBe(120_000);
    expect(resolveAlertExtras({ ...base, pickedRuleId: 1, rules: [rule(1, 1000)] }, ctx).stayMs).toBeNull();
    expect(resolveAlertExtras({ ...withStay, pickedRuleId: null }, ctx).stayMs).toBeNull();
    expect(resolveAlertExtras(withStay, { ...ctx, features: OFF }).stayMs).toBeNull();
    expect(resolveAlertExtras(withStay, { ...ctx, kind: "message" }).stayMs).toBeNull();
  });
});

test.describe("what the alert carries", () => {
  const ctx = { kind: "alert" as const, features: BOTH, tipId: 7 };

  test("a rule's sound replaces the default sound", () => {
    const out = resolveAlertExtras({ ...base, sound: snd(1), pickedRuleId: 1, rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(out.sound?.url).toBe("https://b/s2.wav");
  });

  test("the fan's own pick beats the rule's sound", () => {
    const out = resolveAlertExtras(
      { ...base, sound: snd(1), soundPicked: true, pickedRuleId: 1, rules: [rule(1, 500, { sound: snd(2) })] },
      ctx,
    );
    expect(out.sound?.url).toBe("https://b/s1.wav");
  });

  test("a rule gives a sound even when the creator has no default", () => {
    const out = resolveAlertExtras({ ...base, pickedRuleId: 1, rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(out.sound?.url).toBe("https://b/s2.wav");
  });

  test("a rule's media plays instead of the rotation", () => {
    const out = resolveAlertExtras(
      { ...base, media: [file(1), file(2)], pickedRuleId: 1, rules: [rule(1, 500, { mediaId: 2 })] },
      ctx,
    );
    expect(out.media?.url).toContain("/f2.gif");
  });

  test("a rule whose media is not playable falls back to the rotation", () => {
    const out = resolveAlertExtras(
      { ...base, media: [file(1), file(2, { enabled: false })], pickedRuleId: 1, rules: [rule(1, 500, { mediaId: 2 })] },
      ctx,
    );
    expect(out.media?.url).toContain("/f1.gif");
  });

  test("a voice tip keeps the rule's media but plays no sound", () => {
    const out = resolveAlertExtras(
      { ...base, voiceRequested: true, media: [file(2)], pickedRuleId: 1, rules: [rule(1, 500, { mediaId: 2, sound: snd(2) })] },
      ctx,
    );
    expect(out.sound).toBeNull();
    expect(out.media?.url).toContain("/f2.gif");
  });

  test("a tip that picked no rule plays as normal, whatever its amount", () => {
    const out = resolveAlertExtras({ ...base, sound: snd(1), rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(out.sound?.url).toBe("https://b/s1.wav");
    const other = resolveAlertExtras({ ...base, sound: snd(1), pickedRuleId: 9, rules: [rule(1, 500, { sound: snd(2) })] }, ctx);
    expect(other.sound?.url).toBe("https://b/s1.wav");
  });
});

test.describe("the switches are checked at play time", () => {
  const rules = [rule(1, 0, { mediaId: 2, sound: snd(2) })];
  const picked = { pickedRuleId: 1 };

  test("rules off: the default sound and the plain rotation", () => {
    const out = resolveAlertExtras(
      { ...base, ...picked, sound: snd(1), media: [file(1), file(2)], rules },
      { kind: "alert", features: planFeatures({ paid_features: ["customAlertMedia"] }), tipId: 2 },
    );
    expect(out.sound?.url).toBe("https://b/s1.wav");
    expect(out.media?.url).toContain("/f1.gif");
  });

  test("media off: the rule's sound still plays, no media", () => {
    const out = resolveAlertExtras(
      { ...base, ...picked, media: [file(2)], rules },
      { kind: "alert", features: RULES_ONLY, tipId: 2 },
    );
    expect(out.sound?.url).toBe("https://b/s2.wav");
    expect(out.media).toBeNull();
  });

  test("everything off: the plain card", () => {
    const out = resolveAlertExtras({ ...base, ...picked, media: [file(2)], rules }, { kind: "alert", features: OFF, tipId: 2 });
    expect(out.sound).toBeNull();
    expect(out.media).toBeNull();
  });

  test("the follow-up message card never gets a rule", () => {
    const out = resolveAlertExtras({ ...base, ...picked, media: [file(2)], rules }, { kind: "message", features: BOTH, tipId: 2 });
    expect(out.sound).toBeNull();
    expect(out.media).toBeNull();
  });
});

test("the loader applies a rule only to the tip that picked it (migration 0043)", async () => {
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
  const ruleId = Number((await pg.query<{ id: string }>(`select id::text from alert_rules where creator_id = $1`, [creatorId])).rows[0].id);
  const tip = async (paise: number, picked = false) => {
    const t = await pg.query<{ id: string }>(
      `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, alert_rule_id) values ($1,$2,$3,'captured',$4) returning id::text`,
      [creatorId, `tip_${paise}_${picked}`, paise, picked ? ruleId : null],
    );
    return Number(t.rows[0].id);
  };
  const db = asLedgerDb(pg) as unknown as Sql;

  const big = await loadAlertExtras(db, { tipId: await tip(50_000, true), creatorId, kind: "alert" });
  expect(big.sound?.url).toContain("horn.wav");
  expect(big.media?.url).toContain("/big.gif");

  // A big tip that did not pick the rule plays as a normal alert: no overlap with a soundboard or voice tip.
  const small = await loadAlertExtras(db, { tipId: await tip(60_000), creatorId, kind: "alert" });
  expect(small.sound).toBeNull();
  // The creator's media still rotates in without a rule.
  expect(small.media?.url).toContain("/big.gif");

  await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
  const off = await loadAlertExtras(db, { tipId: await tip(70_000, true), creatorId, kind: "alert" });
  expect(off.sound).toBeNull();
  expect(off.media).toBeNull();
});

test("migration 0042: the loader reads a rule's stay, and the database refuses a small tip or a stay over 5 minutes", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features)
     values ('g2','b@example.com','handle2','active', array['alertRules']) returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const rid = (await pg.query<{ id: string }>(`insert into alert_rules (creator_id, min_paise, stay_seconds) values ($1, 100000, 120) returning id::text`, [creatorId])).rows[0].id;
  await expect(pg.query(`insert into alert_rules (creator_id, min_paise, stay_seconds) values ($1, 50000, 60)`, [creatorId])).rejects.toThrow();
  await expect(pg.query(`insert into alert_rules (creator_id, min_paise, stay_seconds) values ($1, 200000, 301)`, [creatorId])).rejects.toThrow();

  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, alert_rule_id) values ($1,'tip_big',100000,'captured',$2) returning id::text`,
    [creatorId, Number(rid)],
  );
  const db = asLedgerDb(pg) as unknown as Sql;
  const out = await loadAlertExtras(db, { tipId: Number(t.rows[0].id), creatorId, kind: "alert" });
  expect(out.stayMs).toBe(120_000);
});
