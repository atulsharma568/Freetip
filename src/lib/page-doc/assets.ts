import { MEDIA_MAX_SIDE, checkMediaFile, isOwnBlobUrl, sniffMedia, type MediaKind } from "../media";
import type { Block, PageDoc } from "./types";

// The rules for the pictures, GIFs and videos of a tip page (page builder phase 3). Pure, so they
// run in the browser (to refuse a file before it is sent), on the server (to refuse it again from
// its first bytes) and in the tests. No site imports.

export type AssetKind = MediaKind;

// What the tip page needs to draw one file. `posterUrl` is the still of a GIF or video.
export interface ResolvedAsset {
  id: number;
  kind: AssetKind;
  url: string;
  posterUrl: string | null;
}

// Where a file may be used.
export type AssetUse = "backdrop" | "banner" | "meter";

export const ASSET_LIMITS = {
  // A picture or GIF; a WebM is capped by `media.ts` at 8 MB.
  imageBytes: 3 * 1024 * 1024,
  webmBytes: 8 * 1024 * 1024,
  // The length of a looping video background. The browser measures it before uploading.
  webmMs: 15_000,
  files: 10,
  totalBytes: 40 * 1024 * 1024,
  posterBytes: 300 * 1024,
  // The widest a poster is drawn, in pixels.
  posterWidth: 1280,
  side: MEDIA_MAX_SIDE,
  dim: { min: 0, max: 80, step: 5, standard: 40 },
} as const;

// Where a creator's page files live. The upload route only gives a token for a path under it, and
// a file is only saved from a URL under it.
export const pageAssetPrefix = (creatorId: number) => `page/${creatorId}/`;

const KINDS_FOR: Record<AssetUse, readonly AssetKind[]> = {
  // Any of the three behind the page.
  backdrop: ["image", "gif", "webm"],
  // A banner is a picture or a GIF; a video stays out of the header.
  banner: ["image", "gif"],
  // The emblem on the Pressure meter: a picture or a GIF, like a banner.
  meter: ["image", "gif"],
};

export const kindsFor = (use: AssetUse): readonly AssetKind[] => KINDS_FOR[use];
export const usableFor = (kind: AssetKind, use: AssetUse): boolean => KINDS_FOR[use].includes(kind);

// Animated files carry a still picture of their first frame.
export const needsPoster = (kind: AssetKind): boolean => kind !== "image";

// An asset id as it may be stored in a document: a positive whole number a database can hold.
export function cleanAssetId(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 1 && raw <= 9_007_199_254_740_991 ? raw : null;
}

// The ids a document points at, each once, in the order the blocks sit.
export function usedAssetIds(doc: PageDoc): number[] {
  const ids: number[] = [];
  const add = (id: number | null) => {
    if (id !== null && !ids.includes(id)) ids.push(id);
  };
  for (const block of doc.blocks) {
    if (block.type === "backdrop") add(block.settings.asset);
    else if (block.type === "header") add(block.settings.bannerAsset);
    else if (block.type === "pressureMeter") add(block.settings.picture);
  }
  return ids;
}

// The document with every use of one asset pointed at another (the editor's "Replace"). The old
// file stays in the library until the owner removes it.
// A place that cannot take the new file's kind (a video as a banner) keeps pointing at the old file.
export function replaceAssetId(doc: PageDoc, from: number, to: number, toKind?: AssetKind): { doc: PageDoc; changed: boolean } {
  let changed = false;
  const blocks = doc.blocks.map((block): Block => {
    if (block.type === "backdrop" && block.settings.asset === from && (!toKind || usableFor(toKind, "backdrop"))) {
      changed = true;
      return { ...block, settings: { ...block.settings, asset: to } };
    }
    if (block.type === "header" && block.settings.bannerAsset === from && (!toKind || usableFor(toKind, "banner"))) {
      changed = true;
      return { ...block, settings: { ...block.settings, bannerAsset: to } };
    }
    if (block.type === "pressureMeter" && block.settings.picture === from && (!toKind || usableFor(toKind, "meter"))) {
      changed = true;
      return { ...block, settings: { ...block.settings, picture: to } };
    }
    return block;
  });
  return { doc: changed ? { ...doc, blocks } : doc, changed };
}

const ascii = (b: Uint8Array, i: number, s: string) => {
  for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
  return true;
};

