import { expect, test } from "@playwright/test";
import { FEATURES, planFeatures } from "../src/lib/plans";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import {
  DEFAULT_FONT,
  DEFAULT_THEME,
  FONTS,
  THEMES,
  isFontKey,
  isThemeKey,
  overlayStyleVars,
  resolveOverlayStyle,
  safeFont,
  safeTheme,
} from "../src/lib/overlay-themes";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Overlay themes and fonts (phase 2, feature 3): the fixed lists, what an unknown key
// means, and the switch checked at play time.

const ON = planFeatures({ paid_features: ["overlayThemes"] });
const OFF = planFeatures(null);
const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };

test.describe("the fixed lists", () => {
  test("the default is first and every key is unique and recognised", () => {
    expect(THEMES[0].key).toBe(DEFAULT_THEME);
    expect(FONTS[0].key).toBe(DEFAULT_FONT);
    expect(new Set(THEMES.map((t) => t.key)).size).toBe(THEMES.length);
    expect(new Set(FONTS.map((f) => f.key)).size).toBe(FONTS.length);
    for (const t of THEMES) expect(isThemeKey(t.key)).toBe(true);
    for (const f of FONTS) expect(isFontKey(f.key)).toBe(true);
  });

  test("anything else is not a key", () => {
    for (const bad of ["", "Classic", "neon ", "<script>", null, undefined, 3, {}]) {
      expect(isThemeKey(bad)).toBe(false);
      expect(isFontKey(bad)).toBe(false);
    }
  });

  test("an unknown key means the default", () => {
    expect(safeTheme("gone")).toBe(DEFAULT_THEME);
    expect(safeTheme(null)).toBe(DEFAULT_THEME);
    expect(safeFont("comic-sans")).toBe(DEFAULT_FONT);
    expect(safeFont(undefined)).toBe(DEFAULT_FONT);
    expect(safeTheme("neon")).toBe("neon");
  });

  test("a theme only sets card variables, and only ones the card reads", () => {
    for (const t of THEMES) {
      for (const [name, value] of Object.entries(t.vars)) {
        expect(name).toMatch(/^--c-[a-z-]+$/);
        // No url(), no expressions that could pull in anything from outside.
        expect(value).not.toMatch(/url\(|;|\{|\}/);
      }
    }
  });

  test("every font names a variable the loader sets", () => {
    for (const f of FONTS) {
      if (f.cssVar) expect(f.cssVar).toMatch(/^--font-ov-[a-z]+$/);
      expect(f.scale).toBeGreaterThan(0.5);
      expect(f.scale).toBeLessThan(1.5);
    }
  });
});

test.describe("what the card gets", () => {
  test("both defaults is the plain card: no style at all", () => {
    expect(resolveOverlayStyle({ theme: "classic", font: "default" })).toBeNull();
    expect(resolveOverlayStyle(null)).toBeNull();
    expect(resolveOverlayStyle({ theme: "nope", font: "nope" })).toBeNull();
    expect(overlayStyleVars(null)).toEqual({});
  });

  test("a theme or a font alone is a style, and a bad half falls back", () => {
    expect(resolveOverlayStyle({ theme: "neon", font: "default" })).toEqual({ theme: "neon", font: "default" });
    expect(resolveOverlayStyle({ theme: "classic", font: "pixel" })).toEqual({ theme: "classic", font: "pixel" });
    expect(resolveOverlayStyle({ theme: "neon", font: "nope" })).toEqual({ theme: "neon", font: "default" });
  });

  test("the variables carry the theme and the font", () => {
    const vars = overlayStyleVars({ theme: "midnight", font: "pixel" });
    expect(vars["--c-bg"]).toBe("var(--ov-night)");
    expect(vars["--c-font"]).toContain("--font-ov-pixel");
    expect(vars["--c-fs"]).toBe("0.7");
    // Classic with the site font leaves the card's own defaults alone.
    expect(overlayStyleVars({ theme: "classic", font: "default" })).toEqual({});
  });
});

test.describe("the switch is checked at play time", () => {
  const style = { theme: "neon", font: "bangers" };

  test("on: both the alert and the follow-up message card get the style", () => {
    expect(resolveAlertExtras({ ...base, style }, { kind: "alert", features: ON }).theme).toEqual({ theme: "neon", font: "bangers" });
    expect(resolveAlertExtras({ ...base, style }, { kind: "message", features: ON }).theme).toEqual({ theme: "neon", font: "bangers" });
  });

  test("off: the plain card, whatever is stored", () => {
    expect(resolveAlertExtras({ ...base, style }, { kind: "alert", features: OFF }).theme).toBeNull();
  });

  test("on but never picked: the plain card", () => {
    expect(resolveAlertExtras(base, { kind: "alert", features: ON }).theme).toBeNull();
    expect(resolveAlertExtras({ ...base, style: { theme: "classic", font: "default" } }, { kind: "alert", features: ON }).theme).toBeNull();
  });

  test("the feature is built and listed with the alert box", () => {
    const f = FEATURES.find((x) => x.key === "overlayThemes");
    expect(f?.built).toBe(true);
    expect(f?.group).toBe("Alert box");
  });
});

test("the loader reads the creator's style only while the switch is on, and survives a missing column", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, overlay_theme, overlay_font)
     values ('g1','a@example.com','handle1','active', array['overlayThemes'], 'neon', 'bangers') returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
    [creatorId],
  );
  const tipId = Number(t.rows[0].id);
  const db = asLedgerDb(pg) as unknown as Sql;

  const on = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(on.theme).toEqual({ theme: "neon", font: "bangers" });

  // A key that is no longer in the code plays as the default, not an error.
  await pg.query(`update users set overlay_theme = 'retired' where id = $1`, [creatorId]);
  const retired = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(retired.theme).toEqual({ theme: "classic", font: "bangers" });

  await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
  const off = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(off.theme).toBeNull();

  // Migration 0037 not run yet: the alert still plays, plain.
  await pg.query(`update users set paid_features = array['overlayThemes'] where id = $1`, [creatorId]);
  await pg.query(`alter table users drop column overlay_theme`);
  const missing = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(missing.theme).toBeNull();
  expect(missing.voiceRequested).toBe(false);
});
