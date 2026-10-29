// Browser only. Turns whatever audio file the creator picked into the standard
// WAV the soundboard stores. This is the repair step: a file that is odd,
// damaged or in a format the server could not check (MP3 with a bad header, M4A,
// OGG, a WAV with extra chunks) is decoded here and written out clean. A file the
// browser cannot decode is refused with a reason instead of being uploaded broken.
// Clips over 30 seconds are refused, never silently cut.
import {
  SOUND_MAX_BYTES,
  SOUND_MAX_MS,
  SOUND_MIN_MS,
  SOUND_SAMPLE_RATE,
  encodeWav,
} from "@/lib/sounds";

export type RepairResult =
  | { ok: true; blob: Blob; durationMs: number; repaired: boolean }
  | { ok: false; reason: string };

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export async function repairAudio(file: File): Promise<RepairResult> {
  if (file.size === 0) return { ok: false, reason: "The file is empty." };
  if (file.size > SOUND_MAX_BYTES) {
    return { ok: false, reason: "The file is over 8 MB. Pick a smaller file or trim it first." };
  }

  const Ctx = audioContextCtor();
  if (!Ctx) return { ok: false, reason: "This browser cannot read audio files. Try Chrome, Edge or Safari." };

  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    void ctx.close().catch(() => {});
    return {
      ok: false,
      reason: "This file could not be read as audio. It may be damaged or not a sound file. Try exporting it as MP3 or WAV.",
    };
  }
  void ctx.close().catch(() => {});

  const durationMs = Math.round(decoded.duration * 1000);
  if (durationMs > SOUND_MAX_MS) {
    return { ok: false, reason: `This sound is ${Math.round(decoded.duration)} seconds. The limit is 30 seconds, so trim it first.` };
  }
  if (durationMs < SOUND_MIN_MS) return { ok: false, reason: "This sound is too short." };

  // Resample to at most 44.1 kHz, keeping mono or stereo, so any file lands near
  // the same small size. The offline context does the resampling.
  const rate = Math.min(decoded.sampleRate, SOUND_SAMPLE_RATE);
  const channelCount = Math.min(decoded.numberOfChannels, 2);
  let rendered = decoded;
  if (decoded.sampleRate !== rate || decoded.numberOfChannels > 2) {
    const offline = new OfflineAudioContext(channelCount, Math.ceil(decoded.duration * rate), rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    rendered = await offline.startRendering();
  }

  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(rendered.getChannelData(c));

  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak < 0.0005) return { ok: false, reason: "This file is silent." };

  const bytes = encodeWav(channels, rate);
  // A WAV that is already plain and standard is kept byte for byte.
  const alreadyClean = file.type.includes("wav") && bytes.length === file.size;
  return {
    ok: true,
    blob: new Blob([bytes as BlobPart], { type: "audio/wav" }),
    durationMs: Math.round((channels[0].length / rate) * 1000),
    repaired: !alreadyClean,
  };
}
