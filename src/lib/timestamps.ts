import { findBlockedWord } from "./message-filter";

// Stream timestamps: the pure parts. A viewer types !ts in live chat, a moment is
// saved with the time it arrived, and once the stream has ended each moment is turned
// into "how far into the stream was that" using the stream's real start time. No
// database, network or clock in here, so every rule can be tested.

export const TITLE_MAX_CHARS = 60;
// YouTube refuses a comment over 10,000 characters.
export const COMMENT_MAX_CHARS = 10_000;
// Moments closer than this many seconds are one moment (viewers react together).
export const GROUP_WINDOW_SECONDS = 10;
export const MAX_DELAY_SECONDS = 120;
export const DELAY_PRESETS = [22, 42, 58] as const;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const isVideoId = (value: unknown): value is string => typeof value === "string" && VIDEO_ID.test(value);

// Nightbot's $(chatid) is YouTube's live chat id. The id is URL-safe base64 of a small
// protobuf whose first field holds the video id: 0x0a <len> 0x0a 0x0b <11 id bytes>.
// Anything that does not look like that gives null and the caller asks YouTube which
// stream is live instead. (Checked against the format as published by others, not yet
// against a real stream.)
export function videoIdFromChatId(chatId: string): string | null {
  if (typeof chatId !== "string" || chatId.length < 8 || chatId.length > 200) return null;
  if (!/^[A-Za-z0-9_\-+/=]+$/.test(chatId)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(chatId.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
  if (bytes.length < 15 || bytes[0] !== 0x0a || bytes[2] !== 0x0a || bytes[3] !== 0x0b) return null;
  const id = bytes.subarray(4, 15).toString("latin1");
  return isVideoId(id) ? id : null;
}

const toMs = (value: Date | string | number): number => (value instanceof Date ? value.getTime() : new Date(value).getTime());

// Whole seconds into the stream that a moment points at: when the command arrived,
// minus the chat delay, minus the stream start. Never below zero.
export function offsetSeconds(
  arrivedAt: Date | string | number,
  startedAt: Date | string | number,
  delaySeconds: number,
): number {
  const diff = (toMs(arrivedAt) - toMs(startedAt)) / 1000 - Math.max(0, delaySeconds);
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff)) : 0;
}

