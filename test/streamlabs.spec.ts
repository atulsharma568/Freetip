import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import {
  MAX_ATTEMPTS,
  MIN_GAP_MS,
  alertAmount,
  alertMessage,
  alertName,
  buildAlert,
  exchangeCode,
  needsRefresh,
  retryDelayMs,
  sendDecision,
  type StreamlabsDeps,
} from "../src/lib/streamlabs";
import {
  disconnectStreamlabs,
  enqueueStreamlabsAlert,
  eraseStreamlabs,
  loadStreamlabsState,
  processOutbox,
  saveStreamlabsConnection,
  sendStreamlabsTest,
} from "../src/lib/streamlabs-outbox";
import { open } from "../src/lib/secret-box";
import { planFeatures } from "../src/lib/plans";
import { ALERT_WINDOW_MS } from "../src/lib/alerts";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The Streamlabs bridge: the rules for what is sent and when, then the queue and the
// sending against the real schema in memory, with a pretend Streamlabs.

process.env.YT_TOKEN_KEY = randomBytes(32).toString("base64");
process.env.STREAMLABS_CLIENT_ID = "test-client";
process.env.STREAMLABS_CLIENT_SECRET = "test-secret";

const T = new Date("2026-11-02T10:00:00Z");
const base = {
  mode: "split" as const,
  hasMessage: true,
  status: "pending" as const,
  pinned: false,
  capturedAt: T,
  decidedAt: null,
  now: new Date(T.getTime() + 5_000),
};

test.describe("what is sent", () => {
  test("a name is 2 to 25 characters; anything else is Anonymous or cut", () => {
    expect(alertName("Riya", false)).toBe("Riya");
    expect(alertName("Riya", true)).toBe("Anonymous");
    expect(alertName(null, false)).toBe("Anonymous");
    expect(alertName("R", false)).toBe("Anonymous");
    expect(alertName("  Riya   Sharma ", false)).toBe("Riya Sharma");
    expect(alertName("a".repeat(40), false)).toHaveLength(25);
  });

  test("asterisks and control characters cannot restyle or break the alert", () => {
    expect(alertName("*Evil* name", false)).toBe("Evil name");
    expect(alertName("Ri\u0000ya\nSharma", false)).toBe("Ri ya Sharma");
    expect(alertMessage("hello *world*\r\nbye", [])).toBe("hello world bye");
  });

  test("a message is one line, at most 250 characters, and null when empty or banned", () => {
    expect(alertMessage("   ", [])).toBeNull();
    expect(alertMessage(null, [])).toBeNull();
    expect(alertMessage("x".repeat(400), [])).toHaveLength(250);
    expect(alertMessage("you are a banana", ["banana"])).toBeNull();
    expect(alertMessage("great stream", ["banana"])).toBe("great stream");
  });

  test("amounts show whole rupees without .00", () => {
    expect(alertAmount(25000)).toBe("₹250");
    expect(alertAmount(25050)).toBe("₹250.50");
    expect(alertAmount(100000)).toBe("₹1,000");
  });

  test("the alert is a donation with the name and amount marked, the message underneath", () => {
    const a = buildAlert("Riya", 25000, "Great stream!");
    expect(a.type).toBe("donation");
    expect(a.message).toBe("*Riya* tipped *₹250*");
    expect(a.user_message).toBe("Great stream!");
    expect(buildAlert("Riya", 25000, null).user_message).toBeUndefined();
  });
});

test.describe("when it is sent", () => {
  test("no message or a rejected one: send the name and amount now", () => {
    expect(sendDecision({ ...base, hasMessage: false })).toBe("without_message");
    expect(sendDecision({ ...base, status: "rejected" })).toBe("without_message");
  });

  test("instant mode sends an unrejected message; split and approve wait for a yes", () => {
    expect(sendDecision({ ...base, mode: "instant" })).toBe("with_message");
    expect(sendDecision({ ...base, mode: "split" })).toBe("wait");
    expect(sendDecision({ ...base, mode: "approve" })).toBe("wait");
    expect(sendDecision({ ...base, mode: "split", status: "approved" })).toBe("with_message");
    expect(sendDecision({ ...base, mode: "approve", status: "approved" })).toBe("with_message");
  });

  test("a pinned message waits for the creator even in instant mode", () => {
    expect(sendDecision({ ...base, mode: "instant", pinned: true })).toBe("wait");
    expect(sendDecision({ ...base, mode: "instant", pinned: true, status: "approved" })).toBe("with_message");
  });

  test("an alert older than the OBS window is dropped, counted from the later decision", () => {
    const late = new Date(T.getTime() + ALERT_WINDOW_MS + 1000);
    expect(sendDecision({ ...base, now: late })).toBe("too_late");
    const decided = new Date(T.getTime() + ALERT_WINDOW_MS - 1000);
    expect(sendDecision({ ...base, now: late, status: "approved", decidedAt: decided })).toBe("with_message");
  });

  test("retries back off and the token refreshes a minute early", () => {
    expect(retryDelayMs(1)).toBeLessThan(retryDelayMs(2));
    expect(retryDelayMs(99)).toBe(retryDelayMs(5));
    expect(needsRefresh(null, T)).toBe(false);
    expect(needsRefresh(new Date(T.getTime() + 30_000), T)).toBe(true);
    expect(needsRefresh(new Date(T.getTime() + 600_000), T)).toBe(false);
  });
});

