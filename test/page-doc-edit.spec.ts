import { expect, test } from "@playwright/test";
import { PROTECTED } from "../src/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { moveBlock, resetBlock, setChoice, setLadder, setText, setTheme, setVisible, validateLadder, type EditResult } from "../src/lib/page-doc/edit";
import { TEXT_FIELDS, CHOICE_FIELDS } from "../src/lib/page-doc/fields";
import { ONE_PIECE_LADDER } from "../src/lib/page-doc/ladder";
import { parsePageDoc } from "../src/lib/page-doc/parse";
import type { Block, BlockType, Ladder, PageDoc } from "../src/lib/page-doc/types";

// The editor's pure changes (page builder phase 2).

const order = (doc: PageDoc, slot?: string) => doc.blocks.filter((b) => !slot || b.slot === slot).map((b) => b.type);
const find = <T extends BlockType>(doc: PageDoc, type: T) => doc.blocks.find((b) => b.type === type) as Block<T>;
const frozen = (doc: PageDoc) => JSON.stringify(doc);

test.describe("moving blocks", () => {
  test("a block moves one place inside its own section", () => {
    const r = moveBlock(defaultPageDoc(), "note", "up");
    expect(r).toMatchObject({ changed: true, problems: [] });
    expect(order(r.doc, "main")).toEqual(["note", "amount", "send"]);
  });

  test("it never leaves its section, and the ends do nothing", () => {
    const doc = defaultPageDoc();
    expect(moveBlock(doc, "amount", "up")).toMatchObject({ changed: false, problems: [] });
    expect(moveBlock(doc, "send", "down")).toMatchObject({ changed: false, problems: [] });
    const side = order(doc, "side");
    const down = moveBlock(doc, "qr", "down");
    expect(order(down.doc, "side")).toEqual(side);
    expect(order(moveBlock(doc, "qr", "up").doc, "side")).toEqual(["header", "qr", "alertPreview"]);
  });

  test("a hidden neighbour is stepped over like any other", () => {
    const hidden = setVisible(defaultPageDoc(), "alertPreview", false).doc;
    expect(order(moveBlock(hidden, "qr", "up").doc, "side")).toEqual(["header", "qr", "alertPreview"]);
  });

  test("a block the page does not have gives a problem", () => {
    expect(moveBlock(defaultPageDoc(), "strip", "up")).toMatchObject({ changed: false, problems: ["That block is not on the page."] });
  });

  test("the document given is never changed", () => {
    const doc = defaultPageDoc();
    const before = frozen(doc);
    moveBlock(doc, "note", "up");
    setVisible(doc, "qr", false);
    setText(doc, "send", "heading", "Go");
    setTheme(doc, "#ca1b19", "#f6f6f1");
    setLadder(doc, ONE_PIECE_LADDER);
    expect(frozen(doc)).toBe(before);
  });
});

test.describe("showing and hiding", () => {
  test("protected blocks cannot be hidden", () => {
    for (const type of PROTECTED) {
      const r = setVisible(defaultPageDoc(), type, false);
      expect(r.changed).toBe(false);
      expect(r.problems).toHaveLength(1);
      expect(find(r.doc, type).visible).toBe(true);
    }
  });

  test("the others can be hidden and shown again", () => {
    const hidden = setVisible(ownerPageDoc(), "strip", false);
    expect(find(hidden.doc, "strip").visible).toBe(false);
    expect(find(setVisible(hidden.doc, "strip", true).doc, "strip").visible).toBe(true);
  });

  test("setting what it already is changes nothing", () => {
    expect(setVisible(defaultPageDoc(), "qr", true)).toMatchObject({ changed: false, problems: [] });
  });
});

