import { expect, test } from "@playwright/test";
import { usableFor, usedAssetIds } from "../src/lib/page-doc/assets";
import { EMBER_COUNT, steady } from "../src/lib/page-doc/decor";
import { defaultPageDoc } from "../src/lib/page-doc/defaults";
import { setAsset, setChoice, swapAsset } from "../src/lib/page-doc/edit";
import { parsePageDoc } from "../src/lib/page-doc/parse";
import { asTemplate } from "../src/lib/page-doc/store";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The animated frame over the photo and the effect over the banner (the header block).

const header = (doc: PageDoc) => doc.blocks.find((b) => b.type === "header") as Block<"header">;
const withHeader = (patch: Record<string, unknown>): PageDoc => {
  const doc = defaultPageDoc();
  return { ...doc, blocks: doc.blocks.map((b) => (b.type === "header" ? ({ ...b, settings: { ...b.settings, ...patch } } as Block) : b)) };
};

test.describe("photo frame and banner effect", () => {
  test("a page that sets nothing has no frame and no effect", () => {
    expect(header(defaultPageDoc()).settings).toEqual({ bannerAsset: null, frame: "none", frameAsset: null, bannerFx: "none", bannerFxAsset: null });
  });

  test("a chosen look is kept, an unknown one becomes none", () => {
    const kept = parsePageDoc(withHeader({ frame: "flame", bannerFx: "embers" }))!;
    expect(header(kept.doc).settings).toMatchObject({ frame: "flame", bannerFx: "embers" });
    const bad = parsePageDoc(withHeader({ frame: "rainbow", bannerFx: 5 }))!;
    expect(header(bad.doc).settings).toMatchObject({ frame: "none", bannerFx: "none" });
  });

  test("a bad file id is removed with a note", () => {
    const parsed = parsePageDoc(withHeader({ frame: "custom", frameAsset: "7", bannerFxAsset: -1 }))!;
    expect(header(parsed.doc).settings).toMatchObject({ frameAsset: null, bannerFxAsset: null });
    expect(parsed.notes.join(" ")).toMatch(/photo frame picture was not valid/);
    expect(parsed.notes.join(" ")).toMatch(/banner effect picture was not valid/);
  });

  test("the files count as used, so Remove is refused while a page shows them", () => {
    expect(usedAssetIds(withHeader({ bannerAsset: 1, frameAsset: 2, bannerFxAsset: 3 }))).toEqual([1, 2, 3]);
    expect(usedAssetIds(withHeader({ frameAsset: 2, bannerFxAsset: 2 }))).toEqual([2]);
  });

  test("a frame or effect takes a picture or GIF, never a video", () => {
    for (const use of ["frame", "fx"] as const) {
      expect(usableFor("image", use)).toBe(true);
      expect(usableFor("gif", use)).toBe(true);
      expect(usableFor("webm", use)).toBe(false);
    }
  });

  test("setAsset sets each of the header's three places on its own", () => {
    let doc = defaultPageDoc();
    doc = setAsset(doc, "header", 4).doc; // no place named: the banner, as before
    doc = setAsset(doc, "header", 5, "frameAsset").doc;
    doc = setAsset(doc, "header", 6, "bannerFxAsset").doc;
    expect(header(doc).settings).toMatchObject({ bannerAsset: 4, frameAsset: 5, bannerFxAsset: 6 });
    expect(setAsset(doc, "header", 6, "bannerFxAsset").changed).toBe(false);
    expect(setAsset(doc, "header", 1, "name").problems.length).toBe(1);
    expect(setAsset(doc, "header", null, "frameAsset").doc).not.toBe(doc);
  });

  test("the choices are set through the editor and refuse an unknown one", () => {
    const doc = setChoice(defaultPageDoc(), "header", "frame", "slash").doc;
    expect(header(doc).settings.frame).toBe("slash");
    expect(setChoice(doc, "header", "bannerFx", "slashes").doc).not.toBe(doc);
    expect(setChoice(doc, "header", "frame", "rainbow").problems.length).toBe(1);
  });

  test("Replace moves each place that shows the old file, and keeps a place the new file does not fit", () => {
    const doc = withHeader({ bannerAsset: 1, frameAsset: 1, bannerFxAsset: 2 });
    const out = swapAsset(doc, 1, 9, "gif");
    expect(header(out.doc).settings).toMatchObject({ bannerAsset: 9, frameAsset: 9, bannerFxAsset: 2 });
    expect(swapAsset(doc, 1, 9, "webm").problems.length).toBe(1);
  });

  test("a copy as a template leaves the other creator's files behind", () => {
    const out = asTemplate(withHeader({ frame: "custom", frameAsset: 5, bannerFx: "custom", bannerFxAsset: 6, bannerAsset: 7 }));
    expect(header(out.doc).settings).toMatchObject({ frame: "custom", bannerFx: "custom", frameAsset: null, bannerFxAsset: null, bannerAsset: null });
    expect(out.removed).toEqual(expect.arrayContaining(["the banner picture", "the photo frame picture", "the banner effect picture"]));
  });

  test("the lights sit in the same places every time", () => {
    expect(steady(3, 4)).toBe(steady(3, 4));
    for (let i = 0; i < EMBER_COUNT; i++) {
      const v = steady(i, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
