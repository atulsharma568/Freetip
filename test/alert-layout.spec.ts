import { expect, test } from "@playwright/test";
import { FEATURES, planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import {
  VOLUME_MAX_PERCENT,
  VOLUME_MIN_PERCENT,
  mixVolume,
  parseAlertLayout,
  resolveAlertLayout,
} from "../src/lib/alert-layout";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert volume and layout (alert studio, item 4): what the creator may pick, what is refused,
// what the overlay gets, and the switch checked at play time.

const ON = planFeatures({ paid_features: ["alertLayout"] });
const OFF = planFeatures(null);
const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };

test.describe("what the creator may pick", () => {
  test("nothing changed is the normal alert", () => {
    expect(parseAlertLayout({})).toEqual({ ok: true, value: null });
    expect(parseAlertLayout({ side: "", soundVolume: "", voiceVolume: "" })).toEqual({ ok: true, value: null });
    // Above the card and 100 percent are the normal alert, so nothing is stored.
    expect(parseAlertLayout({ side: "above", soundVolume: "100", voiceVolume: 100 })).toEqual({ ok: true, value: null });
  });

  test("good picks are kept, percentages as numbers", () => {
    expect(parseAlertLayout({ side: "left", soundVolume: "50", voiceVolume: 25 })).toEqual({
      ok: true,
      value: { side: "left", soundVolume: 50, voiceVolume: 25 },
    });
    expect(parseAlertLayout({ side: "right" })).toEqual({ ok: true, value: { side: "right" } });
  });

  test("a side outside the list is refused", () => {
    expect(parseAlertLayout({ side: "top" }).ok).toBe(false);
    expect(parseAlertLayout({ side: 3 }).ok).toBe(false);
    expect(parseAlertLayout({ side: "left; x" }).ok).toBe(false);
  });

  test("the volume stays in range, whole numbers, and never above normal", () => {
    expect(parseAlertLayout({ soundVolume: VOLUME_MIN_PERCENT - 1 }).ok).toBe(false);
    expect(parseAlertLayout({ soundVolume: VOLUME_MAX_PERCENT + 1 }).ok).toBe(false);
    expect(parseAlertLayout({ soundVolume: 150 }).ok).toBe(false);
    expect(parseAlertLayout({ voiceVolume: "7.5" }).ok).toBe(false);
    expect(parseAlertLayout({ voiceVolume: "loud" }).ok).toBe(false);
    expect(parseAlertLayout({ voiceVolume: VOLUME_MIN_PERCENT }).ok).toBe(true);
  });
});

test.describe("reading a stored value", () => {
  test("each field is checked on its own and junk is dropped", () => {
    expect(resolveAlertLayout({ side: "left", soundVolume: 500, voiceVolume: 40 })).toEqual({ side: "left", voiceVolume: 40 });
    expect(resolveAlertLayout({ side: "up", soundVolume: 5, voiceVolume: 100 })).toBeNull();
    expect(resolveAlertLayout({ soundVolume: "50" })).toBeNull(); // stored numbers only
  });

  test("not an object, or text from a driver", () => {
    expect(resolveAlertLayout(null)).toBeNull();
    expect(resolveAlertLayout("not json")).toBeNull();
    expect(resolveAlertLayout([1])).toBeNull();
    expect(resolveAlertLayout('{"side":"right","soundVolume":60}')).toEqual({ side: "right", soundVolume: 60 });
  });

  test("the volume a sound plays at is its own level times the master, never above its own", () => {
    expect(mixVolume(0.8, undefined)).toBe(0.8);
    expect(mixVolume(0.8, 50)).toBe(0.4);
    expect(mixVolume(1, 25)).toBe(0.25);
    expect(mixVolume(0.05, undefined)).toBe(0.1); // the old floor for a sound's own level
    expect(mixVolume(2, 100)).toBe(1);
    expect(mixVolume(1, 500)).toBe(1); // a master above 100 never makes it louder
    expect(mixVolume(1, 0)).toBe(0.1); // a master below the range is held at the minimum
  });
});

test.describe("the switch is checked at play time", () => {
  const stored = { side: "right", soundVolume: 60, voiceVolume: 40 };

  test("on: both cards get the layout", () => {
    expect(resolveAlertExtras({ ...base, alertLayout: stored }, { kind: "alert", features: ON }).layout).toEqual(stored);
    expect(resolveAlertExtras({ ...base, alertLayout: stored }, { kind: "message", features: ON }).layout).toEqual(stored);
  });

  test("off: the normal alert, whatever is stored", () => {
    expect(resolveAlertExtras({ ...base, alertLayout: stored }, { kind: "alert", features: OFF }).layout).toBeNull();
  });

  test("on but never set: the normal alert", () => {
    expect(resolveAlertExtras(base, { kind: "alert", features: ON }).layout).toBeNull();
  });

  test("the feature is built and listed with the alert box", () => {
    const f = FEATURES.find((x) => x.key === "alertLayout");
    expect(f?.built).toBe(true);
    expect(f?.group).toBe("Alert box");
  });
});

test("the loader reads the creator's layout only while the switch is on, and survives a missing column", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, alert_layout)
     values ('g1','a@example.com','handle1','active', array['alertLayout'], '{"side":"left","voiceVolume":50}'::jsonb) returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
    [creatorId],
  );
  const tipId = Number(t.rows[0].id);
  const db = asLedgerDb(pg) as unknown as Sql;

  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).layout).toEqual({ side: "left", voiceVolume: 50 });

  // A hand-edited row with junk plays as the normal alert, not an error.
  await pg.query(`update users set alert_layout = '{"side":"x","soundVolume":9999}'::jsonb where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).layout).toBeNull();

  await pg.query(`update users set alert_layout = '{"side":"left"}'::jsonb, paid_features = '{}' where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).layout).toBeNull();

  // Migration 0047 not run yet: the alert still plays, normal.
  await pg.query(`update users set paid_features = array['alertLayout'] where id = $1`, [creatorId]);
  await pg.query(`alter table users drop column alert_layout`);
  const missing = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(missing.layout).toBeNull();
  expect(missing.voiceRequested).toBe(false);
});