test.describe("words", () => {
  test("a word is set as typed, spaces and all", () => {
    const r = setText(defaultPageDoc(), "send", "heading", "Send love ");
    expect(find(r.doc, "send").settings.heading).toBe("Send love ");
  });

  test("too long, a line break, a setting that does not exist, and a handle with a slash are refused", () => {
    const doc = ownerPageDoc();
    expect(setText(doc, "send", "heading", "x".repeat(31)).problems).toEqual(["Heading can be at most 30 letters."]);
    expect(setText(doc, "send", "heading", "a\nb").problems).toHaveLength(1);
    expect(setText(doc, "send", "colour", "red").problems).toEqual(["That setting does not exist."]);
    expect(setText(doc, "creatorLinks", "instagram", "a/b").problems).toHaveLength(1);
    expect(setText(doc, "creatorLinks", "instagram", "a.b_c9")).toMatchObject({ changed: true });
    expect(setText(doc, "creatorLinks", "instagram", "")).toMatchObject({ changed: true });
  });

  test("a choice must be one of the options", () => {
    expect(find(setChoice(defaultPageDoc(), "successScreen", "style", "owner").doc, "successScreen").settings.style).toBe("owner");
    expect(setChoice(defaultPageDoc(), "successScreen", "style", "fancy").problems).toHaveLength(1);
  });

  test("a block can go back to its normal settings", () => {
    const edited = setText(defaultPageDoc(), "note", "heading", "Hi").doc;
    expect(find(resetBlock(edited, "note").doc, "note").settings.heading).toBe("");
    expect(resetBlock(defaultPageDoc(), "note").changed).toBe(false);
  });
});

test.describe("the rank ladder", () => {
  const good: Ladder = { topRupees: 1000, levels: [{ upTo: 0.5, name: "Alpha" }, { upTo: 1, name: "Omega" }] };

  test("the standard ladder and a small good one are accepted", () => {
    expect(validateLadder(ONE_PIECE_LADDER)).toEqual([]);
    expect(find(setLadder(defaultPageDoc(), good).doc, "amount").settings.ladder).toEqual(good);
  });

  test("null takes the bar away", () => {
    expect(find(setLadder(ownerPageDoc(), null).doc, "amount").settings.ladder).toBeNull();
  });

  test("each way a ladder can be wrong is named, and the document is left alone", () => {
    const bad = (ladder: Ladder) => validateLadder(ladder);
    expect(bad({ ...good, topRupees: 50 })[0]).toMatch(/top of the bar/);
    expect(bad({ ...good, topRupees: Number.NaN })[0]).toMatch(/top of the bar/);
    expect(bad({ ...good, levels: [good.levels[1]] })[0]).toMatch(/2 to 8 rank words/);
    expect(bad({ ...good, levels: [{ upTo: 0.5, name: " " }, good.levels[1]] })).toContain("Rank 1 needs a word.");
    expect(bad({ ...good, levels: [{ upTo: 0.8, name: "A" }, { upTo: 0.5, name: "B" }, { upTo: 1, name: "C" }] })).toContain(
      "Rank 2 must end higher than the one before, and at most 100%.",
    );
    expect(bad({ ...good, levels: [{ upTo: 0.5, name: "A" }, { upTo: 0.9, name: "B" }] })).toContain("The last rank must end at 100%.");
    const doc = defaultPageDoc();
    const r = setLadder(doc, { ...good, topRupees: 5 });
    expect(r).toMatchObject({ changed: false, doc });
  });

  test("whatever validateLadder accepts, the parser keeps as it is", () => {
    const parsed = parsePageDoc(setLadder(defaultPageDoc(), good).doc)!;
    expect(find(parsed.doc, "amount").settings.ladder).toEqual(good);
    expect(parsed.notes).toEqual([]);
  });
});

