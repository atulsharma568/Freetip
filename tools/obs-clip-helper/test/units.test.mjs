import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePlan, formatOffset, parseDuration, planClip, secondsToWait } from "../src/trim.mjs";
import { createQueue } from "../src/queue.mjs";
import { validateConfig } from "../src/config.mjs";
import { FatalFeedError, fetchFeed, parseFeed } from "../src/freetip.mjs";
import { authString } from "../src/obs.mjs";
import { clipMessage, uploadClip } from "../src/discord.mjs";
import { cutArgs, fullQualityArgs } from "../src/ffmpeg.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ------------------------------------------------------------------ trim maths

test("waits until the moment is 12 seconds old, never negative", () => {
  assert.equal(secondsToWait(0), 12);
  assert.equal(secondsToWait(5), 7);
  assert.equal(secondsToWait(12), 0);
  assert.equal(secondsToWait(90), 0);
  assert.equal(secondsToWait(-4), 12);
});

test("plans a 30 second clip around the moment inside the saved file", () => {
  // 60 s file, moment saved 14 s before the end: moment at 46 s, clip 26 to 56.
  const p = planClip({ ageAtSave: 14, fileDuration: 60 });
  assert.equal(p.ok, true);
  assert.equal(p.start, 26);
  assert.equal(p.duration, 30);
  assert.deepEqual(p.warnings, []);
});

test("starts at 0 and warns when the replay buffer is shorter than needed", () => {
  const p = planClip({ ageAtSave: 40, fileDuration: 45 });
  assert.equal(p.ok, true);
  assert.equal(p.start, 0);
  // moment at 5 s, clip 0 to 15 s
  assert.equal(p.duration, 15);
  assert.deepEqual(p.warnings, ["buffer_short"]);
});

test("ends at the file's end when saved early", () => {
  const p = planClip({ ageAtSave: 3, fileDuration: 60 });
  assert.equal(p.start, 37);
  assert.equal(p.duration, 23);
});

test("refuses a moment older than the whole buffer, and an empty file", () => {
  assert.deepEqual(planClip({ ageAtSave: 100, fileDuration: 60 }), { ok: false, reason: "too_old" });
  assert.deepEqual(planClip({ ageAtSave: 5, fileDuration: 0 }), { ok: false, reason: "empty" });
  assert.deepEqual(planClip({ ageAtSave: 5, fileDuration: Number.NaN }), { ok: false, reason: "empty" });
  // Less than a second of footage left after the moment: nothing worth uploading.
  assert.equal(planClip({ ageAtSave: 19.5, fileDuration: 10 }).ok, false);
  // A moment a little before the file starts still has its aftermath in the file.
  const edge = planClip({ ageAtSave: 10.4, fileDuration: 10 });
  assert.equal(edge.ok, true);
  assert.equal(edge.start, 0);
});

test("a 30 second clip under 10 MB gets a bitrate that fits", () => {
  const { videoKbps, height } = encodePlan({ duration: 30, maxBytes: 10 * 1024 * 1024 });
  const bytes = ((videoKbps + 96) * 1000 * 30) / 8;
  assert.ok(bytes < 10 * 1024 * 1024, `would be ${bytes}`);
  assert.ok(videoKbps > 1500);
  assert.equal(height, null);
});

test("a tiny limit shrinks the picture and keeps a floor on the bitrate", () => {
  const e = encodePlan({ duration: 30, maxBytes: 1024 * 1024 });
  assert.equal(e.height, 480);
  assert.ok(e.videoKbps >= 150);
});

test("reads the duration out of ffmpeg's text", () => {
  assert.equal(parseDuration("  Duration: 00:01:05.50, start: 0.000000, bitrate: 4000 kb/s"), 65.5);
  assert.equal(parseDuration("Duration: 01:00:00.00,"), 3600);
  assert.equal(parseDuration("nothing here"), null);
});

test("formats times like YouTube", () => {
  assert.equal(formatOffset(754), "12:34");
  assert.equal(formatOffset(3723), "1:02:03");
  assert.equal(formatOffset(-5), "0:00");
});

