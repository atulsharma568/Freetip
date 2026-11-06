import { expect, test } from "@playwright/test";
import { ACCENT_PRESETS, DEFAULT_ACCENT, inkFor, pairChecks } from "../src/lib/accent";
import { LIMITS } from "../src/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { ONE_PIECE_LADDER, ladderFraction, ladderLevel } from "../src/lib/page-doc/ladder";
import { themeFor } from "../src/lib/page-doc/theme";
import { parsePageDoc, pageDocOrDefault, validateForPublish } from "../src/lib/page-doc/parse";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The tip page document (page builder phase 1): one lenient parser that always gives back a page
// a fan can pay on, whatever was stored.

const block = (type: string, extra: Record<string, unknown> = {}) => ({ id: type, type, visible: true, slot: "main", settings: {}, ...extra });

const minimal: PageDoc = {
  version: 1,
  blocks: [
    { id: "header", type: "header", visible: true, slot: "side", settings: { bannerAsset: null, avatar: "none", frame: "none", frameAsset: null, frameScale: 144, bannerFx: "none", bannerFxAsset: null, fxArea: "banner" } },
    { id: "amount", type: "amount", visible: true, slot: "main", settings: { ladder: null, heading: "", barLabel: "" } },
    { id: "note", type: "note", visible: true, slot: "main", settings: { heading: "", namePlaceholder: "", messagePlaceholder: "" } },
    { id: "send", type: "send", visible: true, slot: "main", settings: { heading: "", buttonLabel: "" } },
  ],
  theme: {},
};

const withBlocks = (blocks: unknown[], theme: unknown = {}) => ({ version: 1, blocks, theme });
const typesOf = (doc: PageDoc) => doc.blocks.map((b) => b.type);
const find = <T extends Block["type"]>(doc: PageDoc, type: T) => doc.blocks.find((b) => b.type === type) as Block<T> | undefined;

test.describe("reading a stored page document", () => {
  test("something that is not a page gives null", () => {
    for (const raw of [undefined, null, 5, "x", [], "[]", { version: 1 }, { version: 2, blocks: [] }, "x".repeat(LIMITS.raw + 1)]) {
      expect(parsePageDoc(raw)).toBeNull();
    }
  });

  test("jsonb handed back as text is read", () => {
    expect(parsePageDoc(JSON.stringify(minimal))?.doc).toEqual(minimal);
    expect(parsePageDoc(minimal)?.doc).toEqual(minimal);
  });

  test("a document that cannot be read falls back to the page it is given", () => {
    expect(pageDocOrDefault("nope", minimal)).toBe(minimal);
    expect(pageDocOrDefault(minimal, { ...minimal, theme: { accent: "#000000" } }).theme).toEqual({});
  });

  test("unknown block types and a second block of one type are dropped", () => {
    const parsed = parsePageDoc(
      withBlocks([block("amount"), block("sparkles"), block("note"), block("note", { settings: { x: 1 } }), block("send")]),
    );
    expect(typesOf(parsed!.doc)).toEqual(["header", "amount", "note", "send"]);
  });

  test("a block in a section it may not use goes to its own section", () => {
    const parsed = parsePageDoc(
      withBlocks([block("strip", { slot: "main", settings: { left: "a", right: "b" } }), block("amount"), block("note"), block("send")]),
    );
    expect(find(parsed!.doc, "strip")?.slot).toBe("bottom");
  });

  test("at most 30 blocks are read", () => {
    const junk = Array.from({ length: LIMITS.blocks }, () => null);
    const parsed = parsePageDoc(withBlocks([...junk, block("strip", { slot: "bottom", settings: { left: "a", right: "b" } })]));
    expect(find(parsed!.doc, "strip")).toBeUndefined();
  });

  test("a block with settings that are not an object keeps the page", () => {
    const parsed = parsePageDoc(withBlocks([block("creatorLinks", { slot: "side", settings: "oops" }), block("amount"), block("note"), block("send")]));
    expect(find(parsed!.doc, "creatorLinks")?.settings).toEqual({ tagline: "", instagram: "" });
  });
});

