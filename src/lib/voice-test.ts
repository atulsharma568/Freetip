// The dashboard's "Test voice" button. Pure rules, so they can be tested without a
// database or a speech engine. The text a creator types goes through the same
// cleanup and word filter as a fan's message, so the button can never be used to
// make the voice say something a real alert would refuse.

import { findBlockedWord } from "@/lib/message-filter";
import { speechText } from "@/lib/tts-rules";

// Ready-made samples. The first two show the Hinglish conversion; the third is plain
// English. None holds a word the filter would refuse (a test guards that).
export const TEST_SAMPLES = [
  { label: "Hinglish", text: "bhai kya mast stream hai, maine pachas rupaye bheje hain, chai pi lena" },
  { label: "Hinglish, longer", text: "bhai kal ka match zaroor dekhna, hum sab dekhenge aur jeetenge, bahut mazaa aayega" },
  { label: "English", text: "Great stream today, keep it up. This tip is for your new mic." },
] as const;

// The most the box accepts, whatever the creator's own message limit is.
export const TEST_INPUT_MAX = 300;

// Seconds between two tests from one creator: the free Azure tier answers 20
// requests a minute for the whole site.
export const TEST_COOLDOWN_SECONDS = 6;

export type TestText = { ok: true; text: string } | { ok: false; message: string };

export function prepareTestText(input: unknown, maxChars: number, bannedWords: readonly string[]): TestText {
  if (typeof input !== "string") return { ok: false, message: "Type a message to hear." };
  const raw = input.slice(0, 1000);
  // Checked on what was typed, as a real tip is, before any cleanup can hide a word.
  if (findBlockedWord(raw, bannedWords) !== null) {
    return { ok: false, message: "That message has a blocked word, so it would never be read on stream." };
  }
  const text = speechText(raw, Math.min(maxChars, TEST_INPUT_MAX));
  if (!text) return { ok: false, message: "Type a message to hear." };
  return { ok: true, text };
}
