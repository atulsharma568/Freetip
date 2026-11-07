import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { encodePlan, parseDuration } from "./trim.mjs";

// Running ffmpeg (bundled with the helper through ffmpeg-static) to measure and cut.

function run(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let out = "";
    child.stderr.on("data", (d) => { out = (out + d).slice(-20_000); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out }));
  });
}

// How long a recording is. `ffmpeg -i file` with no output exits with an error code on
// purpose, but still prints the duration.
export async function probeDuration(ffmpegPath, file) {
  const { out } = await run(ffmpegPath, ["-hide_banner", "-i", file]);
  return parseDuration(out);
}

// The ffmpeg arguments for one clip: start and length in seconds, re-encoded to H.264 and
// AAC at a bitrate that fits `maxBytes` (re-encoding also makes the cut exact, where a
// straight copy could only cut on keyframes).
export function cutArgs({ input, output, start, duration, maxBytes }) {
  const { videoKbps, audioKbps, height } = encodePlan({ duration, maxBytes });
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-ss", start.toFixed(2), "-i", input, "-t", duration.toFixed(2)];
  if (height) args.push("-vf", `scale=-2:${height}`);
  args.push(
    "-c:v", "libx264", "-preset", "veryfast",
    "-b:v", `${videoKbps}k`, "-maxrate", `${videoKbps}k`, "-bufsize", `${videoKbps * 2}k`,
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", `${audioKbps}k`,
    "-movflags", "+faststart",
    output,
  );
  return args;
}

// The arguments for the keep-forever copy: same exact cut, but near-lossless (CRF 18,
// source size and frame rate), no size limit. Discord gets the small copy; this one is
// for the creator to edit or post anywhere.
export function fullQualityArgs({ input, output, start, duration }) {
  return [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", start.toFixed(2), "-i", input, "-t", duration.toFixed(2),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    output,
  ];
}

export async function cutFullQuality({ ffmpegPath, input, output, start, duration }) {
  const { code, out } = await run(ffmpegPath, fullQualityArgs({ input, output, start, duration }));
  if (code !== 0) throw new Error(`ffmpeg could not save the full-quality clip: ${out.trim().split("\n").slice(-2).join(" ")}`);
  return (await stat(output)).size;
}

// Cuts the clip. Returns the file's size in bytes.
export async function cutClip({ ffmpegPath, input, output, start, duration, maxBytes }) {
  const { code, out } = await run(ffmpegPath, cutArgs({ input, output, start, duration, maxBytes }));
  if (code !== 0) throw new Error(`ffmpeg could not cut the clip: ${out.trim().split("\n").slice(-2).join(" ")}`);
  return (await stat(output)).size;
}