test.describe("the pay blocks are always on the page", () => {
  test("header, amount, note and send are visible and present, and the repair is reported", () => {
    const parsed = parsePageDoc(withBlocks([block("amount"), block("send", { visible: false })]))!;
    expect(typesOf(parsed.doc)).toEqual(["header", "amount", "send", "note"]);
    expect(parsed.doc.blocks.every((b) => b.visible)).toBe(true);
    expect(find(parsed.doc, "note")?.slot).toBe("main");
    expect(find(parsed.doc, "header")?.slot).toBe("side");
    expect(parsed.repairedProtected).toEqual(["header", "note", "send"]);
  });

  test("a hidden header is shown again and is first in its section", () => {
    const parsed = parsePageDoc(
      withBlocks([block("qr", { slot: "side" }), block("header", { slot: "side", visible: false }), block("amount"), block("note"), block("send")]),
    )!;
    expect(find(parsed.doc, "header")?.visible).toBe(true);
    expect(parsed.repairedProtected).toEqual(["header"]);
  });

  test("a missing header goes first, ahead of the other side blocks", () => {
    const parsed = parsePageDoc(withBlocks([block("qr", { slot: "side" }), block("amount"), block("note"), block("send")]))!;
    expect(typesOf(parsed.doc)[0]).toBe("header");
  });

  test("a clean document reports no repair", () => {
    expect(parsePageDoc(minimal)?.repairedProtected).toEqual([]);
  });

  test("publishing refuses a draft with a hidden or missing pay block", () => {
    const message = "The header, amount, note and send blocks must stay on the page.";
    const header = block("header", { slot: "side" });
    expect(validateForPublish(withBlocks([header, block("amount"), block("note"), block("send", { visible: false })]))).toEqual({ ok: false, message });
    expect(validateForPublish(withBlocks([header, block("amount"), block("send")]))).toEqual({ ok: false, message });
    expect(validateForPublish(withBlocks([block("amount"), block("note"), block("send")]))).toEqual({ ok: false, message });
  });

  test("publishing refuses something that is not a page, and accepts a clean draft", () => {
    expect(validateForPublish(null)).toEqual({ ok: false, message: "This draft is not a page." });
    expect(validateForPublish(minimal)).toEqual({ ok: true, doc: minimal });
  });
});

test.describe("colours", () => {
  const docWith = (theme: unknown) => parsePageDoc(withBlocks([block("amount"), block("note"), block("send")], theme))!.doc;

  test("the owner's red with light ink is kept", () => {
    expect(docWith({ accent: "#ca1b19", ink: "#f6f6f1" }).theme).toEqual({ accent: "#ca1b19", ink: "#f6f6f1" });
  });

  test("an accent without ink gets the ink the page would choose, and is kept when it reads well", () => {
    expect(docWith({ accent: "#bfe84a" }).theme).toEqual({ accent: "#bfe84a" });
  });

  test("only #rrggbb is accepted, and upper case is made lower case", () => {
    expect(docWith({ accent: "#CA1B19", ink: "#F6F6F1" }).theme).toEqual({ accent: "#ca1b19", ink: "#f6f6f1" });
    for (const accent of ["red", "#fff", "#ca1b1", "rgb(1,2,3)", "#ca1b19; x", 5, null]) {
      expect(docWith({ accent }).theme).toEqual({});
    }
  });

  test("an accent whose ink cannot be read on it is dropped", () => {
    expect(docWith({ accent: "#444444", ink: "#555555" }).theme).toEqual({});
  });

  test("an ink with no accent is dropped", () => {
    expect(docWith({ ink: "#f6f6f1" }).theme).toEqual({});
  });
});

