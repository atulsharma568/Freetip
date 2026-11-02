import { expect, test } from "@playwright/test";
import { DEFAULT_TTS_FLOOR_PAISE, effectiveTtsMinPaise, getTtsFloorPaise, parseFloorRupees } from "../src/lib/site-settings";
import { tipExtraColumns } from "../src/lib/tip-extras";
import { checkVoicePick } from "../src/lib/tts-rules";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The owner's voice floor (migration 0043): the smallest tip that may be read aloud, whatever
// the creator chose. It starts at ₹50.

test("the floor is ₹50 by default and the creator can only go higher", () => {
  expect(DEFAULT_TTS_FLOOR_PAISE).toBe(5000);
  expect(effectiveTtsMinPaise(4900, 5000)).toBe(5000);
  expect(effectiveTtsMinPaise(10_000, 5000)).toBe(10_000);
  expect(effectiveTtsMinPaise(4900, 0)).toBe(4900);
});

test("the owner types whole rupees from 0 to 10,000", () => {
  expect(parseFloorRupees("50")).toBe(50);
  expect(parseFloorRupees(" 0 ")).toBe(0);
  for (const bad of ["", "abc", "-1", "10001", "1.5x"]) expect(parseFloorRupees(bad)).toBeNull();
});

test("a voice pick below the floor is refused", () => {
  const input = { platformOn: true, creatorEnabled: true, amountPaise: 4000, message: "hi", hasSound: false };
  expect(checkVoicePick({ ...input, minPaise: effectiveTtsMinPaise(2000, 5000) })).toMatch(/₹50/);
  expect(checkVoicePick({ ...input, amountPaise: 5000, minPaise: effectiveTtsMinPaise(2000, 5000) })).toBeNull();
});

test("a rule pick is saved on the tip as alert_rule_id, and nothing else is added for a plain tip", () => {
  expect(tipExtraColumns({ soundId: null, voice: false, ruleId: 7 })).toEqual({ alert_rule_id: 7 });
  expect(tipExtraColumns({ soundId: null, voice: false })).toEqual({});
});

test("migration 0043: no row means ₹50, a saved row wins, a bad value falls back", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg) as never;
  expect(await getTtsFloorPaise(db)).toBe(5000);
  await pg.query(`insert into site_settings (key, value) values ('tts_floor_paise', '10000')`);
  expect(await getTtsFloorPaise(db)).toBe(10_000);
  await pg.query(`update site_settings set value = '0' where key = 'tts_floor_paise'`);
  expect(await getTtsFloorPaise(db)).toBe(0);
  await pg.query(`update site_settings set value = 'junk' where key = 'tts_floor_paise'`);
  expect(await getTtsFloorPaise(db)).toBe(5000);
});