test("ffmpeg arguments seek before the input and stay under the size limit", () => {
  const a = cutArgs({ input: "in.mkv", output: "out.mp4", start: 26, duration: 30, maxBytes: 10 * 1024 * 1024 });
  assert.ok(a.indexOf("-ss") < a.indexOf("-i"));
  assert.equal(a[a.indexOf("-t") + 1], "30.00");
  assert.equal(a.at(-1), "out.mp4");
  assert.ok(!a.includes("-vf"));
  const small = cutArgs({ input: "in.mkv", output: "out.mp4", start: 0, duration: 30, maxBytes: 1024 * 1024 });
  assert.ok(small.includes("scale=-2:480"));
});

// ----------------------------------------------------------------------- queue

const tick = () => new Promise((r) => setImmediate(r));

test("the queue does one clip at a time, in order, and never twice for one id", async () => {
  const log = [];
  let active = 0;
  let maxActive = 0;
  const q = createQueue(async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    log.push(`start ${item.id}`);
    await tick();
    await tick();
    log.push(`end ${item.id}`);
    active -= 1;
  });
  assert.equal(q.push({ id: 1 }), "queued");
  assert.equal(q.push({ id: 2 }), "queued");
  assert.equal(q.push({ id: 1 }), "duplicate");
  assert.equal(q.push({ id: 3 }), "queued");
  await q.idle();
  assert.deepEqual(log, ["start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
  assert.equal(maxActive, 1);
  // Already done: still not repeated.
  assert.equal(q.push({ id: 2 }), "duplicate");
});

test("an error in one clip does not stop the next, and the line has a limit", async () => {
  const done = [];
  const errors = [];
  const dropped = [];
  const q = createQueue(
    async (item) => {
      if (item.id === 1) throw new Error("boom");
      done.push(item.id);
    },
    { max: 2, onError: (item, e) => errors.push([item.id, e.message]), onDrop: (item) => dropped.push(item.id) },
  );
  q.push({ id: 1 });
  q.push({ id: 2 });
  q.push({ id: 3 });
  q.push({ id: 4 });
  await q.idle();
  // 1 runs at once so the line holds 2 and 3, and 4 is dropped.
  assert.deepEqual(errors, [[1, "boom"]]);
  assert.deepEqual(done, [2, 3]);
  assert.deepEqual(dropped, [4]);
});

// ---------------------------------------------------------------------- config

const goodToken = "a".repeat(43);
const goodHook = `https://discord.com/api/webhooks/123456789012345678/${"b".repeat(68)}`;

test("accepts a minimal config and fills in the defaults", () => {
  const r = validateConfig({ helperToken: goodToken, discordWebhook: goodHook });
  assert.equal(r.ok, true);
  assert.equal(r.config.freetipUrl, "https://freetip.in");
  assert.equal(r.config.obs.url, "ws://127.0.0.1:4455");
  assert.equal(r.config.maxUploadMb, 10);
  assert.deepEqual(r.config.sources, ["chat", "tip", "goal"]);
});

test("explains each mistake in the config", () => {
  const r = validateConfig({
    freetipUrl: "freetip.in",
    helperToken: "short",
    discordWebhook: "https://evil.example/api/webhooks/1/2",
    obs: { url: "http://x" },
    sources: ["chat", "email"],
    maxUploadMb: 0,
  });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 6);
  assert.equal(validateConfig(null).ok, false);
});

test("trims a trailing slash from the Freetip address", () => {
  const r = validateConfig({ freetipUrl: "https://freetip.in/", helperToken: goodToken, discordWebhook: goodHook });
  assert.equal(r.config.freetipUrl, "https://freetip.in");
});

// ------------------------------------------------------------------------ feed

test("parses a feed, dropping malformed events and clamping the age", () => {
  const feed = parseFeed({
    cursor: 9,
    delaySeconds: 22,
    replayBufferSeconds: 67,
    events: [
      { id: 8, source: "chat", videoId: "abcDEF12345", label: "Nice", seconds: 754, ageSeconds: 3.5 },
      { id: "9", source: "chat", videoId: "abcDEF12345", ageSeconds: 1 },
      { id: 10, source: "email", videoId: "abcDEF12345", ageSeconds: 1 },
      { id: 11, source: "tip", videoId: "abcDEF12345", ageSeconds: -4 },
      null,
    ],
  });
  assert.equal(feed.cursor, 9);
  assert.deepEqual(feed.events.map((e) => [e.id, e.label, e.seconds, e.ageSeconds]), [[8, "Nice", 754, 3.5], [11, "", null, 0]]);
  assert.throws(() => parseFeed({ events: [] }));
  assert.throws(() => parseFeed(null));
});