test.describe("words in the settings", () => {
  const links = (settings: unknown) => {
    const doc = parsePageDoc(withBlocks([block("creatorLinks", { slot: "side", settings }), block("amount"), block("note"), block("send")]))!.doc;
    return find(doc, "creatorLinks")!.settings;
  };

  test("an Instagram name goes into a link, so only letters, digits, dots and underscores pass", () => {
    expect(links({ instagram: "acepressure.gg" }).instagram).toBe("acepressure.gg");
    for (const bad of ["a/b", "x y", "javascript:alert(1)", '"><b>', "a".repeat(31), "@name", "../x", ""]) {
      expect(links({ instagram: bad }).instagram).toBe("");
    }
  });

  test("text over its limit is cut and control characters are removed", () => {
    expect(links({ tagline: "x".repeat(200) }).tagline).toBe("x".repeat(LIMITS.tagline));
    expect(links({ tagline: "Val\u0000orant\u0007 live" }).tagline).toBe("Valorant live");
    expect(links({ tagline: 42 }).tagline).toBe("");
  });

  test("the strip words are cut at their limit", () => {
    const doc = parsePageDoc(
      withBlocks([block("strip", { slot: "bottom", settings: { left: "l".repeat(100), right: "r" } }), block("amount"), block("note"), block("send")]),
    )!.doc;
    expect(find(doc, "strip")!.settings).toEqual({ left: "l".repeat(LIMITS.strip), right: "r" });
  });
});

test.describe("the rank ladder on the amount block", () => {
  const good = {
    topRupees: 5000,
    levels: [
      { upTo: 0.5, name: "Rookie" },
      { upTo: 1, name: "King" },
    ],
  };
  const ladderOf = (ladder: unknown) => {
    const doc = parsePageDoc(withBlocks([block("amount", { settings: { ladder } }), block("note"), block("send")]))!.doc;
    return find(doc, "amount")!.settings.ladder;
  };

  test("a valid ladder is kept", () => {
    expect(ladderOf(good)).toEqual(good);
  });

  test("a ladder that cannot be used is dropped, not the page", () => {
    const bad: unknown[] = [
      { ...good, levels: [{ upTo: 0.8, name: "a" }, { upTo: 0.4, name: "b" }, { upTo: 1, name: "c" }] },
      { ...good, levels: [{ upTo: 0.5, name: "a" }, { upTo: 0.9, name: "b" }] },
      { ...good, levels: [{ upTo: 1, name: "only" }] },
      { ...good, levels: Array.from({ length: 9 }, (_, i) => ({ upTo: (i + 1) / 9, name: `n${i}` })) },
      { ...good, levels: [{ upTo: 0.5, name: "" }, { upTo: 1, name: "b" }] },
      { ...good, levels: [{ upTo: Number.NaN, name: "a" }, { upTo: 1, name: "b" }] },
      { ...good, topRupees: 99 },
      { ...good, topRupees: 100001 },
      { ...good, topRupees: Number.NaN },
      { ...good, levels: "none" },
      "ladder",
      5,
    ];
    for (const ladder of bad) expect(ladderOf(ladder)).toBeNull();
  });

  test("a long rank name is cut", () => {
    const ladder = ladderOf({ ...good, levels: [{ upTo: 0.5, name: "n".repeat(60) }, { upTo: 1, name: "King" }] });
    expect(ladder?.levels[0].name).toBe("n".repeat(LIMITS.levelName));
  });
});

