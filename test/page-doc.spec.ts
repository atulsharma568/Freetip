import { expect, test } from "@playwright/test";
import { LIMITS } from "../src/lib/page-doc/blocks";
import { parsePageDoc, pageDocOrDefault, validateForPublish } from "../src/lib/page-doc/parse";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The tip page document (page builder phase 1): one lenient parser that always gives back a page
// a fan can pay on, whatever was stored.

const block = (type: string, extra: Record<string, unknown> = {}) => ({ id: type, type, visible: true, slot: "main", settings: {}, ...extra });

const minimal: PageDoc = {
  version: 1,
  blocks: [
    { id: "amount", type: "amount", visible: true, slot: "main", settings: { ladder: null } },
    { id: "note", type: "note", visible: true, slot: "main", settings: {} },
    { id: "send", type: "send", visible: true, slot: "main", settings: {} },
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
    expect(typesOf(parsed!.doc)).toEqual(["amount", "note", "send"]);
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
  test("amount, note and send are visible and present, and the repair is reported", () => {
    const parsed = parsePageDoc(withBlocks([block("amount"), block("send", { visible: false })]))!;
    expect(typesOf(parsed.doc)).toEqual(["amount", "send", "note"]);
    expect(parsed.doc.blocks.every((b) => b.visible)).toBe(true);
    expect(find(parsed.doc, "note")?.slot).toBe("main");
    expect(parsed.repairedProtected).toEqual(["note", "send"]);
  });

  test("a clean document reports no repair", () => {
    expect(parsePageDoc(minimal)?.repairedProtected).toEqual([]);
  });

  test("publishing refuses a draft with a hidden or missing pay block", () => {
    const message = "The amount, note and send blocks must stay on the page.";
    expect(validateForPublish(withBlocks([block("amount"), block("note"), block("send", { visible: false })]))).toEqual({ ok: false, message });
    expect(validateForPublish(withBlocks([block("amount"), block("send")]))).toEqual({ ok: false, message });
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