test.describe("colours", () => {
  test("the owner's red with light ink is accepted and shows both ratios", () => {
    const r = setTheme(defaultPageDoc(), "#CA1B19", "#f6f6f1");
    expect(r).toMatchObject({ changed: true, problems: [] });
    expect(r.doc.theme).toEqual({ accent: "#ca1b19", ink: "#f6f6f1" });
    expect(r.checks!.accentOnGround).toBeGreaterThanOrEqual(3);
    expect(r.checks!.inkOnAccent).toBeGreaterThanOrEqual(4.5);
  });

  test("an accent alone lets the page choose the ink", () => {
    expect(setTheme(defaultPageDoc(), "#7dd3fc", null).doc.theme).toEqual({ accent: "#7dd3fc" });
  });

  test("a pair that fails either check is refused with the ratios", () => {
    const dim = setTheme(defaultPageDoc(), "#2a2a2a", "#f6f6f1");
    expect(dim.changed).toBe(false);
    expect(dim.problems).toEqual([expect.stringMatching(/on the page is \d\.\d to 1; it needs 3\./)]);
    const clash = setTheme(defaultPageDoc(), "#444444", "#555555");
    expect(clash.problems[0]).toMatch(/text on this colour is 1\.\d to 1; it needs 4\.5\./);
    expect(clash.checks).not.toBeNull();
    expect(setTheme(defaultPageDoc(), "red", null).problems).toEqual(["Colours are written as #rrggbb."]);
  });

  test("null goes back to the creator's own colour", () => {
    expect(setTheme(ownerPageDoc(), null, null).doc.theme).toEqual({});
    expect(setTheme(defaultPageDoc(), null, null).changed).toBe(false);
  });
});

// Any run of changes leaves a document the parser accepts without a single note: what the editor
// shows in the preview is exactly what is saved and shown to fans.
test.describe("any sequence of changes stays a clean document", () => {
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  }
  const TYPES = [...new Set([...defaultPageDoc().blocks, ...ownerPageDoc().blocks].map((b) => b.type))];
  const WORDS = ["", "Hi", "a b", "x".repeat(70), "a/b", "line\nbreak", "ऐ".repeat(10), "@@", " lead", "trail "];
  const COLOURS: [string, string | null][] = [["#ca1b19", "#f6f6f1"], ["#bfe84a", null], ["#2a2a2a", "#f6f6f1"], ["nope", null], ["#7dd3fc", "#14170a"]];

  test("400 random changes, five starting points", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const next = rng(seed);
      const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)];
      let doc = seed % 2 ? defaultPageDoc() : ownerPageDoc();
      for (let step = 0; step < 80; step++) {
        const type = pick(TYPES);
        const op = Math.floor(next() * 7);
        let r: EditResult;
        if (op === 0) r = moveBlock(doc, type, pick(["up", "down"] as const));
        else if (op === 1) r = setVisible(doc, type, next() < 0.5);
        else if (op === 2) {
          const fields: { key: string }[] = TEXT_FIELDS[type].length ? TEXT_FIELDS[type] : [{ key: "none" }];
          const field = pick(fields);
          r = setText(doc, type, field.key, pick(WORDS));
        } else if (op === 3) r = setChoice(doc, type, "style", pick(["default", "owner", "other"]));
        else if (op === 4) r = setTheme(doc, ...pick(COLOURS));
        else if (op === 5) r = setLadder(doc, next() < 0.3 ? null : { topRupees: pick([50, 500, 5000]), levels: pick([ONE_PIECE_LADDER.levels, [{ upTo: 1, name: "One" }]]) });
        else r = resetBlock(doc, type);
        doc = r.doc;
        const parsed = parsePageDoc(doc)!;
        expect(parsed.repairedProtected, `seed ${seed} step ${step}`).toEqual([]);
        // A word the editor allowed may still be trimmed by the parser (leading or trailing spaces);
        // nothing else may differ, and nothing may be reported as cut or dropped.
        expect(parsed.notes, `seed ${seed} step ${step}`).toEqual([]);
      }
    }
  });
});

test.describe("the tables", () => {
  test("every choice field has at least two options", () => {
    for (const type of Object.keys(CHOICE_FIELDS) as BlockType[]) for (const f of CHOICE_FIELDS[type]) expect(f.options.length).toBeGreaterThanOrEqual(2);
  });
});
