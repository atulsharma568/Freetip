import { findBlockedWord } from "./message-filter";

// Birthday message: a fan can type their birthday (day and month only, never the year)
// with a tip; if the creator wrote a greeting and the fan tips on that day, the alert
// shows it. Self-declared and never checked, so it is only ever a friendly line, never
// proof of anything.

export const BIRTHDAY_TEMPLATE_MAX = 120;
export const BIRTHDAY_SHOWN_MAX = 160;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 29 Feb is allowed

// "MM-DD" for a real day and month, else null.
export function parseBirthday(month: unknown, day: unknown): string | null {
  if (typeof month !== "number" || typeof day !== "number") return null;
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Today's month and day in India, whatever the server's own time zone is.
export function istMonthDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${month}-${day}`;
}

// What the creator typed, trimmed, on one line and cut to the limit. Empty is "no greeting".
export function cleanTemplate(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, BIRTHDAY_TEMPLATE_MAX);
}

export function renderBirthdayMessage(template: string, name: string): string {
  return template.replaceAll("{name}", name).slice(0, BIRTHDAY_SHOWN_MAX);
}

// The line to show on this alert, or null. It needs a greeting, a tip carrying a birthday
// that is today (India time), a real name, and the line must pass the creator's banned
// words like any other text on the stream.
export function resolveBirthday(o: {
  template: string | null | undefined;
  tipBirthday: string | null | undefined;
  todayMd: string;
  name: string | null | undefined;
  bannedWords: readonly string[];
}): string | null {
  const template = cleanTemplate(o.template);
  const name = (o.name ?? "").trim();
  if (!template || !name || !o.tipBirthday || o.tipBirthday !== o.todayMd) return null;
  const line = renderBirthdayMessage(template, name);
  return findBlockedWord(line, o.bannedWords) === null ? line : null;
}