test.describe("the two default documents", () => {
  test("each one reads back as itself with nothing repaired", () => {
    for (const make of [defaultPageDoc, ownerPageDoc]) {
      const parsed = parsePageDoc(make())!;
      expect(parsed.doc).toEqual(make());
      expect(parsed.repairedProtected).toEqual([]);
    }
  });

  test("each call gives a fresh copy", () => {
    const a = defaultPageDoc();
    a.blocks[0].visible = false;
    a.theme.accent = "#000000";
    expect(defaultPageDoc().blocks[0].visible).toBe(true);
    expect(defaultPageDoc().theme).toEqual({});
    const o = ownerPageDoc();
    (o.blocks.find((b) => b.type === "amount") as Block<"amount">).settings.ladder!.levels[0].name = "changed";
    expect(ownerPageDoc().blocks.find((b) => b.type === "amount")).toMatchObject({ settings: { ladder: ONE_PIECE_LADDER } });
  });

  test("a normal page is the header, preview and QR beside the form of three steps", () => {
    const doc = defaultPageDoc();
    expect(doc.blocks.map((b) => `${b.slot}:${b.type}`)).toEqual([
      "side:header",
      "side:alertPreview",
      "side:qr",
      "main:amount",
      "main:note",
      "main:send",
      "success:successScreen",
    ]);
    expect(doc.theme).toEqual({});
    expect(find(doc, "amount")!.settings.ladder).toBeNull();
    expect(find(doc, "successScreen")!.settings.style).toBe("default");
  });

  test("the owner's page adds the backdrop, links, pressure bar, strip and sign-off in the owner's red", () => {
    const doc = ownerPageDoc();
    expect(doc.blocks.map((b) => `${b.slot}:${b.type}`)).toEqual([
      "background:backdrop",
      "side:header",
      "side:creatorLinks",
      "side:alertPreview",
      "side:qr",
      "main:amount",
      "main:note",
      "main:send",
      "bottom:strip",
      "success:successScreen",
    ]);
    expect(find(doc, "creatorLinks")!.settings).toEqual({ tagline: "Live & Highlights", instagram: "acepressure.gg" });
    expect(find(doc, "strip")!.settings).toEqual({ left: "YouTube / AcePressure", right: "@acepressure.gg" });
    expect(find(doc, "amount")!.settings.ladder).toEqual(ONE_PIECE_LADDER);
    expect(find(doc, "successScreen")!.settings.style).toBe("owner");
    expect(doc.theme).toEqual({ accent: "#ca1b19", ink: "#f6f6f1" });
  });
});

test.describe("the amount bar", () => {
  test("is empty at the minimum and full at the top, rising in between", () => {
    expect(ladderFraction(20, 20, 5000)).toBe(0);
    expect(ladderFraction(5000, 20, 5000)).toBe(1);
    expect(ladderFraction(99999, 20, 5000)).toBe(1);
    expect(ladderFraction(0, 20, 5000)).toBe(0);
    expect(ladderFraction(100, 20, 5000)).toBeGreaterThan(ladderFraction(50, 20, 5000));
  });

  test("a top at or below the minimum, or a number that is not a number, does not break it", () => {
    expect(ladderFraction(100, 20, 20)).toBe(1);
    expect(ladderFraction(10, 20, 20)).toBe(0);
    expect(ladderFraction(Number.NaN, 20, 5000)).toBe(0);
    expect(ladderFraction(50, 20, Number.NaN)).toBe(0);
    expect(ladderFraction(50, Number.NaN, 5000)).toBe(0);
    expect(ladderFraction(50, 20, Number.POSITIVE_INFINITY)).toBe(0);
  });

  test("climbs the One Piece ladder", () => {
    const names = [0, 0.3, 0.6, 0.9, 1].map((f) => ladderLevel(f, ONE_PIECE_LADDER.levels));
    expect(names).toEqual(["Rookie", "Supernova", "Warlord", "Yonko", "Pirate King"]);
  });
});

test.describe("the page's colours", () => {
  const sky = ACCENT_PRESETS.find((p) => p.id === "sky")!.hex;

  test("the owner's document sets the owner's red and light ink", () => {
    expect(themeFor(ownerPageDoc(), "#7dd3fc")).toEqual({
      style: { "--color-accent": "#ca1b19", "--color-ink": "#f6f6f1" },
      accent: "#ca1b19",
    });
  });

  test("a normal page uses the colour the creator saved", () => {
    expect(themeFor(defaultPageDoc(), sky)).toEqual({ style: { "--color-accent": sky, "--color-ink": inkFor(sky) }, accent: sky });
  });

  test("a normal page with no saved colour uses the site's own", () => {
    expect(themeFor(defaultPageDoc(), null)).toEqual({ style: undefined, accent: DEFAULT_ACCENT });
  });

  test("a document accent without ink gets the ink the page would choose", () => {
    const doc = { ...defaultPageDoc(), theme: { accent: "#ca1b19" } };
    expect(themeFor(doc, null).style).toEqual({ "--color-accent": "#ca1b19", "--color-ink": inkFor("#ca1b19") });
  });
});

