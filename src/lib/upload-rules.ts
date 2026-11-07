import { checkMediaFile } from "./media";
import { isAnimatedPicture, pictureSize } from "./page-doc/assets";

// The rules for the pictures a creator uploads for their tip page, in one place. The same table
// draws the "What you can upload" list on the dashboard and decides what the browser and the server
// accept, so the words and the checks cannot drift apart. Pure (no site imports besides the shared
// picture helpers), so it runs in the browser, on the server and in the tests.

export type UploadRuleKind = "decorAvatar" | "decorFrame" | "banner";

export interface UploadRule {
  // What the creator calls it.
  title: string;
  // The formats allowed, by their real type (never the file name).
  mimes: readonly string[];
  // The same formats in words, for the list.
  formatsText: string;
  maxBytes: number;
  // Smallest width and height, and the longest side, in pixels.
  minWidth: number;
  minHeight: number;
  maxSide: number;
  // How the shape is named in words ("square", "wide, ...").
  shapeText: string;
  // Width divided by height must fall in this range (a square is 1).
  ratio: readonly [number, number];
  // The picture must have see-through pixels (an empty middle shows the photo through it).
  needsAlpha: boolean;
  // Extra advice that is not checked by the site.
  advice: readonly string[];
}

const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<UploadRuleKind, UploadRule> = {
  decorFrame: {
    title: "Decoration",
    mimes: ["image/png", "image/gif", "image/webp"],
    formatsText: "PNG, GIF or WebP (an animated GIF or animated WebP works). Not JPG, not video.",
    maxBytes: 3 * MB,
    minWidth: 512,
    minHeight: 512,
    maxSide: 4096,
    shapeText: "square",
    ratio: [0.9, 1.11],
    needsAlpha: true,
    advice: ["Leave the middle empty so your photo shows through.", "It is drawn on top of your photo; you choose where it sits and how big it is."],
  },
  decorAvatar: {
    title: "Profile picture",
    mimes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    formatsText: "PNG, JPG, GIF or WebP (an animated GIF or animated WebP works). Not video.",
    maxBytes: 3 * MB,
    minWidth: 256,
    minHeight: 256,
    maxSide: 4096,
    shapeText: "square, or close to it",
    ratio: [0.8, 1.25],
    needsAlpha: false,
    advice: ["It is cut into a circle, so keep the important part in the middle."],
  },
  banner: {
    title: "Tip page banner",
    mimes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    formatsText: "PNG, JPG, GIF or WebP (an animated GIF or animated WebP works; an animated WebP is usually much smaller). Not video.",
    maxBytes: 6 * MB,
    minWidth: 800,
    minHeight: 200,
    maxSide: 4096,
    shapeText: "wide (1.5 to 4 times wider than tall)",
    ratio: [1.5, 4],
    needsAlpha: false,
    advice: ["About 1600 × 500 pixels works best; the middle is what always shows on a phone.", "Only upload what you made or have the right to use."],
  },
};

const mbText = (bytes: number) => `${Math.round(bytes / MB)} MB`;

// The lines of the "What you can upload" list.
export function describeRule(kind: UploadRuleKind): string[] {
  const r = UPLOAD_RULES[kind];
  return [
    `Formats: ${r.formatsText}`,
    `Size: up to ${mbText(r.maxBytes)}.`,
    `Shape: ${r.shapeText}; at least ${r.minWidth} × ${r.minHeight} pixels, at most ${r.maxSide} on the longest side.`,
    ...(r.needsAlpha ? ["Background: see-through (PNG or WebP with transparency, or a GIF with a clear background)."] : []),
    ...r.advice,
  ];
}

// Whether the picture has see-through pixels. A GIF can have a clear colour but that is not cheap to
// read, so a GIF is allowed. A PNG says so in its header (colour type 4 or 6, or a tRNS chunk), a WebP in
// its VP8X flags or its lossless header; a plain lossy WebP (VP8) never does.
export function hasAlpha(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/gif") return true;
  if (mime === "image/png") {
    if (bytes.length < 26) return false;
    const colour = bytes[25];
    if (colour === 4 || colour === 6) return true;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 8;
    while (at + 8 <= bytes.length) {
      const size = view.getUint32(at);
      const name = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
      if (name === "tRNS") return true;
      if (name === "IDAT") return false;
      at += 12 + size;
    }
    return false;
  }
  if (mime === "image/webp") {
    const tag = (i: number, t: string) => t.split("").every((c, k) => bytes[i + k] === c.charCodeAt(0));
    if (bytes.length < 30 || !tag(0, "RIFF") || !tag(8, "WEBP")) return false;
    if (tag(12, "VP8X")) return (bytes[20] & 0x10) !== 0;
    if (tag(12, "VP8L")) return bytes[20] === 0x2f && (bytes[24] & 0x10) !== 0;
    return false;
  }
  return false;
}

export interface CheckedPicture {
  mime: string;
  width: number;
  height: number;
  animated: boolean;
  alpha: boolean;
}

// The check of a whole file against a rule. Run in the browser before anything is sent and again on
// the server on the bytes that were stored. Returns the reason in plain words when it is refused.
export function checkPicture(kind: UploadRuleKind, bytes: Uint8Array, sizeBytes: number): { ok: true; picture: CheckedPicture } | { ok: false; reason: string } {
  const r = UPLOAD_RULES[kind];
  const checked = checkMediaFile(bytes, sizeBytes, r.maxBytes);
  if (!checked.ok) return checked;
  const { sniffed } = checked;
  if (sniffed.kind === "webm") return { ok: false, reason: "Use a picture, GIF or WebP, not a video." };
  if (!r.mimes.includes(sniffed.mime)) {
    return { ok: false, reason: kind === "decorFrame" && sniffed.mime === "image/jpeg" ? "A decoration needs a see-through background. Use a PNG, GIF or WebP, not a JPG." : `That format is not allowed here. Use ${r.formatsText}` };
  }
  const size = sniffed.width !== null && sniffed.height !== null ? { width: sniffed.width, height: sniffed.height } : pictureSize(bytes);
  if (!size) return { ok: false, reason: "The size of that picture could not be read. Try saving it again as a PNG or WebP." };
  if (size.width < r.minWidth || size.height < r.minHeight) return { ok: false, reason: `The picture is ${size.width} × ${size.height} pixels. It must be at least ${r.minWidth} × ${r.minHeight}.` };
  if (size.width > r.maxSide || size.height > r.maxSide) return { ok: false, reason: `The picture is ${size.width} × ${size.height} pixels. It must be at most ${r.maxSide} pixels on the longest side.` };
  const ratio = size.width / size.height;
  if (ratio < r.ratio[0] || ratio > r.ratio[1]) return { ok: false, reason: `The picture is ${size.width} × ${size.height} pixels. It must be ${r.shapeText}.` };
  if (sniffed.mime === "image/png" && isAnimatedPicture(bytes)) return { ok: false, reason: "An animated PNG is not supported. Use an animated WebP or a GIF." };
  const alpha = hasAlpha(bytes, sniffed.mime);
  if (r.needsAlpha && !alpha) return { ok: false, reason: "The picture has no see-through background. Export it again with a transparent background (PNG or WebP)." };
  const animated = sniffed.kind === "gif" || (sniffed.mime === "image/webp" && isAnimatedPicture(bytes));
  return { ok: true, picture: { mime: sniffed.mime, width: size.width, height: size.height, animated, alpha } };
}
