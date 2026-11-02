import { expect, test } from "@playwright/test";
import { FEATURES, planFeatures } from "../src/lib/plans";
import { inkFor } from "../src/lib/accent";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import {
  HEADLINE_MAX,
  alertTextVars,
  baseColours,
  colourProblem,
  headlineSegments,
  parseAlertText,
  parseColour,
  parseHeadline,
  resolveAlertText,
} from "../src/lib/alert-text";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Alert text and colours (alert studio, item 1): what the creator may type, what is
// refused, what the card gets, and the switch checked at play time.

const ON = planFeatures({ paid_features: ["alertText"] });
const OFF = planFeatures(null);
const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };
const LIME = baseColours("classic", "#bfe84a");

test.describe("the headline", () => {
  test("empty means the normal headline", () => {
    expect(parseHeadline("")).toEqual({ ok: true, value: null });
    expect(parseHeadline("   ")).toEqual({ ok: true, value: null });
    expect(parseHeadline(null)).toEqual({ ok: true, value: null });
  });

  test("a good headline is kept, cleaned of control and invisible characters", () => {
    expect(parseHeadline("{name}  tipped​ {amount}")).toEqual({ ok: true, value: "{name} tipped {amount}" });
    expect(parseHeadline("Big love from {name}\n")).toEqual({ ok: true, value: "Big love from {name}" });
  });

  test("it must name the supporter exactly once", () => {
    expect(parseHeadline("Thank you!").ok).toBe(false);
    expect(parseHeadline("{name} and {name}").ok).toBe(false);
    expect(parseHeadline("{amount} {amount} {name}").ok).toBe(false);
  });

  test("only the two placeholders may use curly brackets", () => {
    for (const bad of ["{name} {user}", "{name} {", "{{name}}", "{name} }", "{name} ${x}"]) {
      expect(parseHeadline(bad).ok, bad).toBe(false);
    }
  });

  test("it has a length cap and must be text", () => {
    expect(parseHeadline("{name} " + "x".repeat(HEADLINE_MAX)).ok).toBe(false);
    expect(parseHeadline(42).ok).toBe(false);
    expect(parseHeadline({}).ok).toBe(false);
  });

  test("markup is plain text, never HTML (it is rendered as text)", () => {
    const r = parseHeadline("<b>{name}</b>");
    expect(r.ok).toBe(true);
    expect(headlineSegments("<b>{name}</b>").map((s) => s.kind)).toEqual(["text", "name", "text"]);
  });

  test("segments split on the placeholders", () => {
    expect(headlineSegments("{name} tipped {amount}!")).toEqual([
      { kind: "name", text: "{name}" },
      { kind: "text", text: " tipped " },
      { kind: "amount", text: "{amount}" },
      { kind: "text", text: "!" },
    ]);
  });
});

test.describe("colours", () => {
  test("only #rrggbb, any case; empty is the normal colour", () => {
    expect(parseColour("#FFAA00")).toEqual({ ok: true, value: "#ffaa00" });
    expect(parseColour("")).toEqual({ ok: true, value: null });
    expect(parseColour(null)).toEqual({ ok: true, value: null });
    for (const bad of ["red", "#fff", "#12345", "#1234567", "rgb(0,0,0)", "url(x)", "#gggggg", 5]) {
      expect(parseColour(bad).ok, String(bad)).toBe(false);
    }
  });

  test("text that is too close to the card is refused", () => {
    expect(colourProblem({ bg: "#222222", text: "#252525" }, LIME)).toMatch(/text colour/);
    expect(colourProblem({ amount: "#c4ec55" }, LIME)).toMatch(/amount colour/);
    expect(colourProblem({ bg: "#222222", text: "#ffffff", amount: "#ffcc00" }, LIME)).toBeNull();
  });

  test("a card colour alone gets readable ink; the normal card is fine", () => {
    expect(colourProblem(null, LIME)).toBeNull();
    expect(colourProblem({ bg: "#101010" }, LIME)).toBeNull();
    expect(colourProblem({ bg: "#f4f3ec" }, LIME)).toBeNull();
  });

  test("colours are judged on the card style the creator uses", () => {
    // Dark text is fine on the lime card, not on the dark Midnight card.
    expect(colourProblem({ text: "#14170a" }, baseColours("classic", "#bfe84a"))).toBeNull();
    expect(colourProblem({ text: "#14170a" }, baseColours("midnight", "#bfe84a"))).toMatch(/text colour/);
  });
});