// An animated WebP or PNG (APNG) looks like a plain picture to the first-bytes check but moves, so
// it would ignore every motion rule. Read from the whole file: a WebP is animated when its VP8X
// header says so or it holds animation chunks; a PNG when an acTL chunk comes before the pixels.
export function isAnimatedPicture(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
    let at = 12;
    while (at + 8 <= bytes.length) {
      const size = view.getUint32(at + 4, true);
      if (ascii(bytes, at, "ANIM") || ascii(bytes, at, "ANMF")) return true;
      if (ascii(bytes, at, "VP8X") && at + 8 < bytes.length && (bytes[at + 8] & 0x02) !== 0) return true;
      at += 8 + size + (size & 1);
    }
    return false;
  }
  if (bytes[0] === 0x89 && ascii(bytes, 1, "PNG")) {
    let at = 8;
    while (at + 8 <= bytes.length) {
      const size = view.getUint32(at);
      if (ascii(bytes, at + 4, "acTL")) return true;
      if (ascii(bytes, at + 4, "IDAT")) return false;
      at += 12 + size;
    }
  }
  return false;
}

// The width and height of a JPEG or WebP, which the first-bytes check cannot give. Null when they
// cannot be read from these bytes. Needs the whole file for a JPEG whose size marker comes late.
export function pictureSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xff) {
        at += 1;
        continue;
      }
      // Frame headers (baseline, extended, progressive, lossless and so on), not DHT, JPG or DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        at += 2;
        continue;
      }
      at += 2 + view.getUint16(at + 2);
    }
    return null;
  }
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP") && bytes.length >= 30) {
    if (ascii(bytes, 12, "VP8X")) return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (ascii(bytes, 12, "VP8L") && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (ascii(bytes, 12, "VP8 ") && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
  }
  return null;
}

// The server's check of an uploaded file, from its bytes (the whole file for a picture). A picture
// or GIF may be 3 MB, a WebM 8 MB. An animated WebP or PNG is refused (use a GIF or WebM, which
// carry a still and follow the motion rules), and a JPEG or WebP gets its size read here rather
// than trusted from the browser.
export function checkAssetFile(bytes: Uint8Array, sizeBytes: number) {
  const checked = checkMediaFile(bytes, sizeBytes, ASSET_LIMITS.imageBytes);
  if (!checked.ok || checked.sniffed.kind !== "image") return checked;
  if (isAnimatedPicture(bytes)) {
    return { ok: false as const, reason: "An animated WebP or PNG cannot be used. Save it as a GIF or a WebM video instead." };
  }
  if (checked.sniffed.width !== null && checked.sniffed.height !== null) return checked;
  const size = pictureSize(bytes);
  if (!size) return { ok: false as const, reason: "The size of the picture could not be read." };
  if (size.width < 1 || size.height < 1 || size.width > ASSET_LIMITS.side || size.height > ASSET_LIMITS.side) {
    return { ok: false as const, reason: `The picture must be at most ${ASSET_LIMITS.side} pixels on each side.` };
  }
  return { ok: true as const, sniffed: { ...checked.sniffed, ...size } };
}

// A poster must be a real still picture (PNG, JPEG or WebP, never a GIF or a video) and small.
export function checkPosterFile(bytes: Uint8Array, sizeBytes: number): { ok: true; mime: string } | { ok: false; reason: string } {
  const sniffed = sniffMedia(bytes);
  if (!sniffed || sniffed.kind !== "image") return { ok: false, reason: "The still picture of the first frame was not a picture." };
  if (sizeBytes < 1 || sizeBytes > ASSET_LIMITS.posterBytes) {
    return { ok: false, reason: `The still picture of the first frame can be at most ${Math.round(ASSET_LIMITS.posterBytes / 1024)} KB.` };
  }
  if (isAnimatedPicture(bytes)) return { ok: false, reason: "The still picture of the first frame must not be animated." };
  const { width, height } = sniffed.width !== null && sniffed.height !== null ? sniffed : (pictureSize(bytes) ?? { width: null, height: null });
  if (width === null || height === null || width < 1 || height < 1 || width > ASSET_LIMITS.side || height > ASSET_LIMITS.side) {
    return { ok: false, reason: "The size of the still picture of the first frame could not be read, or it is too large." };
  }
  return { ok: true, mime: sniffed.mime };
}

// Whether one more file fits in the creator's allowance. `have` counts live files only.
export function checkAssetAllowance(have: { files: number; bytes: number }, addBytes: number): string | null {
  if (have.files >= ASSET_LIMITS.files) return `A page can keep up to ${ASSET_LIMITS.files} files. Remove one first.`;
  if (have.bytes + addBytes > ASSET_LIMITS.totalBytes) {
    return `The files of a page can use up to ${ASSET_LIMITS.totalBytes / (1024 * 1024)} MB in all. Remove one first.`;
  }
  return null;
}

// A length the browser measured, kept only when sane and inside the cap; null otherwise.
export function cleanDuration(raw: unknown): number | null {
  const n = typeof raw === "number" ? Math.round(raw) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= ASSET_LIMITS.webmMs + 50 ? n : null;
}

// A stored file address is drawn only when it is in our own Blob store under this creator's folder.
export const isPageAssetUrl = (raw: unknown, creatorId: number): raw is string => typeof raw === "string" && isOwnBlobUrl(raw, pageAssetPrefix(creatorId));
