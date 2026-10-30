// Text-to-speech rules for the OBS overlay. Pure, so they can be tested without
// a database or a speech engine.
//
// Only the fan's message is ever spoken, never the name (a name is free text
// and nobody approves it). A message is spoken when:
//   - the creator turned text-to-speech on,
//   - the tip reaches their "read aloud from" amount (keeps the speech bill and
//     the stream noise down),
//   - the creator has approved it, or "approve before play" is off. A rejected
//     message is never spoken.

export interface SpeechSettings {
  ttsEnabled: boolean;
  approveBeforePlay: boolean;
  ttsMinPaise: number;
}

export interface SpeechTip {
  message: string | null;
  messageStatus: "pending" | "approved" | "rejected";
  amountPaise: number;
  // The fan chose "read my message aloud". A tip uses either a sound or the voice,
  // never both, and the voice only speaks when the fan asked for it.
  requested: boolean;
}

// Polly bills per character, and a long message would hold the stream. The
// creator's message limit still applies first.
export const SPEECH_MAX_CHARS = 300;

export const DEFAULT_TTS_MIN_PAISE = 4900;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
// Control characters (and the zero-width ones used to hide text).
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff]/g;

// The text to speak, or null when nothing speakable is left.
export function speechText(message: string | null, maxChars: number): string | null {
  if (!message) return null;
  const cleaned = message
    .replace(INVISIBLE, " ")
    .replace(URL_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.min(maxChars, SPEECH_MAX_CHARS))
    .trim();
  return cleaned || null;
}

export function shouldSpeak(settings: SpeechSettings, tip: SpeechTip, maxChars: number): boolean {
  if (!settings.ttsEnabled) return false;
  if (!tip.requested) return false;
  if (tip.messageStatus === "rejected") return false;
  if (tip.messageStatus === "pending" && settings.approveBeforePlay) return false;
  if (tip.amountPaise < settings.ttsMinPaise) return false;
  return speechText(tip.message, maxChars) !== null;
}

// Kajal is bilingual: Devanagari text needs hi-IN, anything else reads best as
// Indian English. Roman-script Hindi ("bhai mast stream") is read with an
// English accent; that is a known limit of the voice.
export function languageFor(text: string): "hi-IN" | "en-IN" {
  return /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN";
}

// Whether a fan may choose "read my message aloud" when starting a tip. Returns
// the reason when not. `platformOn` is the owner's switch for the whole site
// (TTS_ENABLED); a sound and the voice are exclusive.
export function checkVoicePick(input: {
  platformOn: boolean;
  creatorEnabled: boolean;
  minPaise: number;
  amountPaise: number;
  message: string | null;
  hasSound: boolean;
}): string | null {
  if (!input.platformOn || !input.creatorEnabled) return "Voice messages are not available right now.";
  if (input.hasSound) return "Choose a sound or a spoken message, not both.";
  if (!input.message?.trim()) return "Write a message for the voice to read.";
  if (input.amountPaise < input.minPaise) {
    return `Tip at least ₹${Math.ceil(input.minPaise / 100)} to have your message read aloud.`;
  }
  return null;
}
