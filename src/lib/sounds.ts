// Alert sounds. Pure, so the rules can be tested without a browser or a database.
//
// Every sound is stored as a plain 16-bit PCM WAV. The browser repairs whatever
// the creator picked into that format before uploading (src/lib/audio-repair.ts),
// and the server checks the header again before it saves the row, so a file that
// bypassed the page is still refused.

export const SOUND_MAX_BYTES = 8 * 1024 * 1024; // the file the creator picks
export const SOUND_MAX_MS = 30_000;
export const SOUND_MIN_MS = 100;
export const SOUND_NAME_MAX = 40;
export const SOUND_EMOJI_MAX = 8;
export const SOUND_MAX_MIN_RUPEES = 10_000;
export const MAX_SOUNDS_PER_CREATOR = 2; // for now: keeps storage small; more can be a paid extra later
export const MAX_SOUND_BYTES_PER_CREATOR = 10 * 1024 * 1024;
// Sounds are repaired to at most this rate, which keeps 30 s of stereo near 5 MB.
export const SOUND_SAMPLE_RATE = 44_100;

export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

// Where a creator's uploads live. The upload route only issues a token for a
// path under it, and a sound can only be saved from a URL under it.
export const soundPathPrefix = (creatorId: number) => `sounds/${creatorId}/`;

export function soundFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return `${slug || "sound"}.wav`;
}

// A sound's URL is only trusted when it points into our own Blob store, under the
// creator's own folder.
export function isOwnSoundUrl(raw: string, creatorId: number): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    url.pathname.startsWith(`/${soundPathPrefix(creatorId)}`) &&
    !url.pathname.includes("..")
  );
}

const CONTROL = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff<>]/g;

export function cleanSoundName(raw: unknown): string {
  return String(raw ?? "")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SOUND_NAME_MAX);
}

export function cleanSoundEmoji(raw: unknown): string | null {
  const text = String(raw ?? "").replace(CONTROL, "").trim();
  // Count by code point so a flag or a face is not cut in half.
  const kept = Array.from(text).slice(0, SOUND_EMOJI_MAX).join("");
  return kept || null;
}

export function parseMinRupees(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 0 || n > SOUND_MAX_MIN_RUPEES) return null;
  return n;
}

export function parseVolume(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 10 || n > 100) return null;
  return n;
}

// ── WAV ─────────────────────────────────────────────────────────────────────

export interface WavInfo {
  channels: 1 | 2;
  sampleRate: number;
  durationMs: number;
}

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...Array.from(b.subarray(at, at + len)));

// Reads the header written by encodeWav (canonical 44 bytes, 16-bit PCM, mono or
// stereo). Returns a reason when the file is anything else or its length is out
// of range. Duration comes from the data size, never from what the client said.
export function parseWav(bytes: Uint8Array): { ok: true; info: WavInfo } | { ok: false; reason: string } {
  if (bytes.length > SOUND_MAX_BYTES) return { ok: false, reason: "The file is over 8 MB." };
  if (bytes.length < 46) return { ok: false, reason: "The file is too short to be audio." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE" || ascii(bytes, 12, 4) !== "fmt ") {
    return { ok: false, reason: "The file is not a standard WAV." };
  }
  if (view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1) {
    return { ok: false, reason: "The WAV is not plain 16-bit audio." };
  }
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const byteRate = view.getUint32(28, true);
  const blockAlign = view.getUint16(32, true);
  const bits = view.getUint16(34, true);
  if (channels !== 1 && channels !== 2) return { ok: false, reason: "Only mono or stereo audio is allowed." };
  if (bits !== 16) return { ok: false, reason: "The WAV is not plain 16-bit audio." };
  if (sampleRate < 8000 || sampleRate > 48_000) return { ok: false, reason: "Unsupported sample rate." };
  if (blockAlign !== channels * 2 || byteRate !== sampleRate * blockAlign) {
    return { ok: false, reason: "The WAV header is inconsistent." };
  }
  if (ascii(bytes, 36, 4) !== "data") return { ok: false, reason: "The WAV has extra data before the audio." };
  const dataBytes = view.getUint32(40, true);
  if (dataBytes < 1 || dataBytes !== bytes.length - 44) {
    return { ok: false, reason: "The WAV length does not match its header." };
  }

  const durationMs = Math.round((dataBytes / byteRate) * 1000);
  if (durationMs < SOUND_MIN_MS) return { ok: false, reason: "The sound is too short." };
  if (durationMs > SOUND_MAX_MS + 50) return { ok: false, reason: "The sound is longer than 30 seconds." };
  return { ok: true, info: { channels, sampleRate, durationMs } };
}

// 16-bit PCM WAV from one or two channels of samples in -1..1.
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const count = channels.length;
  if (count < 1 || count > 2) throw new Error("Only mono or stereo audio can be encoded");
  const frames = channels[0].length;
  const dataBytes = frames * count * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);

  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      at += 2;
    }
  }
  return out;
}

// A fan's pick is allowed when the sound belongs to the creator, is switched on
// for fans and the tip reaches its minimum. Returns the reason otherwise.
export function checkPick(
  sound: { enabled: boolean; min_paise: number } | undefined,
  amountPaise: number,
): string | null {
  if (!sound) return "That sound is no longer available. Pick another or clear your choice.";
  if (!sound.enabled) return "That sound is switched off. Pick another or clear your choice.";
  if (amountPaise < sound.min_paise) {
    return `Tip at least ₹${Math.ceil(sound.min_paise / 100)} to play this sound.`;
  }
  return null;
}
