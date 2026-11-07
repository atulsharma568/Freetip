import { expect, test } from "@playwright/test";
import { DECOR_ANCHORS, parsePlacement, parseTipDecor, placementBox } from "../src/lib/page-doc/decor";
import { checkPicture, describeRule, hasAlpha } from "../src/lib/upload-rules";

// Small made-up files: only the headers the checks read.
function png(w: number, h: number, colour: 2 | 6 | 3 = 6, trns = false): Uint8Array {
  const b: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  b.push(...u32(w), ...u32(h), 8, colour, 0, 0, 0, 0, 0, 0, 0);
  if (trns) b.push(0, 0, 0, 1, 0x74, 0x52, 0x4e, 0x53, 0, 0, 0, 0, 0);
  b.push(0, 0, 0, 1, 0x49, 0x44, 0x41, 0x54, 0, 0, 0, 0, 0);
  return new Uint8Array(b);
}
function gif(w: number, h: number): Uint8Array {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8, 0, 0, 0, 0, 0, 0, 0, 0]);
}
function webp(w: number, h: number, flags: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, flags, 0, 0, 0]);
  const wm = w - 1, hm = h - 1;
  b.set([wm & 255, (wm >> 8) & 255, (wm >> 16) & 255, hm & 255, (hm >> 8) & 255, (hm >> 16) & 255], 24);
  return b;
}
function jpeg(w: number, h: number): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0, 0, 0]);
}
const check = (kind: "decorFrame" | "decorAvatar", f: Uint8Array, size = f.length) => checkPicture(kind, f, size);

test.describe("upload rules", () => {
  test("a transparent square PNG of 512 px passes as a decoration", () => {
    const r = check("decorFrame", png(512, 512));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.picture).toMatchObject({ mime: "image/png", width: 512, height: 512, animated: false, alpha: true });
  });

  test("a decoration is refused when it is too small, not square, a JPG, a video, opaque or too big", () => {
    expect(check("decorFrame", png(300, 300))).toMatchObject({ ok: false, reason: expect.stringContaining("at least 512") });
    expect(check("decorFrame", png(1024, 512))).toMatchObject({ ok: false, reason: expect.stringContaining("square") });
    expect(check("decorFrame", jpeg(800, 800))).toMatchObject({ ok: false, reason: expect.stringContaining("not a JPG") });
    expect(check("decorFrame", png(512, 512, 2))).toMatchObject({ ok: false, reason: expect.stringContaining("see-through") });
    expect(check("decorFrame", png(5000, 5000))).toMatchObject({ ok: false, reason: expect.stringContaining("4096") });
    expect(check("decorFrame", png(512, 512), 4 * 1024 * 1024)).toMatchObject({ ok: false, reason: expect.stringContaining("3 MB") });
    expect(check("decorFrame", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0, 0, 0, 0, 0]))).toMatchObject({ ok: false });
  });

  test("an opaque PNG passes when it has a tRNS chunk; a GIF always counts as see-through", () => {
    expect(check("decorFrame", png(512, 512, 3, true)).ok).toBe(true);
    expect(check("decorFrame", gif(512, 512))).toMatchObject({ ok: true, picture: { animated: true } });
  });

  test("a WebP's size and see-through flag are read from its header", () => {
    expect(check("decorFrame", webp(600, 600, 0x10))).toMatchObject({ ok: true, picture: { width: 600, height: 600, alpha: true, animated: false } });
    expect(check("decorFrame", webp(600, 600, 0x12))).toMatchObject({ ok: true, picture: { animated: true } });
    expect(check("decorFrame", webp(600, 600, 0x00))).toMatchObject({ ok: false, reason: expect.stringContaining("see-through") });
    expect(hasAlpha(webp(10, 10, 0x10), "image/webp")).toBe(true);
  });

  test("a profile picture may be a JPG, needs 256 px and is allowed to be a little off square", () => {
    expect(check("decorAvatar", jpeg(300, 300)).ok).toBe(true);
    expect(check("decorAvatar", jpeg(300, 340)).ok).toBe(true);
    expect(check("decorAvatar", jpeg(200, 200))).toMatchObject({ ok: false, reason: expect.stringContaining("at least 256") });
    expect(check("decorAvatar", jpeg(300, 600))).toMatchObject({ ok: false, reason: expect.stringContaining("square") });
  });

  test("the list the creator reads states the same numbers the checks use", () => {
    const text = describeRule("decorFrame").join(" ");
    for (const part of ["PNG, GIF or WebP", "Not JPG", "3 MB", "512 × 512", "4096 on the longest side", "see-through"]) expect(text).toContain(part);
    expect(describeRule("decorAvatar").join(" ")).toContain("256 × 256");
  });
});

test.describe("decoration placement", () => {
  test("a decoration saved before placements existed keeps its ring and its size", () => {
    const d = parseTipDecor({ frameUpload: { url: "https://x.public.blob.vercel-storage.com/decor/1/frame-a.png" }, frameScale: 180 })!;
    expect(d.frameUpload?.placement).toEqual({ anchor: "ring", size: 180, dx: 0, dy: 0 });
    expect(d.frameUpload?.itemId).toBeNull();
  });

  test("a stored placement is clamped and an unknown anchor becomes the ring", () => {
    expect(parsePlacement({ anchor: "top-right", size: 9999, dx: -500, dy: 500 })).toEqual({ anchor: "top-right", size: 220, dx: -40, dy: 40 });
    expect(parsePlacement({ anchor: "sideways", size: 10 })).toEqual({ anchor: "ring", size: 100, dx: 0, dy: 0 });
    expect(parsePlacement(null)).toEqual({ anchor: "ring", size: 144, dx: 0, dy: 0 });
    expect(parsePlacement({ anchor: "bottom", size: 2 }).size).toBe(20);
  });

  test("the box puts the centre of the picture on the chosen spot of the photo, then nudges it", () => {
    expect(placementBox({ anchor: "ring", size: 144, dx: 0, dy: 0 })).toEqual({ left: -22, top: -22, size: 144 });
    expect(placementBox({ anchor: "top-right", size: 40, dx: 0, dy: 0 })).toEqual({ left: 80, top: -20, size: 40 });
    expect(placementBox({ anchor: "bottom", size: 60, dx: 10, dy: -4 })).toEqual({ left: 30, top: 66, size: 60 });
    expect(DECOR_ANCHORS).toHaveLength(9);
  });
});

test.describe("banner rule", () => {
  test("a wide picture passes; too small, too square, too tall or a video do not", () => {
    expect(checkPicture("banner", png(1600, 500, 2), 100_000).ok).toBe(true);
    expect(checkPicture("banner", jpeg(1600, 500), 100_000).ok).toBe(true);
    expect(checkPicture("banner", png(600, 200, 2), 100_000)).toMatchObject({ ok: false, reason: expect.stringContaining("at least 800") });
    expect(checkPicture("banner", png(1000, 1000, 2), 100_000)).toMatchObject({ ok: false, reason: expect.stringContaining("wide") });
    expect(checkPicture("banner", png(1600, 500, 2), 7 * 1024 * 1024)).toMatchObject({ ok: false });
  });
  test("the banner list names formats, size and shape", () => {
    const text = describeRule("banner").join(" ");
    for (const part of ["PNG, JPG, GIF or WebP", "6 MB", "800 × 200", "1600 × 500"]) expect(text).toContain(part);
  });
});