// "12:34" under an hour, "1:02:03" from an hour up, as YouTube turns into links.
export function formatOffset(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

export const youtubeMomentLink = (videoId: string, seconds: number) =>
  `https://youtu.be/${videoId}?t=${Math.max(0, Math.floor(seconds))}`;

// What a viewer typed after !ts, made safe to show in a comment or in Discord: no links,
// no @mentions, no custom-emoji codes, no control characters, one line, at most 60
// characters. Empty if it holds a blocked word (the creator's banned words).
export function cleanTitle(raw: string | null | undefined, banned: readonly string[] = []): string {
  if (!raw) return "";
  let text = raw
    .normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/[@#]\S+/g, " ")
    .replace(/:[A-Za-z0-9_-]{2,}:/g, " ")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (findBlockedWord(text, banned)) return "";
  if (text.length > TITLE_MAX_CHARS) text = `${Array.from(text).slice(0, TITLE_MAX_CHARS - 1).join("").trimEnd()}…`;
  return text;
}

// A viewer's name for Discord and for the creator's own list: no @ prefix, no mentions.
export function cleanUser(raw: string | null | undefined): string {
  const name = (raw ?? "").replace(/^@+/, "").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/[@#`*_~|>]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(name).slice(0, 40).join("") || "Someone";
}

export type Source = "chat" | "tip" | "goal";
export type Moment = { seconds: number; title: string; user: string; source?: Source };

// A group of moments close together, as the comment, the editor page and the public
// page show them: one time (the earliest), each distinct title once, and how many
// separate moments were saved there (several viewers reacting to the same thing is the
// signal an editor wants). No viewer names: the public page must not carry them.
export type MomentGroup = { seconds: number; titles: string[]; marks: number; sources: Source[] };

export function groupMoments(moments: readonly Moment[], window = GROUP_WINDOW_SECONDS): MomentGroup[] {
  const sorted = [...moments].sort((a, b) => a.seconds - b.seconds);
  const groups: Moment[][] = [];
  for (const m of sorted) {
    const last = groups[groups.length - 1];
    if (last && m.seconds - last[0].seconds <= window) last.push(m);
    else groups.push([m]);
  }
  return groups.map((g) => ({
    seconds: g[0].seconds,
    titles: [...new Set(g.map((m) => m.title).filter(Boolean))],
    marks: g.length,
    sources: [...new Set(g.map((m) => m.source ?? "chat"))],
  }));
}

// Moments within GROUP_WINDOW_SECONDS of the first one in a group become one line at
// the group's earliest time, with each distinct title once. Oldest first.
export function commentLines(moments: readonly Moment[], window = GROUP_WINDOW_SECONDS): string[] {
  return groupMoments(moments, window).map((g) =>
    g.titles.length ? `${formatOffset(g.seconds)} ${g.titles.join(" / ")}` : formatOffset(g.seconds),
  );
}

// The one comment posted when the stream ends. Cut at the last whole line that fits
// under YouTube's limit.
export function buildComment(lines: readonly string[]): string {
  const head = "Timestamps:\n\n";
  let body = head;
  for (const line of lines) {
    const next = body === head ? body + line : `${body}\n${line}`;
    if (next.length > COMMENT_MAX_CHARS) break;
    body = next;
  }
  return body === head ? "" : body;
}

// The line Nightbot sends back to chat. Short enough for YouTube chat (200 characters).
export function chatReply(seconds: number | null, title: string): string {
  const when = seconds === null ? "" : ` ${formatOffset(seconds)}`;
  const text = `Saved${when}${title ? ` ${title}` : ""}`;
  return Array.from(text).slice(0, 190).join("");
}

// A plain integer delay in range, else the default.
export function parseDelay(raw: unknown, fallback = 22): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= MAX_DELAY_SECONDS ? n : fallback;
}

// YouTube turns a list of times in a video's description into chapters only when the
// first is 0:00, there are at least three, and each is at least ten seconds long. A
// missing 0:00 is added as "Start"; a moment closer than ten seconds to the one before
// it is left out. Titles fall back to "Moment N".
export const MIN_CHAPTERS = 3;
export const MIN_CHAPTER_SECONDS = 10;

export type ChaptersResult = { ok: true; text: string; count: number } | { ok: false; reason: string };

export function buildChapters(groups: readonly MomentGroup[]): ChaptersResult {
  const kept: { seconds: number; title: string }[] = [];
  groups.forEach((g, i) => {
    const title = g.titles[0] || `Moment ${i + 1}`;
    const last = kept[kept.length - 1];
    if (!last && g.seconds > 0) kept.push({ seconds: 0, title: "Start" });
    const prev = kept[kept.length - 1];
    if (prev && g.seconds - prev.seconds < MIN_CHAPTER_SECONDS) return;
    kept.push({ seconds: g.seconds, title });
  });
  if (kept.length < MIN_CHAPTERS) {
    return { ok: false, reason: `YouTube needs at least ${MIN_CHAPTERS} chapters at least ${MIN_CHAPTER_SECONDS} seconds apart; there are ${kept.length}.` };
  }
  return { ok: true, count: kept.length, text: kept.map((c) => `${formatOffset(c.seconds)} ${c.title}`).join("\n") };
}

// One CSV cell. Quoted when needed, and a cell that starts with = + - or @ gets a
// leading apostrophe so a spreadsheet does not run what a viewer typed as a formula.
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function momentsCsv(videoId: string, groups: readonly MomentGroup[]): string {
  const rows = [["time", "seconds", "label", "source", "marks", "link"]];
  for (const g of groups) {
    rows.push([
      formatOffset(g.seconds),
      String(g.seconds),
      g.titles.join(" / "),
      g.sources.join("+"),
      String(g.marks),
      youtubeMomentLink(videoId, g.seconds),
    ]);
  }
  return `${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

// "₹500" or "₹1,250" for an automatic moment's label (whole rupees, Indian grouping).
export const rupeeLabel = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
