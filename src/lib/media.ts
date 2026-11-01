// Alert media: GIFs, images and short WebM clips a creator uploads to play in their
// OBS alert. Pure, so the rules can be tested without a browser or a database.
//
// The browser sends the file straight to Vercel Blob (a function would cap the body
// at 4.5 MB), the upload route only issues a token for the creator's own folder, and
// the server looks at the file's first bytes again before it saves the row, so a file
// that bypassed the page is still refused. Same pattern as the soundboard
// (src/lib/sounds.ts); `isOwnBlobUrl` is the shared check for any private folder.

export const MEDIA_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // image or GIF
export const MEDIA_WEBM_MAX_BYTES = 8 * 1024 * 1024;
// A WebM's length cannot be read cheaply on the server: the browser checks it and
// the overlay hard-caps playback at this many milliseconds whatever the file says.
export const MEDIA_WEBM_MAX_MS = 10_000;
export const MAX_MEDIA_PER_CREATOR = 20;
export const MAX_MEDIA_BYTES_PER_CREATOR = 40 * 1024 * 1024;
export const MEDIA_NAME_MAX = 40;
export const MEDIA_MAX_SIDE = 4096;

export type MediaKind = "gif" | "image" | "webm";
export type MediaPlacement = "above" | "behind" | "fullscreen";
export const MEDIA_PLACEMENTS: readonly MediaPlacement[] = ["above", "behind", "fullscreen"];
// The owner holds a creator's first upload for approval; later ones go live.
export type ReviewState = "new" | "approved" | "removed";

export const MEDIA_CONTENT_TYPES: Record<MediaKind, readonly string[]> = {
  gif: ["image/gif"],
  image: ["image/png", "image/jpeg", "image/webp"],
  webm: ["video/webm"],
};
export const ALL_MEDIA_CONTENT_TYPES = Object.values(MEDIA_CONTENT_TYPES).flat();

export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

// Where a creator's media lives. The upload route only issues a token for a path
// under it, and a file can only be saved from a URL under it.
export const mediaPathPrefix = (creatorId: number) => `media/${creatorId}/`;

// A Blob URL is only trusted when it points into our own store under the given
// folder (for example mediaPathPrefix(id), or a later feature's own prefix).
export function isOwnBlobUrl(raw: string, prefix: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    url.pathname.startsWith(`/${prefix}`) &&
    !url.pathname.includes("..")
  );
}

const CONTROL = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff<>]/g;

export function cleanMediaName(raw: unknown): string {
  return String(raw ?? "")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MEDIA_NAME_MAX);
}

export function parsePlacement(raw: unknown): MediaPlacement | null {
  return MEDIA_PLACEMENTS.find((p) => p === raw) ?? null;
}

export function maxBytesFor(kind: MediaKind): number {
  return kind === "webm" ? MEDIA_WEBM_MAX_BYTES : MEDIA_IMAGE_MAX_BYTES;
}

// What the file really is, from its first bytes (never from its name or the type the
// browser claimed). Null when it is none of the allowed formats. `width` and `height`
// are read where the header makes that cheap (GIF and PNG) and are null otherwise.
export type Sniffed = { kind: MediaKind; mime: string; width: number | null; height: number | null };

const at = (b: Uint8Array, i: number, s: string) => {
  for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
  return true;
};

export function sniffMedia(bytes: Uint8Array): Sniffed | null {
  if (bytes.length < 16) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (at(bytes, 0, "GIF87a") || at(bytes, 0, "GIF89a")) {
    return { kind: "gif", mime: "image/gif", width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes[0] === 0x89 && at(bytes, 1, "PNG") && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    // The first chunk of a PNG is IHDR: width and height follow its name.
    if (bytes.length < 24 || !at(bytes, 12, "IHDR")) return null;
    return { kind: "image", mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "image", mime: "image/jpeg", width: null, height: null };
  }
  if (at(bytes, 0, "RIFF") && at(bytes, 8, "WEBP")) {
    return { kind: "image", mime: "image/webp", width: null, height: null };
  }
  // WebM is Matroska: an EBML header whose DocType is "webm" (a .mkv says "matroska").
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const head = bytes.subarray(0, Math.min(bytes.length, 64));
    for (let i = 0; i + 4 <= head.length; i++) {
      if (at(head, i, "webm")) return { kind: "webm", mime: "video/webm", width: null, height: null };
    }
    return null;
  }
  return null;
}

// The server's check of a saved file, from its bytes and size. Returns the reason
// when it is refused, or what it is when it passes.
export function checkMediaFile(
  bytes: Uint8Array,
  sizeBytes: number,
): { ok: true; sniffed: Sniffed } | { ok: false; reason: string } {
  const sniffed = sniffMedia(bytes);
  if (!sniffed) return { ok: false, reason: "That file is not a GIF, PNG, JPG, WebP or WebM." };
  if (sizeBytes < 1 || sizeBytes > maxBytesFor(sniffed.kind)) {
    return {
      ok: false,
      reason: sniffed.kind === "webm" ? "A WebM can be at most 8 MB." : "An image or GIF can be at most 3 MB.",
    };
  }
  const { width, height } = sniffed;
  if (width !== null && height !== null && (width < 1 || height < 1 || width > MEDIA_MAX_SIDE || height > MEDIA_MAX_SIDE)) {
    return { ok: false, reason: `The picture must be at most ${MEDIA_MAX_SIDE} pixels on each side.` };
  }
  return { ok: true, sniffed };
}

// Whether one more file fits in the creator's allowance.
export function checkAllowance(
  have: { files: number; bytes: number },
  addBytes: number,
): string | null {
  if (have.files >= MAX_MEDIA_PER_CREATOR) return `You can keep up to ${MAX_MEDIA_PER_CREATOR} files.`;
  if (have.bytes + addBytes > MAX_MEDIA_BYTES_PER_CREATOR) {
    return `Your files can use up to ${MAX_MEDIA_BYTES_PER_CREATOR / (1024 * 1024)} MB in all.`;
  }
  return null;
}

// Whether a file may play in an alert: the owner has approved it (a creator's first
// upload is held), it was not removed and the creator has it switched on.
export function playable(m: { enabled: boolean; review_state: ReviewState }): boolean {
  return m.enabled && m.review_state === "approved";
}

// The state a new upload starts in: held for the owner when it is the creator's
// first, live straight away after that.
export function initialReviewState(priorUploads: number): ReviewState {
  return priorUploads === 0 ? "new" : "approved";
}
