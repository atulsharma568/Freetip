import { expect, test } from "@playwright/test";
import { FEATURES, planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import {
  GAP_MAX_SECONDS,
  LENGTH_MAX_SECONDS,
  LENGTH_MIN_SECONDS,
  motionGapMs,
  motionStayMs,
  parseAlertMotion,
  resolveAlertMotion,
} from "../src/lib/alert-motion";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert animations and timing (alert studio, item 2): what the creator may pick, what is
// refused, what the card gets, and the switch checked at play time.

const ON = planFeatures({ paid_features: ["alertMotion"] });
const OFF = planFeatures(null);
const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };

test.describe("what the creator may pick", () => {
  test("nothing changed is the normal card", () => {
    expect(parseAlertMotion({})).toEqual({ ok: true, value: null });
    expect(parseAlertMotion({ enter: "", exit: "", seconds: "", gap: "" })).toEqual({ ok: true, value: null });
    // The wipe is the normal card, so choosing it stores nothing.
    expect(parseAlertMotion({ enter: "wipe", exit: "wipe", seconds: null, gap: "0" })).toEqual({ ok: true, value: null });
  });

  test("good picks are kept, numbers as numbers", () => {
    expect(parseAlertMotion({ enter: "zoom", exit: "fade", seconds: "12", gap: "5" })).toEqual({
      ok: true,
      value: { enter: "zoom", exit: "fade", seconds: 12, gap: 5 },
    });
    expect(parseAlertMotion({ enter: "bounce", seconds: 30 })).toEqual({ ok: true, value: { enter: "bounce", seconds: 30 } });
  });

  test("an animation outside the lists is refused", () => {
    expect(parseAlertMotion({ enter: "spin" }).ok).toBe(false);
    expect(parseAlertMotion({ exit: "bounce" }).ok).toBe(false); // bounce only comes in
    expect(parseAlertMotion({ enter: 3 }).ok).toBe(false);
    expect(parseAlertMotion({ enter: "fade; background:url(x)" }).ok).toBe(false);
  });

  test("the length and the pause stay in range and are whole numbers", () => {
    expect(parseAlertMotion({ seconds: LENGTH_MIN_SECONDS - 1 }).ok).toBe(false);
    expect(parseAlertMotion({ seconds: LENGTH_MAX_SECONDS + 1 }).ok).toBe(false);
    expect(parseAlertMotion({ seconds: LENGTH_MIN_SECONDS }).ok).toBe(true);
    expect(parseAlertMotion({ seconds: LENGTH_MAX_SECONDS }).ok).toBe(true);
    expect(parseAlertMotion({ seconds: "7.5" }).ok).toBe(false);
    expect(parseAlertMotion({ seconds: "abc" }).ok).toBe(false);
    expect(parseAlertMotion({ gap: GAP_MAX_SECONDS + 1 }).ok).toBe(false);
    expect(parseAlertMotion({ gap: -1 }).ok).toBe(false);
    expect(parseAlertMotion({ gap: GAP_MAX_SECONDS }).ok).toBe(true);
  });
});

test.describe("reading a stored value", () => {
  test("each field is checked on its own and junk is dropped", () => {
    expect(resolveAlertMotion({ enter: "zoom", exit: "spin", seconds: 9, gap: 99 })).toEqual({ enter: "zoom", seconds: 9 });
    expect(resolveAlertMotion({ enter: "wipe", exit: "wipe", seconds: 4, gap: 0 })).toBeNull();
    expect(resolveAlertMotion({ seconds: "10" })).toBeNull(); // stored numbers only
  });

  test("not an object, or text from a driver", () => {
    expect(resolveAlertMotion(null)).toBeNull();
    expect(resolveAlertMotion("not json")).toBeNull();
    expect(resolveAlertMotion([1, 2])).toBeNull();
    expect(resolveAlertMotion(7)).toBeNull();
    expect(resolveAlertMotion('{"enter":"fade","gap":3}')).toEqual({ enter: "fade", gap: 3 });
  });

  test("length and pause in milliseconds", () => {
    expect(motionStayMs({ seconds: 12 })).toBe(12000);
    expect(motionStayMs({ enter: "fade" })).toBeNull();
    expect(motionStayMs(null)).toBeNull();
    expect(motionGapMs({ gap: 5 })).toBe(5000);
    expect(motionGapMs({ seconds: 8 })).toBe(0);
    expect(motionGapMs(undefined)).toBe(0);
  });
});

test.describe("the switch is checked at play time", () => {
  const stored = { enter: "bounce", exit: "slide", seconds: 12, gap: 3 };

  test("on: both cards get the motion", () => {
    expect(resolveAlertExtras({ ...base, alertMotion: stored }, { kind: "alert", features: ON }).motion).toEqual(stored);
    expect(resolveAlertExtras({ ...base, alertMotion: stored }, { kind: "message", features: ON }).motion).toEqual(stored);
  });

  test("off: the normal card, whatever is stored", () => {
    expect(resolveAlertExtras({ ...base, alertMotion: stored }, { kind: "alert", features: OFF }).motion).toBeNull();
  });

  test("on but never set: the normal card", () => {
    expect(resolveAlertExtras(base, { kind: "alert", features: ON }).motion).toBeNull();
    expect(resolveAlertExtras({ ...base, alertMotion: null }, { kind: "alert", features: ON }).motion).toBeNull();
  });

  test("the feature is built and listed with the alert box", () => {
    const f = FEATURES.find((x) => x.key === "alertMotion");
    expect(f?.built).toBe(true);
    expect(f?.group).toBe("Alert box");
  });
});

test("the loader reads the creator's motion only while the switch is on, and survives a missing column", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, alert_motion)
     values ('g1','a@example.com','handle1','active', array['alertMotion'], '{"enter":"zoom","seconds":10}'::jsonb) returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
    [creatorId],
  );
  const tipId = Number(t.rows[0].id);
  const db = asLedgerDb(pg) as unknown as Sql;

  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).motion).toEqual({ enter: "zoom", seconds: 10 });

  // A hand-edited row with junk plays as the normal card, not an error.
  await pg.query(`update users set alert_motion = '{"enter":"x","seconds":9999,"gap":-2}'::jsonb where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).motion).toBeNull();

  await pg.query(`update users set alert_motion = '{"exit":"fade"}'::jsonb, paid_features = '{}' where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).motion).toBeNull();

  // Migration 0045 not run yet: the alert still plays, normal.
  await pg.query(`update users set paid_features = array['alertMotion'] where id = $1`, [creatorId]);
  await pg.query(`alter table users drop column alert_motion`);
  const missing = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(missing.motion).toBeNull();
  expect(missing.voiceRequested).toBe(false);
});