test.describe("parsing the form", () => {
  test("everything normal stores nothing", () => {
    expect(parseAlertText({}, LIME)).toEqual({ ok: true, value: null });
    expect(parseAlertText({ headline: "", bg: "", text: "", amount: "", size: "normal", weight: "normal" }, LIME)).toEqual({ ok: true, value: null });
  });

  test("a full valid form is stored with only what was changed", () => {
    const r = parseAlertText(
      { headline: "{name} tipped {amount}", bg: "#101010", text: "#ffffff", amount: "#ffcc00", size: "large", weight: "bold" },
      LIME,
    );
    expect(r).toEqual({
      ok: true,
      value: { headline: "{name} tipped {amount}", bg: "#101010", text: "#ffffff", amount: "#ffcc00", size: "large", weight: "bold" },
    });
  });

  test("a bad size, weight or colour is refused with words", () => {
    expect(parseAlertText({ size: "huge" }, LIME)).toMatchObject({ ok: false });
    expect(parseAlertText({ weight: "black" }, LIME)).toMatchObject({ ok: false });
    expect(parseAlertText({ bg: "blue" }, LIME)).toMatchObject({ ok: false, message: expect.stringContaining("card colour") });
    expect(parseAlertText({ headline: "no name here" }, LIME)).toMatchObject({ ok: false });
  });

  test("unreadable colours are refused at save time", () => {
    expect(parseAlertText({ bg: "#222222", text: "#232323" }, LIME)).toMatchObject({ ok: false });
  });
});

