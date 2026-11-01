// Pure helpers for text-to-speech, kept free of server-only imports so they can be
// tested directly: what to say, which voice, the cache key, the SSML, the caps.

import { createHash } from "crypto";
import { hindiSpeech } from "@/lib/hinglish";
import { regionalLanguage, REGIONAL_LANGUAGES, type RegionalLang } from "@/lib/regional-voices";

const DEVANAGARI = /[ऀ-ॿ]/;

// Hindi and Indian English are the two languages Polly can read too; the seven
// regional ones (paid feature) are Azure only.
export type SpeechLanguage = "hi-IN" | "en-IN" | RegionalLang;

export function isPollyLanguage(language: SpeechLanguage): language is "hi-IN" | "en-IN" {
  return language === "hi-IN" || language === "en-IN";
}

export interface Prepared {
  // What the engine reads: Roman Hindi turned into Devanagari when the message is Hindi.
  text: string;
  language: SpeechLanguage;
}

// A Hindi or Hinglish message is read as Hindi (Devanagari), anything else as
// Indian English. With a regional language (the creator's choice, feature on), a
// message that has letters of that language's own script is read in it, as typed.
// Marathi shares Devanagari with Hindi, so the creator's choice decides, and only for
// Devanagari the fan actually typed: a Roman Hinglish message that was turned into
// Devanagari here stays Hindi.
export function prepareSpeech(message: string, regional?: RegionalLang | null): Prepared {
  if (regional && regionalLanguage(regional).script.test(message)) {
    return { text: message, language: regional };
  }
  const { text } = hindiSpeech(message);
  return { text, language: DEVANAGARI.test(text) ? "hi-IN" : "en-IN" };
}

const HI_EN_FEMALE = { "hi-IN": "hi-IN-SwaraNeural", "en-IN": "en-IN-NeerjaNeural" } as const;
const HI_EN_MALE = { "hi-IN": "hi-IN-MadhurNeural", "en-IN": "en-IN-PrabhatNeural" } as const;

export const DEFAULT_VOICES: Record<SpeechLanguage, string> = {
  ...HI_EN_FEMALE,
  ...Object.fromEntries(REGIONAL_LANGUAGES.map((l) => [l.code, l.female])),
} as Record<SpeechLanguage, string>;

export type VoiceGender = "female" | "male";

export const MALE_VOICES: Record<SpeechLanguage, string> = {
  ...HI_EN_MALE,
  ...Object.fromEntries(REGIONAL_LANGUAGES.map((l) => [l.code, l.male])),
} as Record<SpeechLanguage, string>;

// The env overrides (AZURE_SPEECH_VOICE_HI / _EN) change the female Hindi and
// English voices only.
export function azureVoice(
  language: SpeechLanguage,
  env: Record<string, string | undefined> = process.env,
  gender: VoiceGender = "female",
): string {
  if (gender === "male") return MALE_VOICES[language];
  const override =
    language === "hi-IN" ? env.AZURE_SPEECH_VOICE_HI : language === "en-IN" ? env.AZURE_SPEECH_VOICE_EN : undefined;
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
export function buildSsml(text: string, language: SpeechLanguage, voice: string): string {
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
