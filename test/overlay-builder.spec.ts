import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { goalBarBody } from "../src/lib/overlay-doc/goal-api";
import { checkDraft, draftFromLive, liveAsValues, overlayParts, parseOverlayDraft, sameValues } from "../src/lib/overlay-doc/draft";
import { goalBarInput, parseGoalBarStyle, resolveGoalBarStyle } from "../src/lib/overlay-doc/goal-bar-style";
import { discardOverlayDraft, loadOverlayState, publishOverlay, saveOverlayDraft, swapOverlay } from "../src/lib/overlay-doc/store";
import { asLedgerDb, freshDatabase, readMigration } from "./helpers/pg";

// The owner's overlay editor (page builder phase 5, part two; migration 0053): the goal bar's own
// look, the draft's shape and checks, and the store (save, publish, swap, discard) against an
// in-memory Postgres.

const ALL = ["pageBuilder", "alertText", "alertMotion", "alertLayout", "overlayThemes"];
const empty = { alertText: null, alertMotion: null, alertLayout: null, theme: "classic", font: "default", goalBar: null };

test.describe("the goal bar's look", () => {
  test("a plain form is today's bar (null)", () => {
    expect(parseGoalBarStyle({})).toEqual({ ok: true, value: null });
    expect(parseGoalBarStyle({ fill: "", show: "amounts", celebrate: true })).toEqual({ ok: true, value: null });
  });

  test("a colour, percent only and no moment are kept, sparse", () => {
    expect(parseGoalBarStyle({ fill: "#FFAA33", show: "percent", celebrate: false })).toEqual({
      ok: true,
      value: { fill: "#ffaa33", show: "percent", celebrate: false },
    });
  });

  test("refuses a bad colour, one too dark to see, an unknown key and a non-boolean", () => {
    for (const input of [{ fill: "red" }, { fill: "#112233" }, { fill: 5 }, { show: "tiny" }, { celebrate: "no" }]) {
      expect(parseGoalBarStyle(input).ok).toBe(false);
    }
  });

  test("reading a stored value drops each bad field on its own and never throws", () => {
    expect(resolveGoalBarStyle({ fill: "#ffaa33", show: "weird", celebrate: false, extra: 1 })).toEqual({ fill: "#ffaa33", celebrate: false });
    expect(resolveGoalBarStyle({ fill: "#000000" })).toBeNull();
    for (const junk of [null, undefined, "nope", 5, [], "{bad json"]) expect(resolveGoalBarStyle(junk)).toBeNull();
    expect(resolveGoalBarStyle('{"show":"percent"}')).toEqual({ show: "percent" });
  });

  test("the form's view of a style", () => {
    expect(goalBarInput(null)).toEqual({ fill: "", show: "amounts", celebrate: true });
    expect(goalBarInput({ fill: "#ffaa33", show: "percent", celebrate: false })).toEqual({ fill: "#ffaa33", show: "percent", celebrate: false });
  });
});