test.describe("what the card gets", () => {
  test("nothing changed is the plain card", () => {
    expect(resolveAlertText(null, LIME)).toBeNull();
    expect(resolveAlertText({}, LIME)).toBeNull();
    expect(resolveAlertText("not json", LIME)).toBeNull();
    expect(resolveAlertText([1], LIME)).toBeNull();
    expect(alertTextVars(null)).toEqual({});
  });

  test("a stored row is checked field by field; a bad field drops, the rest stays", () => {
    expect(resolveAlertText({ headline: "{name} sent {amount}", bg: "nope", size: "huge", weight: "bold" }, LIME)).toEqual({
      headline: "{name} sent {amount}",
      weight: "bold",
    });
  });

  test("jsonb that a driver hands back as text still reads", () => {
    expect(resolveAlertText(JSON.stringify({ size: "small" }), LIME)).toEqual({ size: "small" });
  });

  test("colours that stopped being readable (the creator changed theme or accent) are dropped", () => {
    const stored = { bg: "#bfe84a", text: "#c9ee63", headline: "{name} tipped" };
    expect(resolveAlertText(stored, LIME)).toEqual({ headline: "{name} tipped" });
  });

  test("the variables only set card variables, with plain values", () => {
    const vars = alertTextVars({ bg: "#101010", text: "#ffffff", amount: "#ffcc00", size: "large", weight: "bold" }, 0.7);
    expect(vars["--c-bg"]).toBe("#101010");
    expect(vars["--c-fg"]).toBe("#ffffff");
    expect(vars["--c-amount"]).toBe("#ffcc00");
    expect(vars["--c-word-bg"]).toBe("#ffffff");
    expect(vars["--c-word-fg"]).toBe("var(--c-bg)");
    // A wide font and a larger size multiply.
    expect(Number(vars["--c-fs"])).toBeCloseTo(0.84, 3);
    expect(vars["--c-fw-top"]).toBe("700");
    for (const [name, value] of Object.entries(vars)) {
      expect(name).toMatch(/^--c-[a-z-]+$/);
      expect(value).not.toMatch(/url\(|;|\{|\}/);
    }
  });

  test("a card colour alone brings readable ink with it", () => {
    expect(alertTextVars({ bg: "#101010" })["--c-fg"]).toBe(inkFor("#101010"));
    expect(alertTextVars({ bg: "#f4f3ec" })["--c-fg"]).toBe(inkFor("#f4f3ec"));
    expect(inkFor("#101010")).not.toBe(inkFor("#f4f3ec"));
  });
});

test.describe("the switch is checked at play time", () => {
  const stored = { headline: "{name} tipped {amount}", bg: "#101010", text: "#ffffff" };
  const alertText = { value: stored, accent: "#bfe84a" };

  test("on: both cards get the text", () => {
    expect(resolveAlertExtras({ ...base, alertText }, { kind: "alert", features: ON }).text).toEqual(stored);
    expect(resolveAlertExtras({ ...base, alertText }, { kind: "message", features: ON }).text).toEqual(stored);
  });

  test("off: the plain card, whatever is stored", () => {
    expect(resolveAlertExtras({ ...base, alertText }, { kind: "alert", features: OFF }).text).toBeNull();
  });

  test("on but never set: the plain card", () => {
    expect(resolveAlertExtras(base, { kind: "alert", features: ON }).text).toBeNull();
    expect(resolveAlertExtras({ ...base, alertText: { value: null, accent: null } }, { kind: "alert", features: ON }).text).toBeNull();
  });

  test("colours are judged against the theme only while the theme feature is on", () => {
    const both = planFeatures({ paid_features: ["alertText", "overlayThemes"] });
    const dark = { value: { text: "#14170a" }, accent: "#bfe84a" };
    const style = { theme: "midnight", font: "default" };
    // Dark text on the Midnight card is unreadable: dropped (the card keeps the theme's text).
    expect(resolveAlertExtras({ ...base, alertText: dark, style }, { kind: "alert", features: both }).text).toBeNull();
    // With the theme feature off the card is the lime one, where dark text is fine.
    expect(resolveAlertExtras({ ...base, alertText: dark, style }, { kind: "alert", features: ON }).text).toEqual({ text: "#14170a" });
  });

  test("the feature is built and listed with the alert box", () => {
    const f = FEATURES.find((x) => x.key === "alertText");
    expect(f?.built).toBe(true);
    expect(f?.group).toBe("Alert box");
  });
});

test("the loader reads the creator's text only while the switch is on, and survives a missing column", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, alert_text)
     values ('g1','a@example.com','handle1','active', array['alertText'], '{"headline":"{name} tipped {amount}","weight":"bold"}'::jsonb) returning id::text`,
  );
  const creatorId = Number(u.rows[0].id);
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status) values ($1,'tip_1',5000,'captured') returning id::text`,
    [creatorId],
  );
  const tipId = Number(t.rows[0].id);
  const db = asLedgerDb(pg) as unknown as Sql;

  const on = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(on.text).toEqual({ headline: "{name} tipped {amount}", weight: "bold" });

  // A hand-edited row with junk plays as the plain card, not an error.
  await pg.query(`update users set alert_text = '{"headline":"{evil}","bg":"url(x)","size":"huge"}'::jsonb where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).text).toBeNull();

  await pg.query(`update users set paid_features = '{}' where id = $1`, [creatorId]);
  expect((await loadAlertExtras(db, { tipId, creatorId, kind: "alert" })).text).toBeNull();

  // Migration 0044 not run yet: the alert still plays, plain.
  await pg.query(`update users set paid_features = array['alertText'] where id = $1`, [creatorId]);
  await pg.query(`alter table users drop column alert_text`);
  const missing = await loadAlertExtras(db, { tipId, creatorId, kind: "alert" });
  expect(missing.text).toBeNull();
  expect(missing.voiceRequested).toBe(false);
});