// Page builder phase 2: the words a block may change, the notes, and the colour rule.
test.describe("the words a block may change", () => {
  // One block with the given settings, the other pay blocks plain.
  const one = <T extends Block["type"]>(type: T, settings: unknown, slot = "main") => {
    const plain = ["header", "amount", "note", "send"].map((t) => block(t, { slot: t === "header" ? "side" : "main" }));
    const target = block(type, { settings, slot });
    const blocks = plain.some((b) => b.type === type) ? plain.map((b) => (b.type === type ? target : b)) : [...plain, target];
    return find(parsePageDoc(withBlocks(blocks))!.doc, type)!.settings;
  };

  test("every word is empty in both default documents", () => {
    for (const make of [defaultPageDoc, ownerPageDoc]) {
      const doc = make();
      expect(find(doc, "amount")!.settings).toMatchObject({ heading: "", barLabel: "" });
      expect(find(doc, "note")!.settings).toEqual({ heading: "", namePlaceholder: "", messagePlaceholder: "" });
      expect(find(doc, "send")!.settings).toEqual({ heading: "", buttonLabel: "" });
      expect(find(doc, "alertPreview")!.settings).toEqual({ label: "" });
      expect(find(doc, "successScreen")!.settings.line).toBe("");
    }
  });

  test("a document written before the words existed reads with them empty", () => {
    const doc = parsePageDoc(withBlocks([block("header", { slot: "side" }), block("amount", { settings: { ladder: null } }), block("note"), block("send")]))!;
    expect(find(doc.doc, "amount")!.settings).toEqual({ ladder: null, heading: "", barLabel: "" });
    expect(doc.notes).toEqual([]);
  });

  test("each word is kept, and cut at its limit by whole characters", () => {
    expect(one("amount", { ladder: null, heading: "Pick", barLabel: "Heat" })).toMatchObject({ heading: "Pick", barLabel: "Heat" });
    expect(one("amount", { ladder: null, heading: "ऐ".repeat(80) })).toMatchObject({ heading: "ऐ".repeat(LIMITS.heading) });
    expect(one("amount", { barLabel: "b".repeat(80) })).toMatchObject({ barLabel: "b".repeat(LIMITS.barLabel) });
    expect(one("note", { heading: "h".repeat(80), namePlaceholder: "n".repeat(80), messagePlaceholder: "m".repeat(200) })).toEqual({
      heading: "h".repeat(LIMITS.heading),
      namePlaceholder: "n".repeat(LIMITS.namePlaceholder),
      messagePlaceholder: "m".repeat(LIMITS.messagePlaceholder),
    });
    expect(one("send", { heading: "Go", buttonLabel: "b".repeat(40) })).toEqual({ heading: "Go", buttonLabel: "b".repeat(LIMITS.buttonLabel) });
    expect(one("alertPreview", { label: "l".repeat(90) }, "side")).toEqual({ label: "l".repeat(LIMITS.previewLabel) });
    expect(one("successScreen", { style: "owner", line: "t".repeat(90) }, "success")).toEqual({ style: "owner", line: "t".repeat(LIMITS.successLine) });
  });

  test("control characters are removed and words that are not text become empty", () => {
    expect(one("send", { heading: "Se\u0000nd\n", buttonLabel: 5 })).toEqual({ heading: "Send", buttonLabel: "" });
  });
});

