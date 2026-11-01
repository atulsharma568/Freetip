// The arithmetic of cutting a clip. Pure, so it is tested without OBS or ffmpeg.
//
// Picture the replay file OBS saves: it covers the last `fileDuration` seconds up to the
// instant of saving. A moment that happened `ageAtSave` seconds before that instant sits
// at `fileDuration - ageAtSave` seconds into the file.

export const SECONDS_BEFORE = 20;
export const SECONDS_AFTER = 10;
// Extra seconds waited after the moment's "after" part, so OBS has the footage on disk.
export const SAVE_MARGIN = 2;

// How long to wait before saving the replay buffer: until the moment is `after` seconds
// old, plus a small margin. Nothing to wait if it is old enough already.
export function secondsToWait(ageSeconds, after = SECONDS_AFTER, margin = SAVE_MARGIN) {
  return Math.max(0, after + margin - Math.max(0, ageSeconds));
}

// Where in the saved file to cut. `ok: false` says why there is nothing to cut.
// `warnings` lists things the creator should fix (an OBS buffer that is too short).
export function planClip({ ageAtSave, fileDuration, before = SECONDS_BEFORE, after = SECONDS_AFTER }) {
  if (!(fileDuration > 0)) return { ok: false, reason: "empty" };
  const momentAt = fileDuration - Math.max(0, ageAtSave);
  if (momentAt + after <= 0) return { ok: false, reason: "too_old" };

  const warnings = [];
  let start = momentAt - before;
  let end = momentAt + after;
  if (start < 0) {
    start = 0;
    warnings.push("buffer_short");
  }
  if (end > fileDuration) end = fileDuration;
  if (end - start < 1) return { ok: false, reason: "too_old" };
  return { ok: true, start, duration: end - start, warnings };
}

const AUDIO_KBPS = 96;

// Video bitrate (and a size to shrink to) so a clip of `duration` seconds stays under
// `maxBytes`. Uses 90% of the limit, because a constant bitrate is only approximate.
export function encodePlan({ duration, maxBytes }) {
  const totalKbps = (maxBytes * 8 * 0.9) / Math.max(1, duration) / 1000;
  const videoKbps = Math.min(6000, Math.max(150, Math.floor(totalKbps - AUDIO_KBPS)));
  const height = videoKbps < 500 ? 480 : videoKbps < 1200 ? 720 : null;
  return { videoKbps, audioKbps: AUDIO_KBPS, height };
}

// "Duration: 00:00:45.12" out of what `ffmpeg -i file` prints. Null if not found.
export function parseDuration(ffmpegOutput) {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(ffmpegOutput ?? "");
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function formatOffset(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}
