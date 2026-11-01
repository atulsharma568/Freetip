import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObsClient, authString } from "../src/obs.mjs";
import { cutClip, probeDuration } from "../src/ffmpeg.mjs";
import { planClip } from "../src/trim.mjs";

// The real pieces together: a fake OBS WebSocket server (password login, replay buffer
// status, save, event), a real video made by ffmpeg, and a real cut. Real OBS, a real
// stream and a real Discord are not covered; the owner checks those.

const require = createRequire(import.meta.url);
const { WebSocketServer } = require("ws");
const ffmpegPath = (await import("ffmpeg-static")).default;

function makeVideo(path, seconds) {
  const r = spawnSync(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `testsrc=duration=${seconds}:size=1280x720:rate=30`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", path,
  ]);
  assert.equal(r.status, 0, String(r.stderr));
}

function fakeObs({ password, replayPath, running = true, sendEvent = true }) {
  const salt = "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=";
  const challenge = "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=";
  const wss = new WebSocketServer({ port: 0, handleProtocols: (p) => (p.has("obswebsocket.json") ? "obswebsocket.json" : false) });
  const seen = [];
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: "5.5.0", rpcVersion: 1, ...(password ? { authentication: { challenge, salt } } : {}) } }));
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.op === 1) {
        if (password && msg.d.authentication !== authString(password, salt, challenge)) return ws.close(4009, "Authentication failed.");
        seen.push(["identify", msg.d.eventSubscriptions]);
        return ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
      }
      if (msg.op === 6) {
        const { requestType, requestId } = msg.d;
        seen.push([requestType]);
        const reply = (responseData = {}, result = true) =>
          ws.send(JSON.stringify({ op: 7, d: { requestType, requestId, requestStatus: { result, code: result ? 100 : 500, comment: result ? undefined : "nope" }, responseData } }));
        if (requestType === "GetReplayBufferStatus") reply({ outputActive: running });
        else if (requestType === "SaveReplayBuffer") {
          reply();
          if (sendEvent) setTimeout(() => ws.send(JSON.stringify({ op: 5, d: { eventType: "ReplayBufferSaved", eventIntent: 64, eventData: { savedReplayPath: replayPath } } })), 20);
        } else if (requestType === "GetLastReplayBufferReplay") reply({ savedReplayPath: replayPath });
        else reply({}, false);
      }
    });
  });
  return new Promise((resolve) => wss.on("listening", () => resolve({ wss, seen, url: `ws://127.0.0.1:${wss.address().port}` })));
}

test("save the replay through a fake OBS and cut the clip around the moment", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pipeline-"));
  const replay = join(dir, "replay.mp4");
  makeVideo(replay, 50);
  const obs = await fakeObs({ password: "hunter2", replayPath: replay });
  const client = new ObsClient({ url: obs.url, password: "hunter2" });
  try {
    await client.connect();
    assert.deepEqual(obs.seen[0], ["identify", 64]);
    const path = await client.saveReplay();
    assert.equal(path, replay);

    const duration = await probeDuration(ffmpegPath, path);
    assert.ok(Math.abs(duration - 50) < 0.5, `duration ${duration}`);

    // The moment happened 15 s before the save: at 35 s into the 50 s file.
    const plan = planClip({ ageAtSave: 15, fileDuration: duration });
    assert.equal(plan.ok, true);
    assert.ok(Math.abs(plan.start - 15) < 0.5);
    const out = join(dir, "clip.mp4");
    const size = await cutClip({ ffmpegPath, input: path, output: out, start: plan.start, duration: plan.duration, maxBytes: 10 * 1024 * 1024 });
    assert.equal(size, statSync(out).size);
    assert.ok(size > 0 && size < 10 * 1024 * 1024);
    const clipLength = await probeDuration(ffmpegPath, out);
    assert.ok(Math.abs(clipLength - 30) < 0.7, `clip ${clipLength}`);
  } finally {
    client.close();
    obs.wss.close();
  }
});

test("a small size limit still gives a clip under it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pipeline-"));
  const replay = join(dir, "replay.mp4");
  makeVideo(replay, 40);
  const out = join(dir, "clip.mp4");
  const limit = 2 * 1024 * 1024;
  const size = await cutClip({ ffmpegPath, input: replay, output: out, start: 5, duration: 30, maxBytes: limit });
  assert.ok(size < limit, `size ${size}`);
});

test("a wrong OBS password is explained", async () => {
  const obs = await fakeObs({ password: "right", replayPath: "/x" });
  const client = new ObsClient({ url: obs.url, password: "wrong" });
  try {
    await assert.rejects(client.connect(), /password/i);
  } finally {
    client.close();
    obs.wss.close();
  }
});

test("OBS asking for a password when none is set says so", async () => {
  const obs = await fakeObs({ password: "right", replayPath: "/x" });
  const client = new ObsClient({ url: obs.url, password: "" });
  try {
    await assert.rejects(client.connect(), /password/i);
  } finally {
    client.close();
    obs.wss.close();
  }
});

test("a stopped replay buffer is explained and nothing is saved", async () => {
  const obs = await fakeObs({ replayPath: "/x", running: false });
  const client = new ObsClient({ url: obs.url });
  try {
    await client.connect();
    await assert.rejects(client.saveReplay(), /replay buffer is not running/i);
    assert.ok(!obs.seen.some((s) => s[0] === "SaveReplayBuffer"));
  } finally {
    client.close();
    obs.wss.close();
  }
});

test("without the saved event it asks OBS for the last replay", async () => {
  const obs = await fakeObs({ replayPath: "/tmp/last.mkv", sendEvent: false });
  const client = new ObsClient({ url: obs.url });
  try {
    await client.connect();
    assert.equal(await client.saveReplay(), "/tmp/last.mkv");
  } finally {
    client.close();
    obs.wss.close();
  }
});
