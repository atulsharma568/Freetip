import { isOwnBlobUrl } from "./media";

// The owner's tip-page music (one track). Pure, so the rules can be tested without a database.
// The file is uploaded straight from the browser to our Blob store under the creator's own folder;
// the upload route only issues a token for that folder, audio types and this size, and a track can
// only be saved from a URL under that folder.

export const MUSIC_MAX_BYTES = 12 * 1024 * 1024;
export const MUSIC_TITLE_MAX = 60;
export const MUSIC_TYPES = ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave", "audio/webm"] as const;

export const musicPathPrefix = (creatorId: number) => `page-music/${creatorId}/`;

export type PageMusic = { url: string; title: string };

export function cleanMusicTitle(raw: unknown): string {
  const t = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return [...t].slice(0, MUSIC_TITLE_MAX).join("");
}

// Reads what the column holds. Anything that is not a track under the creator's own folder is null,
// so a bad row can never put a foreign file on the page.
export function parsePageMusic(raw: unknown, creatorId: number): PageMusic | null {
  if (!raw || typeof raw !== "object") return null;
  const { url, title } = raw as Record<string, unknown>;
  if (typeof url !== "string" || !isOwnBlobUrl(url, musicPathPrefix(creatorId))) return null;
  return { url, title: cleanMusicTitle(title) || "Now playing" };
}

export function musicFileName(mime: string): string {
  const ext = mime.includes("mpeg") ? "mp3" : mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") || mime.includes("wave") ? "wav" : "webm";
  return `track.${ext}`;
}
