// Pure helpers for text-to-speech, kept free of server-only imports so they can be
// tested directly: what to say, which voice, the cache key, the SSML, the caps.

import { createHash } from "crypto";
import { hindiSpeech } from "@/lib/hinglish";

const DEVANAGARI = /[ऀ-ॿ]/;

export interface Prepared {
  // What the engine reads: Roman Hindi turned into Devanagari when the message is Hindi.
  text: string;
  language: "hi-IN" | "en-IN";
}

// A Hindi or Hinglish message is read as Hindi (Devanagari), anything else as
// Indian English.
export function prepareSpeech(message: string): Prepared {
  const { text } = hindiSpeech(message);
  return { text, language: DEVANAGARI.test(text) ? "hi-IN" : "en-IN" };
}

export const DEFAULT_VOICES = { "hi-IN": "hi-IN-SwaraNeural", "en-IN": "en-IN-NeerjaNeural" } as const;

export function azureVoice(language: Prepared["language"], env: Record<string, string | undefined> = process.env): string {
  const override = language === "hi-IN" ? env.AZURE_SPEECH_VOICE_HI : env.AZURE_SPEECH_VOICE_EN;
  return override?.trim() || DEFAULT_VOICES[language];
}

function xmlEscape(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// SSML for one clip. The fan's text is escaped, never inserted as markup.
export function buildSsml(text: string, language: Prepared["language"], voice: string): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">` +
    `<voice name="${xmlEscape(voice)}">${xmlEscape(text)}</voice></speak>`
  );
}

export function cacheKey(engine: string, voice: string, text: string): string {
  return createHash("sha256").update(`${engine}\n${voice}\n${text}`).digest("hex");
}

export interface Limits {
  creatorDailyChars: number;
  siteMonthlyChars: number;
}

// Azure's free allowance is 500,000 characters a month; the default stops well short.
export function limitsFromEnv(env: Record<string, string | undefined> = process.env): Limits {
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  return {
    creatorDailyChars: num(env.TTS_DAILY_CHARS_PER_CREATOR, 3000),
    siteMonthlyChars: num(env.TTS_MONTHLY_CHARS, 400_000),
  };
}

// Whether a clip of `chars` characters fits under both caps.
export function withinLimits(
  used: { creatorToday: number; siteMonth: number },
  chars: number,
  limits: Limits,
): boolean {
  return used.creatorToday + chars <= limits.creatorDailyChars && used.siteMonth + chars <= limits.siteMonthlyChars;
}

// A creator trying the voice from the dashboard may use at most this share of their
// daily characters, so testing can never leave their real tip alerts silent.
export const TEST_SHARE = 0.5;

export function testLimits(limits: Limits): Limits {
  return { ...limits, creatorDailyChars: Math.floor(limits.creatorDailyChars * TEST_SHARE) };
}
