import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "./config.mjs";
import { clipMessage, uploadClip } from "./discord.mjs";
import { cutClip, probeDuration } from "./ffmpeg.mjs";
import { FatalFeedError, fetchFeed } from "./freetip.mjs";
import { ObsClient } from "./obs.mjs";
import { createQueue } from "./queue.mjs";
import { formatOffset, planClip, secondsToWait } from "./trim.mjs";

// The Freetip OBS clip helper. Runs on the creator's own PC next to OBS:
//   1. asks Freetip which moments were saved (!ts in chat, big tips, goals),
//   2. waits until each moment is 10 seconds old, saves OBS's replay buffer,
//   3. cuts the 30 seconds around the moment out of that file with ffmpeg,
//   4. uploads the clip to the creator's Discord webhook.
// The video and the webhook address never leave this PC.

const log = (text) => console.log(`${new Date().toLocaleTimeString()}  ${text}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const configPath = resolve(process.argv[2] ?? "config.json");
const loaded = loadConfig(configPath);
if (!loaded.ok) {
  for (const e of loaded.errors) console.error(e);
  process.exit(1);
}
const config = loaded.config;

let ffmpegPath;
try {
  ffmpegPath = (await import("ffmpeg-static")).default;
  if (!ffmpegPath) throw new Error("no binary for this system");
} catch (err) {
  console.error(`The bundled ffmpeg is missing (${err.message}). Run "npm install" in this folder again.`);
  process.exit(1);
}

const workDir = join(tmpdir(), "freetip-clips");
await mkdir(workDir, { recursive: true });

const obs = new ObsClient({ url: config.obs.url, password: config.obs.password });
const maxBytes = config.maxUploadMb * 1024 * 1024;

// OBS is reconnected whenever it was closed, so the helper can be started first.
let connecting = null;
async function ensureObs() {
  if (obs.connected) return;
  connecting ??= (async () => {
    for (;;) {
      try {
        await obs.connect();
        log("Connected to OBS.");
        return;
      } catch (err) {
        log(`${err.message} Trying again in 10 seconds.`);
        await sleep(10_000);
      }
    }
  })().finally(() => { connecting = null; });
  await connecting;
}

async function makeClip(ev) {
  const label = `${formatOffset(ev.seconds ?? 0)}${ev.label ? ` ${ev.label}` : ""}`;
  const ageNow = () => ev.ageSeconds + (Date.now() - ev.receivedAt) / 1000;

  const wait = secondsToWait(ageNow(), config.secondsAfter);
  if (wait > 0) {
    log(`Moment ${ev.id} (${label}): waiting ${Math.ceil(wait)} s for the footage after it.`);
    await sleep(wait * 1000);
  }

  await ensureObs();
  const requestedAt = Date.now();
  const replayPath = await obs.saveReplay();
  const ageAtSave = ev.ageSeconds + (requestedAt - ev.receivedAt) / 1000;

  const fileDuration = await probeDuration(ffmpegPath, replayPath);
  const plan = planClip({ ageAtSave, fileDuration: fileDuration ?? 0, before: config.secondsBefore, after: config.secondsAfter });
  if (!plan.ok) {
    log(
      plan.reason === "too_old"
        ? `Moment ${ev.id} (${label}): skipped, it is older than the replay buffer. Make the buffer longer in OBS.`
        : `Moment ${ev.id} (${label}): skipped, OBS's replay file was empty or unreadable.`,
    );
    return;
  }
  if (plan.warnings.includes("buffer_short")) {
    log(`Moment ${ev.id} (${label}): the replay buffer is short, so the clip starts later than ${config.secondsBefore} s before the moment. Make it longer in OBS.`);
  }

  const output = join(workDir, `clip-${ev.id}.mp4`);
  try {
    const size = await cutClip({ ffmpegPath, input: replayPath, output, start: plan.start, duration: plan.duration, maxBytes });
    if (size > maxBytes) {
      log(`Moment ${ev.id} (${label}): the clip came out at ${(size / 1048576).toFixed(1)} MB, over your ${config.maxUploadMb} MB limit, so it was not uploaded.`);
      return;
    }
    const result = await uploadClip({
      webhook: config.discordWebhook,
      filePath: output,
      message: clipMessage({ time: ev.seconds === null ? null : formatOffset(ev.seconds), label: ev.label, videoId: ev.videoId, seconds: ev.seconds }),
    });
    log(
      result === "sent"
        ? `Moment ${ev.id} (${label}): clip sent to Discord.`
        : result === "too_big"
          ? `Moment ${ev.id} (${label}): Discord said the file is too big. Lower maxUploadMb in config.json.`
          : `Moment ${ev.id} (${label}): Discord did not take the clip (${result}).`,
    );
  } finally {
    await rm(output, { force: true });
  }
}

const queue = createQueue(makeClip, {
  max: 20,
  onDrop: (ev) => log(`Moment ${ev.id}: too many clips waiting, skipped.`),
  onError: (ev, err) => log(`Moment ${ev.id}: ${err.message}`),
});

// The poll loop. The first answer only tells us where to begin, so clips are not made
// for moments from before the helper started.
async function watch() {
  const controller = new AbortController();
  process.on("SIGINT", () => { controller.abort(); obs.close(); process.exit(0); });
  let cursor = null;
  let failures = 0;
  for (;;) {
    try {
      const feed = await fetchFeed({
        baseUrl: config.freetipUrl,
        token: config.helperToken,
        since: cursor,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40_000)]),
      });
      failures = 0;
      const receivedAt = Date.now();
      if (cursor === null) {
        log(`Watching Freetip. OBS's replay buffer should be at least ${feed.replayBufferSeconds ?? "?"} seconds long for your delay setting.`);
      }
      cursor = feed.cursor;
      for (const ev of feed.events) {
        if (!config.sources.includes(ev.source)) continue;
        const state = queue.push({ ...ev, receivedAt });
        if (state === "queued") log(`New moment ${ev.id} (${formatOffset(ev.seconds ?? 0)}${ev.label ? ` ${ev.label}` : ""}).`);
      }
    } catch (err) {
      if (err instanceof FatalFeedError) {
        console.error(err.message);
        process.exit(1);
      }
      failures += 1;
      const delay = Math.min(60, 2 ** Math.min(failures, 6));
      log(`Could not reach Freetip (${err.message}). Trying again in ${delay} s.`);
      await sleep(delay * 1000);
    }
  }
}

log("Freetip OBS clip helper started.");
ensureObs().catch(() => {});
await watch();