test.describe("the draft", () => {
  const row = { paid_features: ALL, accent: null };

  test("a draft from nothing is every part at its normal value", () => {
    const parts = overlayParts(row);
    const d = draftFromLive(empty, null, parts);
    expect(d.text).toEqual({ headline: "", bg: "", text: "", amount: "", size: "normal", weight: "normal" });
    expect(d.motion).toEqual({ enter: "wipe", exit: "wipe", seconds: "", gap: "" });
    expect(d.layout).toEqual({ side: "above", soundVolume: "", voiceVolume: "" });
    expect(d.style).toEqual({ theme: "classic", font: "default" });
    expect(d.goalBar).toEqual({ fill: "", show: "amounts", celebrate: true });
  });

  test("live values written out and checked again come back as the same values (nothing to publish)", () => {
    const live = {
      alertText: { headline: "{name} sent {amount}", size: "large" },
      alertMotion: { enter: "zoom", seconds: 12 },
      alertLayout: { side: "left", soundVolume: 60 },
      theme: "midnight",
      font: "poppins",
      goalBar: { fill: "#ffaa33", show: "percent" },
    };
    const draft = draftFromLive(live, null, overlayParts(row));
    const checked = checkDraft(draft, row);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(sameValues(checked.values, liveAsValues(live, row))).toBe(true);
  });

  test("parsing shapes any value and turns junk into no draft", () => {
    for (const junk of [null, undefined, "nope", 5, [], "{bad"]) expect(parseOverlayDraft(junk)).toBeNull();
    const d = parseOverlayDraft({ text: { headline: "x".repeat(900), size: 7 }, style: { theme: "nope", font: "bangers" }, goalBar: { show: "percent", celebrate: false } });
    expect(d?.text.headline).toHaveLength(200);
    expect(d?.text.size).toBe("7");
    expect(d?.style).toEqual({ theme: "classic", font: "bangers" });
    expect(d?.goalBar).toEqual({ fill: "", show: "percent", celebrate: false });
    expect(parseOverlayDraft({})?.motion.enter).toBe("wipe");
  });

  test("checks use the creator's own rules and name the first problem", () => {
    const base = draftFromLive(empty, null, overlayParts(row));
    const bad = (change: (d: typeof base) => void) => {
      const d = structuredClone(base);
      change(d);
      return checkDraft(d, row);
    };
    expect(bad((d) => (d.text.bg = "#ffffff") && (d.text.text = "#fafafa")).ok).toBe(false);
    expect(bad((d) => (d.text.size = "huge")).ok).toBe(false);
    expect(bad((d) => (d.motion.seconds = "2")).ok).toBe(false);
    expect(bad((d) => (d.motion.enter = "spin")).ok).toBe(false);
    expect(bad((d) => (d.layout.soundVolume = "5")).ok).toBe(false);
    expect(bad((d) => (d.goalBar.fill = "#101010")).ok).toBe(false);
    expect(bad((d) => (d.text.headline = "{name} {amount}")).ok).toBe(true);
  });

  test("card colours are checked against the theme in the draft, not the live one", () => {
    const d = draftFromLive(empty, null, overlayParts(row));
    d.style.theme = "paper";
    d.text.text = "#f4f3ec"; // light text on the light Paper card
    expect(checkDraft(d, row).ok).toBe(false);
    d.style.theme = "midnight";
    expect(checkDraft(d, row).ok).toBe(true);
  });

  test("a part whose switch is off is skipped and named, never checked or written", () => {
    const some = { paid_features: ["pageBuilder", "alertMotion"], accent: null };
    const d = draftFromLive(empty, null, overlayParts(some));
    d.text.size = "huge"; // would be refused if it were checked
    const checked = checkDraft(d, some);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(Object.keys(checked.values).sort()).toEqual(["alertMotion", "goalBar"]);
      expect(checked.skipped).toEqual(["card style and font", "alert text and colours", "volume and layout"]);
    }
  });

  test("the goal bar follows the custom page switch alone", () => {
    expect(overlayParts({ paid_features: ["pageBuilder"] })).toEqual({ text: false, motion: false, layout: false, style: false, goalBar: true });
    expect(overlayParts({ paid_features: [] }).goalBar).toBe(false);
  });
});