test.describe("what the parser tells the owner", () => {
  const notesOf = (blocks: unknown[], theme: unknown = {}) => parsePageDoc(withBlocks(blocks, theme))!.notes;
  const pay = [block("header", { slot: "side" }), block("amount"), block("note"), block("send")];

  test("a clean document has no notes, and neither do the two default documents", () => {
    expect(parsePageDoc(minimal)!.notes).toEqual([]);
    expect(parsePageDoc(defaultPageDoc())!.notes).toEqual([]);
    expect(parsePageDoc(ownerPageDoc())!.notes).toEqual([]);
  });

  test("a cut word says which and how far", () => {
    expect(notesOf([...pay, block("creatorLinks", { slot: "side", settings: { tagline: "x".repeat(90), instagram: "" } })])).toEqual([
      `The tagline was cut to ${LIMITS.tagline} letters.`,
    ]);
  });

  test("a bad Instagram handle, a bad ladder and a word that is not text are reported", () => {
    const notes = notesOf([
      block("header", { slot: "side" }),
      block("amount", { settings: { ladder: { topRupees: 5, levels: [] }, heading: 7 } }),
      block("note"),
      block("send"),
      block("creatorLinks", { slot: "side", settings: { tagline: "", instagram: "a/b" } }),
    ]);
    expect(notes).toContain("The Instagram handle was not valid and was removed.");
    expect(notes).toContain("The rank words were not valid, so the bar was removed.");
    expect(notes).toContain("The amount heading was not text and was removed.");
  });

  test("removed, duplicated, misplaced and repaired blocks are reported", () => {
    const notes = notesOf([
      block("sparkles"),
      block("header", { slot: "side" }),
      block("amount"),
      block("amount"),
      block("note", { visible: false }),
      block("strip", { slot: "main", settings: { left: "a", right: "b" } }),
    ]);
    expect(notes).toEqual([
      "A block that does not exist was removed.",
      "A second Amount block was removed.",
      "The Note block cannot be hidden, so it was shown again.",
      "The Strip block was moved back to its own section.",
      "The Send block was missing, so it was added back.",
    ]);
  });

  test("a colour pair that is dropped says why, with the ratios", () => {
    expect(notesOf(pay, { accent: "#444444", ink: "#555555" })[0]).toMatch(/^The page colours were dropped: the text on the colour is 1\.\d to 1 \(needs 4\.5\)/);
    expect(notesOf(pay, { accent: "red" })).toEqual(["The page colours were dropped: the accent is not a valid #rrggbb colour."]);
    expect(notesOf(pay, { ink: "#f6f6f1" })).toEqual(["The page colours were dropped: the accent is not a valid #rrggbb colour."]);
  });
});

test.describe("the colour rule: ink on accent 4.5 to 1, accent on the page 3 to 1", () => {
  const theme = (accent: string, ink?: string) => parsePageDoc(withBlocks([block("header", { slot: "side" }), block("amount"), block("note"), block("send")], ink ? { accent, ink } : { accent }))!.doc.theme;

  test("the owner's red passes with light ink (it must stay allowed)", () => {
    const checks = pairChecks("#ca1b19", "#f6f6f1");
    expect(checks.accentOnGround).toBeGreaterThanOrEqual(3);
    expect(checks.inkOnAccent).toBeGreaterThanOrEqual(4.5);
    expect(theme("#ca1b19", "#f6f6f1")).toEqual({ accent: "#ca1b19", ink: "#f6f6f1" });
  });

  test("an accent that is too dark for the page is dropped even when its ink reads", () => {
    // Light ink reads on a very dark accent, but the accent itself disappears on the dark page.
    const checks = pairChecks("#2a2a2a", "#f6f6f1");
    expect(checks.inkOnAccent).toBeGreaterThanOrEqual(4.5);
    expect(checks.accentOnGround).toBeLessThan(3);
    expect(theme("#2a2a2a", "#f6f6f1")).toEqual({});
  });

  test("every preset passes both checks", () => {
    for (const preset of ACCENT_PRESETS) expect(pairChecks(preset.hex, inkFor(preset.hex)).ok, preset.id).toBe(true);
  });
});

