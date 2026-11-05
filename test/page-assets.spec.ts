import { expect, test } from "@playwright/test";
import {
  ASSET_LIMITS,
  checkAssetAllowance,
  checkAssetFile,
  checkPosterFile,
  cleanAssetId,
  cleanDuration,
  isAnimatedPicture,
  isPageAssetUrl,
  kindsFor,
  needsPoster,
  pageAssetPrefix,
  pictureSize,
  replaceAssetId,
  usableFor,
  usedAssetIds,
} from "../src/lib/page-doc/assets";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock, setAsset, setNumber, swapAsset } from "../src/lib/page-doc/edit";
import { mayPlayMotion, readMotionEnv, type MotionEnv, type MotionWindow } from "../src/lib/page-doc/motion";
import { parsePageDoc } from "../src/lib/page-doc/parse";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The rules for the pictures of a tip page (page builder phase 3): what a file may be, how a
// document points at one, and how a bad pointer is read. Pure, no database.

const MB = 1024 * 1024;
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const pad = (head: number[], total = 64) => Uint8Array.from([...head, ...new Array(Math.max(0, total - head.length)).fill(0)]);

const png = (w: number, h: number) => {
  const bytes = pad([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 0, 0, 0, 0, 0, 0], 40);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, w);
  view.setUint32(20, h);
  return bytes;
};
const gif = () => pad([...ascii("GIF89a"), 64, 0, 64, 0]);
const le16 = (n: number) => [n & 0xff, n >> 8];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
// A lossy WebP header: VP8 chunk, frame tag, start code, width and height.
const webp = (w = 800, h = 600) => pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8 "), 20, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(w), ...le16(h)]);
// An animated WebP: the extended header with its animation flag set.
const animatedWebp = () => pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"), 10, 0, 0, 0, 0x02, 0, 0, 0, ...le24(799), ...le24(599)]);
// A JPEG: start, a short JFIF block, then the frame header with the size.
const jpeg = (w: number, h: number) => pad([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 0xff, w >> 8, w & 0xff, 3]);
// An animated PNG: an acTL chunk before the pixels.
const apng = () =>
  pad(
    [
      ...[0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a],
      ...[0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 3, 32, 0, 0, 2, 88, 8, 6, 0, 0, 0, 0, 0, 0, 0],
      ...[0, 0, 0, 8, ...ascii("acTL"), 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    80,
  );
const webm = () => pad([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, ...ascii("webm")]);
const exe = () => pad([...ascii("MZ")]);

const find = <T extends Block["type"]>(doc: PageDoc, type: T) => doc.blocks.find((b) => b.type === type) as Block<T> | undefined;

const withSettings = (doc: PageDoc, type: string, patch: Record<string, unknown>): PageDoc => ({
  ...doc,
  blocks: doc.blocks.map((b) => (b.type === type ? ({ ...b, settings: { ...b.settings, ...patch } } as Block) : b)),
});

test.describe("which files may be used where", () => {
  test("a backdrop takes any kind, a banner a picture or a GIF", () => {
    expect(kindsFor("backdrop")).toEqual(["image", "gif", "webm"]);
    expect(kindsFor("banner")).toEqual(["image", "gif"]);
    expect(usableFor("webm", "backdrop")).toBe(true);
    expect(usableFor("webm", "banner")).toBe(false);
    expect(usableFor("gif", "banner")).toBe(true);
  });

  test("animated files need a still, a picture does not", () => {
    expect(needsPoster("gif")).toBe(true);
    expect(needsPoster("webm")).toBe(true);
    expect(needsPoster("image")).toBe(false);
  });
});

test.describe("an asset id in a document", () => {
  test("only a positive whole number is an id", () => {
    expect(cleanAssetId(1)).toBe(1);
    expect(cleanAssetId(42)).toBe(42);
    for (const bad of [0, -1, 1.5, NaN, Infinity, "3", null, undefined, {}, [], true, 2 ** 60]) expect(cleanAssetId(bad), String(bad)).toBeNull();
  });

  test("a claimed length is kept only when sane and inside the cap", () => {
    expect(cleanDuration(8000)).toBe(8000);
    expect(cleanDuration(15_040)).toBe(15_040);
    for (const bad of [0, -5, 15_100, NaN, "8", null]) expect(cleanDuration(bad), String(bad)).toBeNull();
  });
});

test.describe("the server's check of an uploaded file", () => {
  test("accepts a PNG, a GIF, a WebP and a WebM that are small enough", () => {
    for (const [bytes, kind] of [[png(800, 600), "image"], [gif(), "gif"], [webp(), "image"], [webm(), "webm"]] as const) {
      const checked = checkAssetFile(bytes, 100_000);
      expect(checked.ok).toBe(true);
      if (checked.ok) expect(checked.sniffed.kind).toBe(kind);
    }
  });

  test("refuses a program with a picture's name, whatever the size", () => {
    expect(checkAssetFile(exe(), 1000).ok).toBe(false);
  });

  test("a picture or GIF is capped at 3 MB and a WebM at 8 MB", () => {
    expect(checkAssetFile(png(10, 10), 3 * MB).ok).toBe(true);
    expect(checkAssetFile(png(10, 10), 3 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(gif(), 3 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(webm(), 8 * MB).ok).toBe(true);
    expect(checkAssetFile(webm(), 8 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(png(10, 10), 0).ok).toBe(false);
  });

  test("a picture over 4096 pixels on a side is refused", () => {
    expect(checkAssetFile(png(4096, 4096), 1000).ok).toBe(true);
    expect(checkAssetFile(png(4097, 100), 1000).ok).toBe(false);
  });

  test("a JPEG's and a WebP's size is read by the server, not trusted from the browser", () => {
    expect(pictureSize(jpeg(1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(pictureSize(webp(1280, 720))).toEqual({ width: 1280, height: 720 });
    expect(pictureSize(animatedWebp())).toEqual({ width: 800, height: 600 });
    const checked = checkAssetFile(jpeg(1920, 1080), 1000);
    expect(checked.ok && checked.sniffed).toMatchObject({ kind: "image", width: 1920, height: 1080 });
    expect(checkAssetFile(jpeg(5000, 100), 1000).ok).toBe(false);
    expect(checkAssetFile(jpeg(100, 5000), 1000).ok).toBe(false);
    expect(checkAssetFile(webp(8000, 100), 1000).ok).toBe(false);
    // A JPEG whose size cannot be found is refused rather than guessed.
    expect(checkAssetFile(pad([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]), 1000).ok).toBe(false);
  });

  test("an animated WebP is kept as an animated picture (a \"gif\" with a still), an animated PNG is refused", () => {
    expect(isAnimatedPicture(animatedWebp())).toBe(true);
    expect(isAnimatedPicture(apng())).toBe(true);
    expect(isAnimatedPicture(webp())).toBe(false);
    expect(isAnimatedPicture(png(10, 10))).toBe(false);
    expect(isAnimatedPicture(gif())).toBe(false);
    const a = checkAssetFile(animatedWebp(), 1000);
    // Stored as a gif so it follows the same still-until-motion-is-allowed rules everywhere.
    expect(a.ok && a.sniffed).toMatchObject({ kind: "gif", mime: "image/webp", width: 800, height: 600 });
    const b = checkAssetFile(apng(), 1000);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toMatch(/animated png/i);
    // A poster is always a still.
    expect(checkPosterFile(animatedWebp(), 1000).ok).toBe(false);
    expect(checkPosterFile(apng(), 1000).ok).toBe(false);
  });

  test("an animated WebP may be 6 MB, a still picture or a GIF only 3 MB", () => {
    expect(checkAssetFile(animatedWebp(), 6 * MB).ok).toBe(true);
    expect(checkAssetFile(animatedWebp(), 6 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(webp(), 3 * MB).ok).toBe(true);
    expect(checkAssetFile(webp(), 3 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(jpeg(100, 100), 3 * MB + 1).ok).toBe(false);
    expect(checkAssetFile(gif(), 3 * MB + 1).ok).toBe(false);
  });

  test("an animated WebP can be a frame or an effect, like a GIF", () => {
    const a = checkAssetFile(animatedWebp(), 1000);
    expect(a.ok && usableFor(a.sniffed.kind, "frame")).toBe(true);
    expect(a.ok && usableFor(a.sniffed.kind, "fx")).toBe(true);
    expect(a.ok && needsPoster(a.sniffed.kind)).toBe(true);
  });

  test("truncated or odd bytes never throw", () => {
    for (const bytes of [pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"), 255, 255, 255, 255]), pad([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 255, 255, 255, 255]), pad([0xff, 0xd8, 0xff, 0xc0])]) {
      expect(() => isAnimatedPicture(bytes)).not.toThrow();
      expect(() => pictureSize(bytes)).not.toThrow();
      expect(() => checkAssetFile(bytes, 1000)).not.toThrow();
    }
  });
});

test.describe("the still picture of the first frame", () => {
  test("a small PNG or WebP passes", () => {
    expect(checkPosterFile(png(1280, 720), 100_000)).toEqual({ ok: true, mime: "image/png" });
    expect(checkPosterFile(webp(), 100_000)).toEqual({ ok: true, mime: "image/webp" });
  });

  test("a GIF, a video, a program or something too big is refused", () => {
    expect(checkPosterFile(gif(), 1000).ok).toBe(false);
    expect(checkPosterFile(webm(), 1000).ok).toBe(false);
    expect(checkPosterFile(exe(), 1000).ok).toBe(false);
    expect(checkPosterFile(webp(), ASSET_LIMITS.posterBytes + 1).ok).toBe(false);
    expect(checkPosterFile(webp(), 0).ok).toBe(false);
  });
});

test.describe("what a page may keep", () => {
  test("ten files and 40 MB", () => {
    expect(checkAssetAllowance({ files: 9, bytes: 0 }, MB)).toBeNull();
    expect(checkAssetAllowance({ files: 10, bytes: 0 }, MB)).toMatch(/10 files/);
    expect(checkAssetAllowance({ files: 1, bytes: 39 * MB }, MB)).toBeNull();
    expect(checkAssetAllowance({ files: 1, bytes: 39 * MB }, MB + 1)).toMatch(/40 MB/);
  });
});

test.describe("where a stored file may be", () => {
  const ok = "https://abc123.public.blob.vercel-storage.com/page/7/clip-xyz.webm";

  test("only our own store, under that creator's page folder", () => {
    expect(pageAssetPrefix(7)).toBe("page/7/");
    expect(isPageAssetUrl(ok, 7)).toBe(true);
    expect(isPageAssetUrl(ok, 8)).toBe(false);
    expect(isPageAssetUrl("https://abc123.public.blob.vercel-storage.com/media/7/x.webm", 7)).toBe(false);
    expect(isPageAssetUrl("https://evil.example.com/page/7/x.webm", 7)).toBe(false);
    expect(isPageAssetUrl("http://abc123.public.blob.vercel-storage.com/page/7/x.webm", 7)).toBe(false);
    expect(isPageAssetUrl("https://abc123.public.blob.vercel-storage.com/page/7/../8/x.webm", 7)).toBe(false);
    expect(isPageAssetUrl(7, 7)).toBe(false);
  });
});

test.describe("reading the picture settings of a stored document", () => {
  const owner = ownerPageDoc();

  test("the two normal pages read back exactly as they are, with nothing to report", () => {
    for (const doc of [defaultPageDoc(), owner]) {
      const parsed = parsePageDoc(doc)!;
      expect(parsed.doc).toEqual(doc);
      expect(parsed.notes).toEqual([]);
    }
  });

  test("a document from before pictures existed gets the standard picture settings", () => {
    const old = {
      version: 1,
      theme: {},
      blocks: [
        { id: "backdrop", type: "backdrop", visible: true, slot: "background", settings: { style: "ember" } },
        { id: "header", type: "header", visible: true, slot: "side", settings: {} },
        { id: "amount", type: "amount", visible: true, slot: "main", settings: {} },
        { id: "note", type: "note", visible: true, slot: "main", settings: {} },
        { id: "send", type: "send", visible: true, slot: "main", settings: {} },
      ],
    };
    const parsed = parsePageDoc(old)!;
    expect(find(parsed.doc, "backdrop")!.settings).toEqual({ style: "ember", asset: null, dim: 40 });
    expect(find(parsed.doc, "header")!.settings).toEqual({ bannerAsset: null, avatar: "none", frame: "none", frameAsset: null, frameScale: 144, bannerFx: "none", bannerFxAsset: null, fxArea: "banner" });
    expect(parsed.notes).toEqual([]);
  });

  test("a picture backdrop and a banner picture are kept", () => {
    const doc = withSettings(withSettings(owner, "backdrop", { style: "media", asset: 5, dim: 65 }), "header", { bannerAsset: 6 });
    const parsed = parsePageDoc(doc)!;
    expect(find(parsed.doc, "backdrop")!.settings).toEqual({ style: "media", asset: 5, dim: 65 });
    // The owner's page starts with the Clutch pulse banner; picking a banner picture leaves that alone.
    expect(find(parsed.doc, "header")!.settings).toEqual({ bannerAsset: 6, avatar: "none", frame: "none", frameAsset: null, frameScale: 144, bannerFx: "clutch", bannerFxAsset: null, fxArea: "banner" });
    expect(usedAssetIds(parsed.doc)).toEqual([5, 6]);
  });

  test("a bad id is removed with a note, never kept", () => {
    for (const bad of ["5", 0, -3, 2.5, {}, [], true]) {
      const parsed = parsePageDoc(withSettings(owner, "backdrop", { style: "media", asset: bad }))!;
      expect(find(parsed.doc, "backdrop")!.settings.asset, String(bad)).toBeNull();
      expect(parsed.notes.join(" ")).toMatch(/backdrop picture was not valid/);
    }
    const header = parsePageDoc(withSettings(owner, "header", { bannerAsset: "x" }))!;
    expect(find(header.doc, "header")!.settings.bannerAsset).toBeNull();
  });

  test("how dark the layer is stays between 0 and 80", () => {
    const dim = (v: unknown) => find(parsePageDoc(withSettings(owner, "backdrop", { dim: v }))!.doc, "backdrop")!.settings.dim;
    expect(dim(0)).toBe(0);
    expect(dim(80)).toBe(80);
    expect(dim(95)).toBe(80);
    expect(dim(-10)).toBe(0);
    expect(dim(42.4)).toBe(42);
    expect(dim("dark")).toBe(40);
    expect(dim(undefined)).toBe(40);
    expect(dim(NaN)).toBe(40);
  });

  test("an unknown backdrop style is the smoke and embers", () => {
    expect(find(parsePageDoc(withSettings(owner, "backdrop", { style: "video" }))!.doc, "backdrop")!.settings.style).toBe("ember");
  });

  test("a document can still be published with pictures in it", () => {
    const doc = withSettings(owner, "backdrop", { style: "media", asset: 9 });
    expect(parsePageDoc(doc)!.doc).toEqual(doc);
  });
});

test.describe("pointing a page at another file", () => {
  const base = withSettings(withSettings(ownerPageDoc(), "backdrop", { style: "media", asset: 5 }), "header", { bannerAsset: 5 });

  test("usedAssetIds lists each file once", () => {
    expect(usedAssetIds(base)).toEqual([5]);
    expect(usedAssetIds(defaultPageDoc())).toEqual([]);
  });

  test("replaceAssetId rewrites every place that used the file", () => {
    const out = replaceAssetId(base, 5, 9);
    expect(out.changed).toBe(true);
    expect(usedAssetIds(out.doc)).toEqual([9]);
    expect(usedAssetIds(base)).toEqual([5]); // the first document is not touched
    expect(replaceAssetId(base, 77, 9).changed).toBe(false);
  });

  test("swapAsset is the same through the editor, and refuses nonsense", () => {
    expect(usedAssetIds(swapAsset(base, 5, 9).doc)).toEqual([9]);
    expect(swapAsset(base, 5, 9).changed).toBe(true);
    expect(swapAsset(base, 77, 9).changed).toBe(false);
    expect(swapAsset(base, 5, 0).problems.length).toBe(1);
    expect(swapAsset(base, 5.5, 9).changed).toBe(false);
  });

  test("a new file only goes where its kind fits: a video does not become a banner", () => {
    const out = replaceAssetId(base, 5, 9, "webm");
    expect(out.changed).toBe(true);
    const backdrop = find(out.doc, "backdrop")!.settings.asset;
    const banner = find(out.doc, "header")!.settings.bannerAsset;
    expect([backdrop, banner]).toEqual([9, 5]);
    const refused = swapAsset(withSettings(defaultPageDoc(), "header", { bannerAsset: 5 }), 5, 9, "webm");
    expect(refused.changed).toBe(false);
    expect(refused.problems.length).toBe(1);
    expect(swapAsset(base, 5, 9, "gif").changed).toBe(true);
    expect(usedAssetIds(swapAsset(base, 5, 9, "gif").doc)).toEqual([9]);
  });

  test("setAsset sets and clears the picture of the backdrop and the header only", () => {
    const set = setAsset(defaultPageDoc(), "header", 3);
    expect(set.changed).toBe(true);
    expect(find(set.doc, "header")!.settings.bannerAsset).toBe(3);
    expect(find(setAsset(set.doc, "header", null).doc, "header")!.settings.bannerAsset).toBeNull();
    expect(setAsset(set.doc, "header", 3).changed).toBe(false);
    expect(setAsset(defaultPageDoc(), "amount", 3).problems.length).toBe(1);
    expect(setAsset(defaultPageDoc(), "header", -1).problems.length).toBe(1);
    expect(setAsset(defaultPageDoc(), "backdrop", 3).problems.length).toBe(1); // no backdrop block yet
  });
});

test.describe("giving a page a backdrop", () => {
  test("a page without one gets a picture backdrop behind everything, with no picture yet", () => {
    const out = addBlock(defaultPageDoc(), "backdrop");
    expect(out.changed).toBe(true);
    expect(out.doc.blocks[0].type).toBe("backdrop");
    expect(find(out.doc, "backdrop")).toMatchObject({ visible: true, slot: "background", settings: { style: "media", asset: null, dim: 40 } });
    // It survives the parser as it is.
    expect(parsePageDoc(out.doc)!.doc).toEqual(out.doc);
  });

  test("a page that has one cannot get a second", () => {
    expect(addBlock(ownerPageDoc(), "backdrop").changed).toBe(false);
  });

  test("setNumber sets the darkening inside its range", () => {
    const doc = addBlock(defaultPageDoc(), "backdrop").doc;
    expect(find(setNumber(doc, "backdrop", "dim", 60).doc, "backdrop")!.settings.dim).toBe(60);
    expect(setNumber(doc, "backdrop", "dim", 90).problems.length).toBe(1);
    expect(setNumber(doc, "backdrop", "dim", 40).changed).toBe(false);
    expect(setNumber(doc, "amount", "dim", 40).problems.length).toBe(1);
  });
});

test.describe("when a page may play motion", () => {
  const open: MotionEnv = { reducedMotion: false, saveData: false, effectiveType: "4g", deviceMemory: 8 };

  test("a fast, ordinary device plays", () => {
    expect(mayPlayMotion(open)).toBe(true);
  });

  test("each reason on its own keeps the still", () => {
    expect(mayPlayMotion({ ...open, reducedMotion: true })).toBe(false);
    expect(mayPlayMotion({ ...open, saveData: true })).toBe(false);
    for (const slow of ["slow-2g", "2g", "3g"]) expect(mayPlayMotion({ ...open, effectiveType: slow }), slow).toBe(false);
    expect(mayPlayMotion({ ...open, deviceMemory: 2 })).toBe(false);
    expect(mayPlayMotion({ ...open, deviceMemory: 0.5 })).toBe(false);
    expect(mayPlayMotion({ ...open, deviceMemory: 4 })).toBe(true);
  });

  test("a browser that does not say (Safari) is not held back for it", () => {
    expect(mayPlayMotion({ ...open, effectiveType: null, deviceMemory: null })).toBe(true);
    expect(mayPlayMotion({ reducedMotion: true, saveData: false, effectiveType: null, deviceMemory: null })).toBe(false);
  });

  test("reads the browser's own reports, and tolerates a window that has none of them", () => {
    const win: MotionWindow = {
      matchMedia: (q) => ({ matches: q.includes("reduce") }),
      navigator: { connection: { saveData: true, effectiveType: "3g" }, deviceMemory: 1 },
    };
    expect(readMotionEnv(win)).toEqual({ reducedMotion: true, saveData: true, effectiveType: "3g", deviceMemory: 1 });
    expect(readMotionEnv({})).toEqual({ reducedMotion: false, saveData: false, effectiveType: null, deviceMemory: null });
    expect(mayPlayMotion(readMotionEnv({}))).toBe(true);
  });
});