let seq = 0;
async function creator(pg: PGlite, features: string[] = ALL): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features) values ($1, $2, $3, 'active', $4::text[]) returning id::text`,
    [`og${seq}`, `o${seq}@example.com`, `overlay${seq}`, features],
  );
  return Number(r.rows[0].id);
}

const live = async (pg: PGlite, id: number) =>
  (
    await pg.query<{
      alert_text: unknown;
      alert_motion: unknown;
      alert_layout: unknown;
      overlay_theme: string;
      overlay_font: string;
      goal_bar_style: unknown;
      overlay_draft: unknown;
      overlay_previous: unknown;
    }>(`select alert_text, alert_motion, alert_layout, overlay_theme, overlay_font, goal_bar_style, overlay_draft, overlay_previous from users where id = $1`, [id])
  ).rows[0];

const audits = async (pg: PGlite, id: number) =>
  (await pg.query<{ action: string }>(`select action from audit_events where entity_ref = $1 and action like 'creator.overlay_%' order by id`, [String(id)])).rows.map((r) => r.action);

// Opens the editor state, changes the draft and saves it, as the editor does.
async function edit(pg: PGlite, id: number, change: (d: ReturnType<typeof structuredClone<import("../src/lib/overlay-doc/draft").OverlayDraft>>) => void) {
  const db = asLedgerDb(pg);
  const state = await loadOverlayState(db, id);
  const d = structuredClone(state!.doc);
  change(d);
  const saved = await saveOverlayDraft(db, id, state!.base, d);
  if (!saved.ok) throw new Error(saved.message);
  return saved.doc;
}

test.describe("migration 0053", () => {
  test("adds three empty columns and can be run twice", async () => {
    const pg = await freshDatabase();
    await pg.exec(readMigration("0053_overlay_builder.sql"));
    const id = await creator(pg);
    const row = await live(pg, id);
    expect([row.overlay_draft, row.overlay_previous, row.goal_bar_style]).toEqual([null, null, null]);
  });
});

test.describe("saving a draft", () => {
  test("opens on the live values, saves, and touches nothing the stream reads", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    const state = await loadOverlayState(db, id);
    expect(state?.source).toBe("live");
    expect(state?.base).toBeNull();
    await edit(pg, id, (d) => (d.text.headline = "Thank you {name}"));
    const row = await live(pg, id);
    expect((row.overlay_draft as { text: { headline: string } }).text.headline).toBe("Thank you {name}");
    expect([row.alert_text, row.alert_motion, row.alert_layout, row.goal_bar_style, row.overlay_theme, row.overlay_font]).toEqual([null, null, null, null, "classic", "default"]);
    expect((await loadOverlayState(db, id))?.source).toBe("draft");
  });

  test("a second tab saving from an old base is a conflict and writes nothing", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    const first = await loadOverlayState(db, id);
    await edit(pg, id, (d) => (d.motion.enter = "zoom"));
    const stale = structuredClone(first!.doc);
    stale.motion.enter = "fade";
    const result = await saveOverlayDraft(db, id, first!.base, stale);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict).toBe(true);
    expect((await live(pg, id)).overlay_draft).toMatchObject({ motion: { enter: "zoom" } });
  });

  test("refuses with the switch off, a draft that is not one, a big one and a mismatched base", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const off = await creator(pg, ["alertText"]);
    expect((await saveOverlayDraft(db, off, null, parseOverlayDraft({}))).ok).toBe(false);
    const id = await creator(pg);
    expect((await saveOverlayDraft(db, id, null, "nope")).ok).toBe(false);
    expect((await saveOverlayDraft(db, id, null, { text: { headline: "x".repeat(5000) } })).ok).toBe(false);
    const mismatched = await saveOverlayDraft(db, id, "garbage", parseOverlayDraft({}));
    expect(mismatched.ok).toBe(false);
    expect((await saveOverlayDraft(db, 999999, null, parseOverlayDraft({}))).ok).toBe(false);
  });

  test("discarding drops the draft", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    expect((await discardOverlayDraft(db, id)).message).toBe("There was no draft.");
    await edit(pg, id, (d) => (d.layout.side = "left"));
    expect((await discardOverlayDraft(db, id)).ok).toBe(true);
    expect((await live(pg, id)).overlay_draft).toBeNull();
  });
});

test.describe("publishing", () => {
  test("writes every live column the alert and the goal bar read, keeps the old ones as previous, and audits", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await edit(pg, id, (d) => {
      d.text.headline = "{name} gave {amount}";
      d.text.size = "large";
      d.motion.enter = "zoom";
      d.motion.seconds = "12";
      d.layout.side = "left";
      d.layout.soundVolume = "60";
      d.style.theme = "midnight";
      d.style.font = "poppins";
      d.goalBar = { fill: "#ffaa33", show: "percent", celebrate: false };
    });
    const result = await publishOverlay(db, id);
    expect(result.ok).toBe(true);
    const row = await live(pg, id);
    expect(row.alert_text).toEqual({ headline: "{name} gave {amount}", size: "large" });
    expect(row.alert_motion).toEqual({ enter: "zoom", seconds: 12 });
    expect(row.alert_layout).toEqual({ side: "left", soundVolume: 60 });
    expect([row.overlay_theme, row.overlay_font]).toEqual(["midnight", "poppins"]);
    expect(row.goal_bar_style).toEqual({ fill: "#ffaa33", show: "percent", celebrate: false });
    expect(row.overlay_previous).toEqual({ alertText: null, alertMotion: null, alertLayout: null, theme: "classic", font: "default", goalBar: null });
    expect(await audits(pg, id)).toEqual(["creator.overlay_published"]);
  });

  test("one bad part refuses the whole publish and writes nothing", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await edit(pg, id, (d) => {
      d.text.headline = "{name} hello";
      d.motion.seconds = "99"; // outside 5 to 30
    });
    const result = await publishOverlay(db, id);
    expect(result.ok).toBe(false);
    const row = await live(pg, id);
    expect([row.alert_text, row.alert_motion, row.overlay_previous]).toEqual([null, null, null]);
    expect(await audits(pg, id)).toEqual([]);
  });

  test("refuses with no draft, a draft that changes nothing, and the switch off", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    expect((await publishOverlay(db, id)).message).toBe("There is no draft to publish.");
    await edit(pg, id, () => {});
    expect((await publishOverlay(db, id)).message).toBe("The live overlays are already this draft.");
    await edit(pg, id, (d) => (d.motion.gap = "3"));
    expect((await publishOverlay(db, id)).ok).toBe(true);
    expect((await publishOverlay(db, id)).message).toBe("The live overlays are already this draft.");
    await pg.query(`update users set paid_features = '{}' where id = $1`, [id]);
    expect((await publishOverlay(db, id)).ok).toBe(false);
  });

  test("a part whose paid switch is off is not written and is named", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, ["pageBuilder", "alertMotion"]);
    const db = asLedgerDb(pg);
    await edit(pg, id, (d) => {
      d.motion.enter = "fade";
      d.text.headline = "Should not go live";
      d.style.theme = "neon";
    });
    const result = await publishOverlay(db, id);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("alert text and colours");
    const row = await live(pg, id);
    expect(row.alert_motion).toEqual({ enter: "fade" });
    expect(row.alert_text).toBeNull();
    expect(row.overlay_theme).toBe("classic");
  });

  test("a creator's own saved text keeps working when a part is skipped", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg, ["pageBuilder", "alertMotion"]);
    await pg.query(`update users set alert_text = $1::jsonb where id = $2`, [JSON.stringify({ headline: "{name} mine" }), id]);
    const db = asLedgerDb(pg);
    await edit(pg, id, (d) => (d.motion.enter = "bounce"));
    await publishOverlay(db, id);
    expect((await live(pg, id)).alert_text).toEqual({ headline: "{name} mine" });
  });
});

test.describe("swapping with the previous version", () => {
  test("swaps live and previous, and swapping again swaps back", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    expect((await swapOverlay(db, id)).message).toBe("There is no earlier version to swap with.");
    await edit(pg, id, (d) => {
      d.text.headline = "{name} new";
      d.goalBar.fill = "#ffaa33";
    });
    await publishOverlay(db, id);
    const swapped = await swapOverlay(db, id);
    expect(swapped.ok).toBe(true);
    let row = await live(pg, id);
    expect([row.alert_text, row.goal_bar_style]).toEqual([null, null]);
    expect(row.overlay_previous).toMatchObject({ alertText: { headline: "{name} new" }, goalBar: { fill: "#ffaa33" } });
    await swapOverlay(db, id);
    row = await live(pg, id);
    expect(row.alert_text).toEqual({ headline: "{name} new" });
    expect(row.goal_bar_style).toEqual({ fill: "#ffaa33" });
    expect(await audits(pg, id)).toEqual(["creator.overlay_published", "creator.overlay_swapped", "creator.overlay_swapped"]);
  });

  test("refuses with the switch off", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    const db = asLedgerDb(pg);
    await edit(pg, id, (d) => (d.motion.enter = "fade"));
    await publishOverlay(db, id);
    await pg.query(`update users set paid_features = '{}' where id = $1`, [id]);
    expect((await swapOverlay(db, id)).ok).toBe(false);
  });
});

test.describe("a creator's own pages still work with the draft columns present", () => {
  test("the editor opens on what the creator saved themselves", async () => {
    const pg = await freshDatabase();
    const id = await creator(pg);
    await pg.query(`update users set alert_text = $1::jsonb, alert_motion = $2::jsonb, overlay_theme = 'paper' where id = $3`, [JSON.stringify({ headline: "{name} is here" }), JSON.stringify({ exit: "fade" }), id]);
    const state = await loadOverlayState(asLedgerDb(pg), id);
    expect(state?.doc.text.headline).toBe("{name} is here");
    expect(state?.doc.motion.exit).toBe("fade");
    expect(state?.doc.style.theme).toBe("paper");
    expect(state?.live).toEqual(state?.doc);
  });
});

// What the goal bar browser source is told (GET /api/overlay/<token>/goal), against the real schema.
test.describe("the goal bar's answer", () => {
  const NOW = new Date("2026-11-05T10:00:00Z");

  async function withGoal(pg: PGlite, features: string[], style: unknown) {
    const id = await creator(pg, features);
    await pg.query(`update users set goal_bar_style = $1::jsonb where id = $2`, [style === null ? null : JSON.stringify(style), id]);
    await pg.query(
      `insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over, started_at) values ($1, 'New mic', 100000, 'weekly', 'Asia/Kolkata', false, '2026-01-01T00:00:00Z')`,
      [id],
    );
    seq += 1;
    await pg.query(`insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at) values ($1, $2, 25000, 'captured', '2026-11-04T10:00:00Z')`, [id, `gb_${seq}`]);
    return id;
  }

  test("no style is today's answer, byte for byte", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ALL, null);
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect(body).toEqual({ goals: [{ title: "New mic", targetPaise: 100000, carryPaise: 0, raisedPaise: 25000, repeat: "weekly" }], goal: { title: "New mic", targetPaise: 100000, carryPaise: 0, raisedPaise: 25000, repeat: "weekly" } });
    expect("style" in body).toBe(false);
  });

  test("a style rides along while the switch is on", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ALL, { fill: "#ffaa33", celebrate: false });
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect(body.style).toEqual({ fill: "#ffaa33", celebrate: false });
    expect(body.goals[0]).toMatchObject({ raisedPaise: 25000, targetPaise: 100000 });
  });

  test("percent only sends the percent and no rupee figure anywhere in the JSON", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ALL, { show: "percent" });
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect(body.goals).toEqual([{ title: "New mic", repeat: "weekly", percent: 25 }]);
    expect(body.goal).toBeNull();
    const json = JSON.stringify(body);
    for (const leak of ["Paise", "25000", "100000", "₹"]) expect(json).not.toContain(leak);
  });

  test("with the switch off the stored style is ignored", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ["alertText"], { show: "percent", fill: "#ffaa33" });
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect("style" in body).toBe(false);
    expect(body.goals[0]).toMatchObject({ raisedPaise: 25000 });
  });

  test("a stored style that is not readable is today's bar", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ALL, { show: "weird", fill: "#000000" });
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect("style" in body).toBe(false);
  });

  test("before migration 0053 the column is missing and the bar is today's", async () => {
    const pg = await freshDatabase();
    const id = await withGoal(pg, ALL, null);
    await pg.exec(`alter table users drop column goal_bar_style`);
    const body = await goalBarBody(asLedgerDb(pg), id, NOW);
    expect("style" in body).toBe(false);
    expect(body.goals[0]).toMatchObject({ raisedPaise: 25000, targetPaise: 100000 });
  });
});