test("a 404 from Freetip is fatal, other failures are retried", async () => {
  const call = (status, body) =>
    fetchFeed({
      baseUrl: "https://freetip.in",
      token: goodToken,
      since: 5,
      fetchImpl: async (url) => {
        call.url = url;
        return { status, ok: status < 400, json: async () => body };
      },
    });
  await assert.rejects(call(404, {}), FatalFeedError);
  await assert.rejects(call(503, {}), (e) => !(e instanceof FatalFeedError));
  const ok = await call(200, { cursor: 5, events: [] });
  assert.equal(ok.cursor, 5);
  assert.equal(call.url, `https://freetip.in/api/ts-helper/${goodToken}/events?since=5`);
  const first = await fetchFeed({ baseUrl: "https://freetip.in", token: goodToken, since: null, fetchImpl: async (u) => ({ status: 200, ok: true, json: async () => ({ cursor: 0, events: [], u }) }) });
  assert.equal(first.cursor, 0);
});

// ------------------------------------------------------------------------- obs

test("OBS login string matches the protocol's published example", () => {
  assert.equal(
    authString("supersecretpassword", "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=", "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY="),
    "1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4=",
  );
});

// --------------------------------------------------------------------- discord

test("the Discord caption has the time, the label and a link, and cannot ping anyone", () => {
  const m = clipMessage({ time: "12:34", label: "@everyone Nice shot", videoId: "abcDEF12345", seconds: 754 });
  assert.equal(m.content, "Clip for 12:34: @everyone Nice shot\nhttps://youtu.be/abcDEF12345?t=754");
  assert.deepEqual(m.allowed_mentions, { parse: [] });
  assert.equal(clipMessage({ time: null, label: "", videoId: "abcDEF12345", seconds: null }).content, "Clip");
});

test("the upload sends multipart, retries once on a short rate limit and reports a too-big file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "clip-test-"));
  const file = join(dir, "c.mp4");
  writeFileSync(file, Buffer.alloc(100, 1));
  const message = clipMessage({ time: "0:10", label: "", videoId: "abcDEF12345", seconds: 10 });

  let bodies = [];
  const answers = (...statuses) => {
    let i = 0;
    return async (_url, init) => {
      bodies.push(init.body);
      const status = statuses[i++];
      return { ok: status === 200, status, json: async () => (status === 429 ? { retry_after: 0.01 } : status === 400 ? { code: 40005 } : {}) };
    };
  };
  assert.equal(await uploadClip({ webhook: "https://x", filePath: file, message, fetchImpl: answers(200) }), "sent");
  assert.ok(bodies[0] instanceof FormData);
  assert.equal(bodies[0].get("files[0]").size, 100);
  assert.deepEqual(JSON.parse(bodies[0].get("payload_json")).allowed_mentions, { parse: [] });
  bodies = [];
  assert.equal(await uploadClip({ webhook: "https://x", filePath: file, message, fetchImpl: answers(429, 200) }), "sent");
  assert.equal(bodies.length, 2);
  assert.equal(await uploadClip({ webhook: "https://x", filePath: file, message, fetchImpl: answers(413) }), "too_big");
  assert.equal(await uploadClip({ webhook: "https://x", filePath: file, message, fetchImpl: answers(400) }), "too_big");
  assert.equal(await uploadClip({ webhook: "https://x", filePath: file, message, fetchImpl: answers(500) }), "failed");
});

// ------------------------------------------------------------------ full-quality copy

test("the full-quality copy is near-lossless and has no size cap", () => {
  const a = fullQualityArgs({ input: "in.mkv", output: "out.mp4", start: 26, duration: 30 });
  assert.equal(a[a.indexOf("-crf") + 1], "18");
  assert.ok(!a.includes("-fs") && !a.includes("-b:v") && !a.includes("-vf"));
  assert.equal(a.at(-1), "out.mp4");
});

test("saveFolder defaults to clips, can be turned off with an empty string, and must be text", () => {
  const base = { helperToken: goodToken, discordWebhook: goodHook };
  assert.equal(validateConfig(base).config.saveFolder, "clips");
  assert.equal(validateConfig({ ...base, saveFolder: "" }).config.saveFolder, "");
  assert.equal(validateConfig({ ...base, saveFolder: "  D:/Clips " }).config.saveFolder, "D:/Clips");
  assert.equal(validateConfig({ ...base, saveFolder: 5 }).ok, false);
});