// A pretend Streamlabs: answers each call with the next response, and keeps a clock the
// test can move.
function pretend(responses: { status: number; body?: unknown }[] = [{ status: 200 }]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  let nowMs = Date.now() + 5_000;
  const deps: StreamlabsDeps = {
    fetch: (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const r = responses[Math.min(i++, responses.length - 1)];
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
    }) as typeof fetch,
    now: () => new Date(nowMs),
  };
  return { calls, deps, advance: (ms: number) => (nowMs += ms) };
}

const form = (init: RequestInit) => new URLSearchParams(String(init.body));
let seq = 0;

async function creator(pg: PGlite, o: { features?: string[]; mode?: string; banned?: string; connected?: boolean } = {}) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, alert_mode, banned_words)
     values ($1, $2, $3, 'active', $4, $5, $6) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `sl${seq}`, o.features ?? ["streamlabs"], o.mode ?? "split", o.banned ?? ""],
  );
  const id = Number(r.rows[0].id);
  if (o.connected !== false) {
    await saveStreamlabsConnection(asLedgerDb(pg), id, { accessToken: "access-1", refreshToken: "refresh-1", expiresAt: null }, "Riya Streams");
  }
  return id;
}

async function tip(
  pg: PGlite,
  creatorId: number,
  o: { name?: string | null; message?: string | null; gross?: number; status?: string; msgStatus?: string; live?: boolean; anonymous?: boolean; highlight?: boolean } = {},
) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, fan_name, fan_message, anonymous, message_status, highlight, status, captured_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) returning id::text`,
    [creatorId, `tip_${seq}`, o.gross ?? 25000, "name" in o ? o.name : "Aman", "message" in o ? o.message : null, o.anonymous ?? false, o.msgStatus ?? "pending", o.highlight ?? false, o.status ?? "captured"],
  );
  const ref = `pay_${seq}`;
  await pg.query(
    `insert into payment_attempts (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status, amount_minor, idempotency_key, livemode)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, $6)`,
    [t.rows[0].id, `order_${seq}`, ref, o.gross ?? 25000, `tip_${seq}`, o.live ?? true],
  );
  return { tipId: Number(t.rows[0].id), ref };
}

const outbox = async (pg: PGlite, tipId: number) =>
  (await pg.query<{ state: string; reason: string | null; attempts: number; next_attempt_at: Date }>(
    `select state, reason, attempts, next_attempt_at from streamlabs_outbox where tip_order_id = $1`,
    [tipId],
  )).rows[0];

test.describe("queueing a tip", () => {
  test("a live, captured tip for a connected creator is queued once", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const { ref, tipId } = await tip(pg, id);
    expect(await enqueueStreamlabsAlert(db, ref)).toEqual({ status: "queued" });
    expect(await enqueueStreamlabsAlert(db, ref)).toEqual({ status: "already" });
    expect((await outbox(pg, tipId)).state).toBe("queued");
  });

  test("nothing is queued for test-mode money, an uncaptured tip, a switched-off feature or no connection", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    expect(await enqueueStreamlabsAlert(db, (await tip(pg, id, { live: false })).ref)).toEqual({ status: "skipped", reason: "test_mode" });
    expect(await enqueueStreamlabsAlert(db, (await tip(pg, id, { status: "created" })).ref)).toEqual({ status: "skipped", reason: "not_captured" });
    const off = await creator(pg, { features: [] });
    expect(await enqueueStreamlabsAlert(db, (await tip(pg, off)).ref)).toEqual({ status: "skipped", reason: "feature_off" });
    const none = await creator(pg, { connected: false });
    expect(await enqueueStreamlabsAlert(db, (await tip(pg, none)).ref)).toEqual({ status: "skipped", reason: "not_connected" });
    expect(await enqueueStreamlabsAlert(db, "pay_missing")).toEqual({ status: "skipped", reason: "no_such_payment" });
    expect((await pg.query(`select 1 from streamlabs_outbox`)).rows).toHaveLength(0);
  });
});

test.describe("sending", () => {
  test("a tip goes out as a bearer-authorised alert with the name, amount and message", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id, { name: "Aman", message: "Great stream!", gross: 25050 });
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend();
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 1, dropped: 0 });

    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe("https://streamlabs.com/api/v2.0/alerts");
    expect((s.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer access-1");
    const body = form(s.calls[0].init);
    expect(body.get("type")).toBe("donation");
    expect(body.get("message")).toBe("*Aman* tipped *₹250.50*");
    expect(body.get("user_message")).toBe("Great stream!");
    expect((await outbox(pg, tipId)).state).toBe("sent");
    expect((await loadStreamlabsState(db, id)).lastSentAt).not.toBeNull();
  });

  test("an anonymous tip is sent as Anonymous", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const { ref } = await tip(pg, id, { name: "Aman", anonymous: true });
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend();
    await processOutbox(db, s.deps);
    expect(form(s.calls[0].init).get("message")).toBe("*Anonymous* tipped *₹250*");
  });

  test("a message waits for approval in split mode, then goes with the alert", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "split" });
    const { ref, tipId } = await tip(pg, id, { message: "Hello there" });
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend();
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 0, waiting: 1 });
    expect(s.calls).toHaveLength(0);

    await pg.query(`update tip_orders set message_status = 'approved', message_decided_at = now() where id = $1`, [tipId]);
    s.advance(61_000);
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 1 });
    expect(form(s.calls[0].init).get("user_message")).toBe("Hello there");
  });

  test("a message with a banned word is left out but the tip still shows", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant", banned: "banana" });
    const { ref } = await tip(pg, id, { message: "you banana" });
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend();
    await processOutbox(db, s.deps);
    expect(form(s.calls[0].init).get("user_message")).toBeNull();
    expect(form(s.calls[0].init).get("message")).toContain("tipped");
  });

  test("two alerts for one creator are spaced out, the second waits", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    await enqueueStreamlabsAlert(db, (await tip(pg, id)).ref);
    await enqueueStreamlabsAlert(db, (await tip(pg, id)).ref);
    const s = pretend();
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 1, waiting: 1 });
    expect(s.calls).toHaveLength(1);
    s.advance(MIN_GAP_MS + 1000);
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 1 });
    expect(s.calls).toHaveLength(2);
  });

  test("two workers at once send a tip only once", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    await enqueueStreamlabsAlert(db, (await tip(pg, id)).ref);
    const s = pretend();
    await Promise.all([processOutbox(db, s.deps), processOutbox(db, s.deps)]);
    expect(s.calls).toHaveLength(1);
  });

  test("an alert older than an hour is dropped, not sent", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend();
    s.advance(ALERT_WINDOW_MS + 60_000);
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 0, dropped: 1 });
    expect(s.calls).toHaveLength(0);
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "too_late" });
  });

  test("switching the feature off after a tip is queued drops it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    await pg.query(`update users set paid_features = '{}' where id = $1`, [id]);
    const s = pretend();
    await processOutbox(db, s.deps);
    expect(s.calls).toHaveLength(0);
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "feature_off" });
  });
});

test.describe("when Streamlabs says no", () => {
  test("a refused token is refreshed once and the alert is sent again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend([
      { status: 401 },
      { status: 200, body: { access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 } },
      { status: 200 },
    ]);
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 1 });
    expect(s.calls.map((c) => c.url)).toEqual([
      "https://streamlabs.com/api/v2.0/alerts",
      "https://streamlabs.com/api/v2.0/token",
      "https://streamlabs.com/api/v2.0/alerts",
    ]);
    const refresh = form(s.calls[1].init);
    expect(refresh.get("grant_type")).toBe("refresh_token");
    expect(refresh.get("refresh_token")).toBe("refresh-1");
    expect(refresh.get("client_secret")).toBe("test-secret");
    expect((s.calls[2].init.headers as Record<string, string>).Authorization).toBe("Bearer access-2");

    const [row] = (await pg.query<{ a: string; r: string; e: Date | null }>(
      `select access_token_enc as a, refresh_token_enc as r, expires_at as e from streamlabs_connections where creator_id = $1`,
      [id],
    )).rows;
    expect(open(row.a)).toBe("access-2");
    expect(open(row.r)).toBe("refresh-2");
    expect(row.e).not.toBeNull();
    expect((await outbox(pg, tipId)).state).toBe("sent");
  });

  test("a refresh that is refused pauses the connection until the creator signs in again", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend([{ status: 401 }, { status: 400 }]);
    expect(await processOutbox(db, s.deps)).toMatchObject({ sent: 0, dropped: 1 });
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "reconnect_needed" });
    expect((await loadStreamlabsState(db, id)).reconnectNeeded).toBe(true);

    // Nothing more is queued while it waits for the creator.
    expect(await enqueueStreamlabsAlert(db, (await tip(pg, id)).ref)).toEqual({ status: "skipped", reason: "not_connected" });
    expect(await sendStreamlabsTest(db, id, pretend().deps)).toEqual({ status: "reconnect_needed" });

    // Connecting again clears it.
    await saveStreamlabsConnection(db, id, { accessToken: "a3", refreshToken: "r3", expiresAt: null }, "Riya Streams");
    expect((await loadStreamlabsState(db, id)).reconnectNeeded).toBe(false);
  });

  test("Streamlabs refusing the alert itself drops it and says why", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend([{ status: 400, body: { error: "bad", message: "bad" } }]);
    await processOutbox(db, s.deps);
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "rejected" });
    expect((await loadStreamlabsState(db, id)).lastError).toContain("400");
  });

  test("a server error is retried later and dropped after the last try", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    const s = pretend([{ status: 503 }]);
    expect(await processOutbox(db, s.deps)).toMatchObject({ retried: 1 });
    expect(await outbox(pg, tipId)).toMatchObject({ state: "queued", attempts: 1 });

    for (let n = 2; n <= MAX_ATTEMPTS; n += 1) {
      s.advance(11 * 60_000);
      await processOutbox(db, s.deps);
    }
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "failed", attempts: MAX_ATTEMPTS });
  });
});

test.describe("the test alert, disconnecting and closing", () => {
  test("the test button sends once, then asks to wait", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg);
    const s = pretend();
    expect(await sendStreamlabsTest(db, id, s.deps)).toEqual({ status: "sent" });
    expect(form(s.calls[0].init).get("message")).toContain("test");
    expect(await sendStreamlabsTest(db, id, s.deps)).toEqual({ status: "wait" });
    expect(await sendStreamlabsTest(db, 999999, s.deps)).toEqual({ status: "not_connected" });
  });

  test("disconnecting deletes the tokens and drops what was queued", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    const { ref, tipId } = await tip(pg, id);
    await enqueueStreamlabsAlert(db, ref);
    await disconnectStreamlabs(db, id);
    expect((await pg.query(`select 1 from streamlabs_connections`)).rows).toHaveLength(0);
    expect(await outbox(pg, tipId)).toMatchObject({ state: "dropped", reason: "disconnected" });
    const s = pretend();
    await processOutbox(db, s.deps);
    expect(s.calls).toHaveLength(0);
  });

  test("closing an account erases the connection and the queue", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const id = await creator(pg, { mode: "instant" });
    await enqueueStreamlabsAlert(db, (await tip(pg, id)).ref);
    await eraseStreamlabs(db, id);
    expect((await pg.query(`select 1 from streamlabs_connections`)).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from streamlabs_outbox`)).rows).toHaveLength(0);
  });
});

