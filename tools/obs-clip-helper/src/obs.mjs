import { createHash, randomUUID } from "node:crypto";

// A small client for OBS's built-in WebSocket server (obs-websocket 5, OBS 28 and newer).
// Only what the helper needs: log in, ask whether the replay buffer is running, save it,
// and learn where the file went.

const sha256b64 = (text) => createHash("sha256").update(text).digest("base64");

// OBS's login: base64(sha256(base64(sha256(password + salt)) + challenge)).
export function authString(password, salt, challenge) {
  return sha256b64(sha256b64(password + salt) + challenge);
}

const OUTPUTS_EVENTS = 1 << 6;

export class ObsClient {
  constructor({ url, password = "", WebSocketImpl = globalThis.WebSocket, log = () => {} }) {
    this.url = url;
    this.password = password;
    this.WebSocketImpl = WebSocketImpl;
    this.log = log;
    this.ws = null;
    this.pending = new Map();
    this.waiters = new Set();
  }

  get connected() {
    return this.ws !== null && this.ws.readyState === 1;
  }

  // Opens the connection and logs in. Rejects with a sentence the creator can act on.
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        reject(new Error(message));
      };
      let ws;
      try {
        ws = new this.WebSocketImpl(this.url, ["obswebsocket.json"]);
      } catch {
        return fail(`"${this.url}" is not a usable OBS address.`);
      }
      this.ws = ws;
      const timer = setTimeout(() => fail("OBS did not answer. Is OBS open with the WebSocket server on?"), 10_000);

      ws.addEventListener("error", () => fail("Could not reach OBS. Is it open, with Tools, WebSocket Server Settings, Enable on?"));
      ws.addEventListener("close", (ev) => {
        clearTimeout(timer);
        for (const p of this.pending.values()) p.reject(new Error("OBS closed the connection."));
        this.pending.clear();
        this.ws = null;
        if (ev.code === 4009) fail("OBS refused the password. Check obs.password in config.json.");
        fail("OBS closed the connection.");
      });
      ws.addEventListener("message", (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.op === 0) {
          const identify = { rpcVersion: 1, eventSubscriptions: OUTPUTS_EVENTS };
          if (msg.d?.authentication) {
            if (!this.password) return fail("OBS needs a password. Put it in obs.password in config.json.");
            identify.authentication = authString(this.password, msg.d.authentication.salt, msg.d.authentication.challenge);
          }
          ws.send(JSON.stringify({ op: 1, d: identify }));
        } else if (msg.op === 2) {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve();
          }
        } else if (msg.op === 7) {
          const p = this.pending.get(msg.d?.requestId);
          if (!p) return;
          this.pending.delete(msg.d.requestId);
          if (msg.d.requestStatus?.result) p.resolve(msg.d.responseData ?? {});
          else p.reject(new Error(msg.d.requestStatus?.comment || `OBS refused ${msg.d.requestType}.`));
        } else if (msg.op === 5) {
          for (const w of [...this.waiters]) w(msg.d);
        }
      });
    });
  }

  request(requestType, requestData = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error("Not connected to OBS."));
      const requestId = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`OBS did not answer ${requestType}.`));
      }, 15_000);
      this.pending.set(requestId, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }

  async replayBufferRunning() {
    const status = await this.request("GetReplayBufferStatus");
    return status.outputActive === true;
  }

  // Saves the replay buffer and returns the file's path. The event is registered before
  // the request so a fast OBS cannot be missed; if it never comes, OBS is asked for the
  // last saved replay instead.
  async saveReplay() {
    if (!(await this.replayBufferRunning())) {
      throw new Error("The replay buffer is not running in OBS. Turn it on (Settings, Output, Replay Buffer) and press Start Replay Buffer.");
    }
    let resolveEvent;
    const saved = new Promise((resolve) => { resolveEvent = resolve; });
    const waiter = (event) => {
      if (event?.eventType === "ReplayBufferSaved" && event.eventData?.savedReplayPath) resolveEvent(event.eventData.savedReplayPath);
    };
    this.waiters.add(waiter);
    try {
      await this.request("SaveReplayBuffer");
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 10_000));
      const fromEvent = await Promise.race([saved, timeout]);
      if (fromEvent) return fromEvent;
      const last = await this.request("GetLastReplayBufferReplay");
      if (!last.savedReplayPath) throw new Error("OBS saved the replay but did not say where.");
      return last.savedReplayPath;
    } finally {
      this.waiters.delete(waiter);
    }
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
  }
}
