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
    expect(header(defaultPageDoc()).settings).toEqual({ bannerAsset: null, frame: "none", frameAsset: null, frameScale: 144, bannerFx: "none", bannerFxAsset: null, fxArea: "banner" });
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

  test("the size of a picture frame and where a picture effect plays are kept, clamped and defaulted", async () => {
    const { FRAME_SCALE } = await import("../src/lib/page-doc/decor");
    const kept = parsePageDoc(withHeader({ frameScale: 180, fxArea: "header" }))!;
    expect(header(kept.doc).settings).toMatchObject({ frameScale: 180, fxArea: "header" });
    const big = parsePageDoc(withHeader({ frameScale: 9999 }))!;
    expect(header(big.doc).settings.frameScale).toBe(FRAME_SCALE.max);
    expect(big.notes.join(" ")).toMatch(/size of the photo frame was kept between/);
    const small = parsePageDoc(withHeader({ frameScale: 3 }))!;
    expect(header(small.doc).settings.frameScale).toBe(FRAME_SCALE.min);
    const junk = parsePageDoc(withHeader({ frameScale: "big", fxArea: "everywhere" }))!;
    expect(header(junk.doc).settings).toMatchObject({ frameScale: FRAME_SCALE.standard, fxArea: "banner" });
    // A document stored before these settings existed still opens, with the standard size and the banner.
    const old = parsePageDoc(withHeader({ frameScale: undefined, fxArea: undefined }))!;
    expect(header(old.doc).settings).toMatchObject({ frameScale: FRAME_SCALE.standard, fxArea: "banner" });
  });

  test("the editor sets the size and the area, and shows the size only for a picture frame", async () => {
    const { setNumber } = await import("../src/lib/page-doc/edit");
    const { rangeFieldsFor } = await import("../src/lib/page-doc/fields");
    let doc = setNumber(defaultPageDoc(), "header", "frameScale", 180).doc;
    expect(header(doc).settings.frameScale).toBe(180);
    expect(setNumber(doc, "header", "frameScale", 400).problems.length).toBe(1);
    doc = setChoice(doc, "header", "fxArea", "header").doc;
    expect(header(doc).settings.fxArea).toBe("header");
    expect(setChoice(doc, "header", "fxArea", "elsewhere").problems.length).toBe(1);
    expect(rangeFieldsFor("header", header(doc).settings).length).toBe(0);
    expect(rangeFieldsFor("header", { ...header(doc).settings, frame: "custom" }).map((f) => f.key)).toEqual(["frameScale"]);
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

test.describe("the owner's own page", () => {
  test("starts with the Clutch pulse banner and no ring, and no other page has either", async () => {
    const { ownerPageDoc } = await import("../src/lib/page-doc/defaults");
    expect(header(ownerPageDoc()).settings).toMatchObject({ frame: "none", bannerFx: "clutch" });
    expect(header(defaultPageDoc()).settings).toMatchObject({ frame: "none", bannerFx: "none" });
  });
});

test.describe("the pick saved from the dashboard", () => {
  test("only ready-made looks are read back, anything else is none", async () => {
    const { parseTipDecor } = await import("../src/lib/page-doc/decor");
    expect(parseTipDecor({ frame: "foxfire", bannerFx: "clutch" })).toEqual({ frame: "foxfire", bannerFx: "clutch" });
    expect(parseTipDecor({ frame: "custom", bannerFx: "rainbow" })).toEqual({ frame: "none", bannerFx: "none" });
    for (const fx of ["spider", "storm", "glitch", "petals"]) expect(parseTipDecor({ frame: "none", bannerFx: fx })).toEqual({ frame: "none", bannerFx: fx });
    expect(parseTipDecor({})).toEqual({ frame: "none", bannerFx: "none" });
    for (const nothing of [null, undefined, "x", 5, []]) expect(parseTipDecor(nothing), String(nothing)).toBeNull();
  });

  test("it replaces the header's two settings and any uploaded file there, and nothing else", async () => {
    const { applyTipDecor } = await import("../src/lib/page-doc/decor");
    const doc = withHeader({ frame: "custom", frameAsset: 4, bannerFx: "custom", bannerFxAsset: 5, bannerAsset: 6 });
    const out = applyTipDecor(doc, { frame: "foxfire", bannerFx: "embers" });
    expect(header(out).settings).toEqual({ bannerAsset: 6, frame: "foxfire", frameAsset: null, frameScale: 144, bannerFx: "embers", bannerFxAsset: null, fxArea: "banner" });
    expect(out.blocks.length).toBe(doc.blocks.length);
    expect(applyTipDecor(doc, null)).toBe(doc);
  });

  test("who may pick and whose pick the page wears", async () => {
    const { mayPickTipDecor, wearsTipDecor } = await import("../src/lib/page-doc/decor");
    const off = { paid_features: [] as string[] };
    const on = { paid_features: ["tipDecor"] };
    const onWithPage = { paid_features: ["tipDecor", "pageBuilder"] };
    // The owner's page always; anyone else only with the switch, and a Custom tip page decides its own look.
    expect(mayPickTipDecor(true, off)).toBe(true);
    expect(mayPickTipDecor(false, off)).toBe(false);
    expect(mayPickTipDecor(false, on)).toBe(true);
    expect(mayPickTipDecor(false, null)).toBe(false);
    expect(wearsTipDecor(true, off)).toBe(true);
    expect(wearsTipDecor(true, onWithPage)).toBe(true);
    expect(wearsTipDecor(false, off)).toBe(false);
    expect(wearsTipDecor(false, on)).toBe(true);
    expect(wearsTipDecor(false, onWithPage)).toBe(false);
    expect(wearsTipDecor(false, null)).toBe(false);
  });

  test("the new fox-fire frame is a ready-made look the editor offers too", async () => {
    const { FRAME_OPTIONS, PRESET_FRAMES } = await import("../src/lib/page-doc/decor");
    expect(PRESET_FRAMES).toContain("foxfire");
    expect(FRAME_OPTIONS.map((o) => o.value)).toContain("foxfire");
    const kept = parsePageDoc(withHeader({ frame: "foxfire" }))!;
    expect(header(kept.doc).settings.frame).toBe("foxfire");
  });
});

test.describe("a picture frame and effect in the browser", () => {
  test("the frame is drawn at the size set, and the standard size when none is set", async ({ page }) => {
    await page.goto("/dev-fixtures/decor?scale=180");
    await expect(page.locator(".pf-custom")).toHaveAttribute("style", /--pf-inset:\s*-40\.0%/);
    const photo = await page.locator("span.rounded-full.border-accent").boundingBox();
    const frame = await page.locator(".pf-custom").boundingBox();
    expect(photo && frame && Math.abs(frame.width / photo.width - 1.8) < 0.08).toBe(true);
    await page.goto("/dev-fixtures/decor");
    const standard = await page.locator(".pf-custom").boundingBox();
    const photo2 = await page.locator("span.rounded-full.border-accent").boundingBox();
    expect(photo2 && standard && Math.abs(standard.width / photo2.width - 1.44) < 0.08).toBe(true);
  });

  test("an effect set to the whole header covers the name and bio, not only the banner strip", async ({ page }) => {
    await page.goto("/dev-fixtures/decor?area=header");
    const heading = await page.getByRole("heading", { name: "Fixture" }).boundingBox();
    const overlay = await page.locator("section[aria-label='Creator'] > div > .absolute.inset-0.z-20 .bfx").boundingBox();
    expect(heading && overlay && overlay.y <= heading.y && overlay.y + overlay.height >= heading.y + heading.height).toBe(true);
    // No banner strip is drawn for an effect that covers the header.
    await expect(page.locator(".aspect-\\[16\\/5\\]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/decor-header.png" });

    await page.goto("/dev-fixtures/decor");
    await expect(page.locator(".aspect-\\[16\\/5\\]")).toHaveCount(1);
    await expect(page.locator(".aspect-\\[16\\/5\\] .bfx")).toHaveCount(1);
  });
});