test.describe("the Pressure meter block (phase 4)", () => {
  const withMeter = (settings: Record<string, unknown> | undefined, slot = "side") =>
    parsePageDoc(withBlocks([block("header", { slot: "side" }), block("pressureMeter", { slot, settings }), block("amount"), block("note"), block("send")]));
  const meter = (settings?: Record<string, unknown>) => find(withMeter(settings)!.doc, "pressureMeter")!.settings;

  test("it is in no default document, and a page without it is unchanged", () => {
    for (const doc of [defaultPageDoc(), ownerPageDoc()]) expect(doc.blocks.some((b) => b.type === "pressureMeter")).toBe(false);
    expect(parsePageDoc(minimal)?.doc).toEqual(minimal);
  });

  test("empty settings give the standard meter", () => {
    expect(meter({})).toEqual({
      goal: null,
      levels: ONE_PIECE_LADDER.levels,
      show: "rupees",
      where: "both",
      celebrate: true,
      fill: null,
      heading: "",
      picture: null,
    });
  });

  test("it can only sit in the left column, and it is not protected", () => {
    expect(find(withMeter({}, "main")!.doc, "pressureMeter")?.slot).toBe("side");
    expect(parsePageDoc(withBlocks([block("header", { slot: "side" }), block("pressureMeter", { visible: false, slot: "side" }), block("amount"), block("note"), block("send")]))!.repairedProtected).toEqual([]);
  });

  test("a goal id that is not a positive whole number is dropped with a note", () => {
    for (const goal of ["7", -1, 0, 1.5, "x", {}, true]) {
      const parsed = withMeter({ goal })!;
      expect(find(parsed.doc, "pressureMeter")!.settings.goal, String(goal)).toBeNull();
      expect(parsed.notes.some((n) => /goal/.test(n)), String(goal)).toBe(true);
    }
    expect(meter({ goal: 12 }).goal).toBe(12);
  });

  test("bad rank words are put back to standard, good ones are kept", () => {
    const bad = [
      [],
      [{ upTo: 1, name: "Only" }],
      [{ upTo: 0.5, name: "A" }, { upTo: 0.4, name: "B" }, { upTo: 1, name: "C" }],
      [{ upTo: 0.5, name: "A" }, { upTo: 0.9, name: "B" }],
      [{ upTo: 0.5, name: "" }, { upTo: 1, name: "B" }],
      "words",
    ];
    for (const levels of bad) expect(meter({ levels }).levels, JSON.stringify(levels)).toEqual(ONE_PIECE_LADDER.levels);
    const good = [{ upTo: 0.5, name: "Warm" }, { upTo: 1, name: "Hot" }];
    expect(meter({ levels: good }).levels).toEqual(good);
  });

  test("unknown show and where fall back, and celebrate is off only when it is false", () => {
    expect(meter({ show: "all", where: "everywhere" })).toMatchObject({ show: "rupees", where: "both" });
    expect(meter({ show: "percent", where: "obs" })).toMatchObject({ show: "percent", where: "obs" });
    expect(meter({ celebrate: false }).celebrate).toBe(false);
    expect(meter({ celebrate: "no" }).celebrate).toBe(true);
  });

  test("a bar colour must be valid and visible on the page ground", () => {
    expect(meter({ fill: "#ff3366" }).fill).toBe("#ff3366");
    expect(meter({ fill: "#FF3366" }).fill).toBe("#ff3366");
    expect(meter({ fill: "red" }).fill).toBeNull();
    expect(meter({ fill: "#222222" }).fill).toBeNull();
    expect(withMeter({ fill: "#222222" })!.notes.some((n) => /too dark/.test(n))).toBe(true);
  });

  test("the heading is cut at its limit", () => {
    expect(meter({ heading: "x".repeat(40) }).heading).toBe("x".repeat(LIMITS.meterHeading));
  });
});