test.describe("signing in", () => {
  test("the code is swapped for tokens with the registered redirect address", async () => {
    const s = pretend([{ status: 200, body: { access_token: "a", refresh_token: "r", expires_in: 3600 } }]);
    const result = await exchangeCode("the-code", s.deps);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.tokens).toMatchObject({ accessToken: "a", refreshToken: "r" });
      expect(result.tokens.expiresAt).not.toBeNull();
    }
    const body = form(s.calls[0].init);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("client_id")).toBe("test-client");
    expect(body.get("redirect_uri")).toMatch(/\/api\/streamlabs\/callback$/);
  });

  test("an expired or refused code is invalid, a missing token is an error", async () => {
    expect((await exchangeCode("x", pretend([{ status: 400 }]).deps)).status).toBe("invalid");
    expect((await exchangeCode("x", pretend([{ status: 200, body: {} }]).deps)).status).toBe("error");
    expect((await exchangeCode("x", pretend([{ status: 500 }]).deps)).status).toBe("error");
  });
});

test.describe("the switch", () => {
  test("is off by default and only on when the owner ticks it", () => {
    expect(planFeatures(null).streamlabs).toBe(false);
    expect(planFeatures({ paid_features: ["streamlabs"] }).streamlabs).toBe(true);
  });
});
