import { expect, test } from "@playwright/test";
import { builtFeatureKeys } from "../src/lib/plans";
import type { PGlite } from "@electric-sql/pglite";
import { seal, open } from "../src/lib/secret-box";
import { clearLiveCache, hashToken, markTipPlayed, MAX_MOMENTS_PER_STREAM, postDueComments, recordMoment, type Deps } from "../src/lib/stream-timestamps";
import type { PostResult, RefreshResult, YouTubeClient, YtVideo } from "../src/lib/youtube";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Saving a moment from chat and posting the comment after the stream, against the real
// schema (in-memory Postgres) with a fake YouTube. Real YouTube, Nightbot, Discord and
// Google consent are not covered here.

const KEY = Buffer.alloc(32, 3).toString("base64");
const WEBHOOK = `https://discord.com/api/webhooks/123456789012345678/${"b".repeat(68)}`;
const VIDEO = "abcDEF12345";
const CHANNEL = "UC1234567890123456789012";
const START = "2026-11-01T10:00:00.000Z";
const NOW = new Date("2026-11-01T10:12:56.000Z"); // 12:56 in, minus 22 s delay = 12:34

let seq = 0;
const TOKEN = (n: number) => `${String(n).padStart(2, "0")}${"t".repeat(41)}`;

class FakeYt implements YouTubeClient {
  videos = new Map<string, YtVideo>();
  posted: { videoId: string; text: string }[] = [];
  refresh: RefreshResult = { ok: true, accessToken: "access" };
  post: PostResult = { outcome: "posted", commentId: "c1" };
  live: string | null = null;
  videoCalls = 0;
  async getVideos(ids: string[]) {
    this.videoCalls += 1;
    return new Map(ids.filter((i) => this.videos.has(i)).map((i) => [i, this.videos.get(i) as YtVideo]));
  }
  async refreshAccessToken() { return this.refresh; }
  async postComment(_a: string, videoId: string, text: string) {
    this.posted.push({ videoId, text });
    return this.post;
  }
  async activeBroadcast() { return this.live; }
  async revoke() {}
}

const video = (over: Partial<YtVideo> = {}): YtVideo => ({
  id: VIDEO, channelId: CHANNEL, title: "Ranked grind", startedAt: START, endedAt: null,
  isLive: true, visible: true, madeForKids: false, ...over,
});

test.beforeEach(() => clearLiveCache());

function setup(yt = new FakeYt(), discord?: Deps["discord"]) {
  const sent: unknown[] = [];
  const deps: Deps = {
    yt,
    discord: discord ?? (async (_url, payload) => { sent.push(payload); return "sent"; }),
    now: () => NOW,
    unseal: (s) => open(s, KEY),
  };
  return { yt, deps, sent };
}

async function creator(pg: PGlite, over: { channel?: string; webhook?: boolean; refresh?: boolean; status?: string } = {}) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, yt_channel_id, ts_token_hash, ts_delay_seconds,
                        yt_refresh_token_enc, discord_webhook_enc)
     values ($1, $2, $3, $4, $5, $6, 22, $7, $8) returning id::text`,
    [
      `g${seq}`, `c${seq}@example.com`, `handle${seq}`, over.status ?? "active", over.channel ?? CHANNEL, hashToken(TOKEN(seq)),
      over.refresh === false ? null : seal("refresh-token", KEY),
      over.webhook ? seal(WEBHOOK, KEY) : null,
    ],
  );
  await pg.query(`update users set paid_features = $1::text[] where id = $2`, [builtFeatureKeys(), r.rows[0].id]);
  return { id: Number(r.rows[0].id), token: TOKEN(seq) };
}

const chatId = (id = VIDEO) =>
  Buffer.concat([Buffer.from([0x0a, 0x0d, 0x0a, 0x0b]), Buffer.from(id, "latin1"), Buffer.from([0x12, 0x00])]).toString("base64url");

const say = (pg: PGlite, deps: Deps, token: string, user: string, message: string, cid = chatId()) =>
  recordMoment(asLedgerDb(pg), deps, { token, user, message, chatId: cid });

test.describe("saving a moment from chat", () => {
  test("saves it, counts from the stream's start minus the delay, and answers with the time", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, c.token, "@Ravi", "Nice shot")).toBe("Saved 12:34 Nice shot");

    const m = await pg.query<{ chat_user: string; title: string; source: string; delay_seconds: number }>(
      `select chat_user, title, source, delay_seconds from stream_timestamps`,
    );
    expect(m.rows).toEqual([{ chat_user: "Ravi", title: "Nice shot", source: "chat", delay_seconds: 22 }]);
    const s = await pg.query<{ title: string; state: string }>(`select title, state from timestamp_streams`);
    expect(s.rows).toEqual([{ title: "Ranked grind", state: "queued" }]);
  });

  test("a wrong or malformed token saves nothing", async () => {
    const pg = await freshDatabase();
    await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, TOKEN(99), "a", "x")).toMatch(/not set up/);
    expect(await say(pg, deps, "short", "a", "x")).toMatch(/not set up/);
    expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(0);
  });

  test("a suspended creator's command stops working", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { status: "suspended" });
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, c.token, "a", "x")).toMatch(/not set up/);
  });

  test("a stream that belongs to another channel is refused", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video({ channelId: "UCsomeoneelse000000000000" }));
    expect(await say(pg, deps, c.token, "a", "x")).toMatch(/another channel/);
    expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(0);
  });

  test("a stream already saved by another creator cannot be added to", async () => {
    const pg = await freshDatabase();
    const first = await creator(pg);
    const second = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    await say(pg, deps, first.token, "a", "mine");
    expect(await say(pg, deps, second.token, "b", "theirs")).toMatch(/another channel/);
    const rows = await pg.query<{ creator_id: string }>(`select creator_id::text from stream_timestamps`);
    expect(rows.rows).toHaveLength(1);
  });

  test("the same viewer must wait, a different one need not", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    await say(pg, deps, c.token, "Ravi", "one");
    expect(await say(pg, deps, c.token, "ravi", "two")).toMatch(/Wait a few seconds/);
    expect(await say(pg, deps, c.token, "Asha", "three")).toMatch(/Saved/);
    expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(2);
  });

  test("the whole command is limited per minute", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    let slowed = 0;
    for (let i = 0; i < 35; i++) if ((await say(pg, deps, c.token, `viewer${i}`, "x")).startsWith("Slow down")) slowed += 1;
    expect(slowed).toBe(5);
  });

  test("a blocked word is not saved as the title, but the moment still is", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    // Only the creator's own list blocks words now (the built-in list was removed).
    await pg.query(`update users set banned_words = 'madarchod' where id = $1`, [c.id]);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, c.token, "a", "you madarchod @everyone https://x.y")).toBe("Saved 12:34");
    const m = await pg.query<{ title: string | null }>(`select title from stream_timestamps`);
    expect(m.rows[0].title).toBeNull();
  });

  test("a creator it is not switched on for is told so and nothing is saved", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await pg.query(`update users set paid_features = '{}' where id = $1`, [c.id]);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, c.token, "a", "nice play")).toBe("Timestamps are not on for this channel.");
    expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(0);
  });

  test("stops at the per-stream limit", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    await say(pg, deps, c.token, "first", "go");
    await pg.query(
      `insert into stream_timestamps (creator_id, video_id) select $1, $2 from generate_series(1, $3)`,
      [c.id, VIDEO, MAX_MOMENTS_PER_STREAM],
    );
    expect(await say(pg, deps, c.token, "late", "x")).toMatch(/limit/);
  });

  test("without a chat id it asks YouTube which stream is live", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { yt, deps } = setup();
    yt.videos.set(VIDEO, video());
    expect(await say(pg, deps, c.token, "a", "x", "$(chatid)".slice(0, 0))).toMatch(/Could not tell which stream/);
    yt.live = VIDEO;
    expect(await say(pg, deps, c.token, "b", "x", "")).toMatch(/Saved/);
  });

  test("with YouTube down the moment is still saved, without a time", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    const { deps } = setup(); // no videos known: getVideos answers with an empty list
    expect(await say(pg, deps, c.token, "a", "later")).toBe("Saved later");
    expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(1);
  });

  test("Discord gets the moment, and a Discord failure never breaks the reply", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg, { webhook: true });
    const ok = setup();
    ok.yt.videos.set(VIDEO, video());
    expect(await say(pg, ok.deps, c.token, "Ravi", "Nice shot")).toBe("Saved 12:34 Nice shot");
    expect(ok.sent).toHaveLength(1);
    expect(JSON.stringify(ok.sent[0])).toContain(`https://youtu.be/${VIDEO}?t=754`);

    const down = setup(new FakeYt(), async () => "failed");
    down.yt.videos.set(VIDEO, video());
    expect(await say(pg, down.deps, c.token, "Asha", "again")).toMatch(/^Saved/);
  });
});

async function savedStream(pg: PGlite, deps: Deps, yt: FakeYt, opts: { refresh?: boolean } = {}) {
  const c = await creator(pg, { refresh: opts.refresh });
  yt.videos.set(VIDEO, video());
  await say(pg, deps, c.token, "Ravi", "Nice shot");
  await say(pg, deps, c.token, "Asha", "Big fail");
  return c;
}

const stateOf = async (pg: PGlite) =>
  (await pg.query<{ state: string; reason: string | null; comment_id: string | null }>(`select state, reason, comment_id from timestamp_streams`)).rows[0];

test.describe("posting the comment", () => {
  test("a stream still live is left alone", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt);
    const res = await postDueComments(asLedgerDb(pg), deps);
    expect(res).toMatchObject({ posted: 0, waiting: 1 });
    expect(yt.posted).toHaveLength(0);
    expect((await stateOf(pg)).state).toBe("queued");
  });

  test("an ended stream gets one comment with its moments, and a second run posts nothing", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt);
    yt.videos.set(VIDEO, video({ isLive: false, endedAt: "2026-11-01T11:00:00Z" }));

    const res = await postDueComments(asLedgerDb(pg), deps);
    expect(res.posted).toBe(1);
    expect(yt.posted).toHaveLength(1);
    expect(yt.posted[0]).toEqual({ videoId: VIDEO, text: "Timestamps:\n\n12:34 Nice shot / Big fail" });
    expect(await stateOf(pg)).toEqual({ state: "posted", reason: null, comment_id: "c1" });

    expect((await postDueComments(asLedgerDb(pg), deps)).posted).toBe(0);
    expect(yt.posted).toHaveLength(1);
  });

  test("an expired Google permission asks the creator to reconnect and keeps the stream waiting", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    const c = await savedStream(pg, deps, yt);
    yt.videos.set(VIDEO, video({ isLive: false }));
    yt.refresh = { ok: false, reason: "invalid_grant" };

    await postDueComments(asLedgerDb(pg), deps);
    expect(yt.posted).toHaveLength(0);
    expect(await stateOf(pg)).toMatchObject({ state: "queued", reason: "reconnect" });
    const u = await pg.query<{ yt_refresh_token_enc: string | null; yt_reconnect_needed: boolean }>(
      `select yt_refresh_token_enc, yt_reconnect_needed from users where id = $1`, [c.id],
    );
    expect(u.rows[0]).toEqual({ yt_refresh_token_enc: null, yt_reconnect_needed: true });
  });

  test("a creator who never connected YouTube waits, then is dropped after two days", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt, { refresh: false });
    yt.videos.set(VIDEO, video({ isLive: false }));
    await postDueComments(asLedgerDb(pg), deps);
    expect(await stateOf(pg)).toMatchObject({ state: "queued", reason: "not_connected" });

    await pg.query(`update timestamp_streams set created_at = now() - interval '3 days'`);
    await postDueComments(asLedgerDb(pg), deps);
    expect(await stateOf(pg)).toMatchObject({ state: "failed", reason: "not_connected" });
  });

  test("YouTube's daily limit leaves it queued for the next run", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt);
    yt.videos.set(VIDEO, video({ isLive: false }));
    yt.post = { outcome: "quota" };
    await postDueComments(asLedgerDb(pg), deps);
    expect(await stateOf(pg)).toMatchObject({ state: "queued", reason: "quota" });
    yt.post = { outcome: "posted", commentId: "c2" };
    await postDueComments(asLedgerDb(pg), deps);
    expect(await stateOf(pg)).toMatchObject({ state: "posted", comment_id: "c2" });
  });

  test("an unclear answer is never retried, so nothing is posted twice", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt);
    yt.videos.set(VIDEO, video({ isLive: false }));
    yt.post = { outcome: "unknown" };
    await postDueComments(asLedgerDb(pg), deps);
    await postDueComments(asLedgerDb(pg), deps);
    expect(yt.posted).toHaveLength(1);
    expect(await stateOf(pg)).toMatchObject({ state: "failed", reason: "unknown" });
  });

  test("comments off, made for kids, someone else's video and private videos are not posted", async () => {
    for (const [over, post, expected] of [
      [{ isLive: false }, { outcome: "rejected", reason: "not_commentable" } as PostResult, "not_commentable"],
      [{ isLive: false, madeForKids: true }, undefined, "not_commentable"],
      [{ isLive: false, channelId: "UCsomeoneelse000000000000" }, undefined, "not_owner"],
      [{ isLive: false, startedAt: null }, undefined, "never_live"],
    ] as [Partial<YtVideo>, PostResult | undefined, string][]) {
      const pg = await freshDatabase();
      const { yt, deps } = setup();
      await savedStream(pg, deps, yt);
      yt.videos.set(VIDEO, video(over));
      if (post) yt.post = post;
      await postDueComments(asLedgerDb(pg), deps);
      expect(await stateOf(pg)).toMatchObject({ state: "skipped", reason: expected });
      if (!post) expect(yt.posted).toHaveLength(0);
    }
  });

  test("a stream that died half way through posting is marked, not retried", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    await savedStream(pg, deps, yt);
    yt.videos.set(VIDEO, video({ isLive: false }));
    await pg.query(`update timestamp_streams set state = 'posting', claimed_at = now() - interval '2 hours'`);
    await postDueComments(asLedgerDb(pg), deps);
    expect(yt.posted).toHaveLength(0);
    expect(await stateOf(pg)).toMatchObject({ state: "failed", reason: "interrupted" });
  });

  test("moments are counted from YouTube's real start, not from the first command", async () => {
    const pg = await freshDatabase();
    const { yt, deps } = setup();
    const c = await creator(pg);
    yt.videos.set(VIDEO, video({ startedAt: null }));
    await say(pg, deps, c.token, "Ravi", "early"); // stream start unknown at the time
    yt.videos.set(VIDEO, video({ isLive: false }));
    await postDueComments(asLedgerDb(pg), deps);
    expect(yt.posted[0].text).toBe("Timestamps:\n\n12:34 early");
  });
});

async function liveTip(pg: PGlite, creatorId: number, gross: number, livemode = true) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at, fan_name)
     values ($1, $2, $3, 'captured', now(), 'Secret Fan') returning id::text`,
    [creatorId, `tip_${seq}`, gross],
  );
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, $6, $4, 'INR', now())`,
    [t.rows[0].id, `order_${seq}`, `pay_${seq}`, gross, `tip_${seq}`, livemode],
  );
  return Number(t.rows[0].id);
}

const marks = async (pg: PGlite) =>
  (await pg.query<{ title: string; source: string; chat_user: string | null; ref: string }>(
    `select title, source, chat_user, ref from stream_timestamps order by id`,
  )).rows;

test.describe("automatic moments for big tips and goals", () => {
  async function ready(over: { threshold?: number | null } = {}) {
    const pg = await freshDatabase();
    const c = await creator(pg, { webhook: true });
    await pg.query(`update users set ts_tip_min_paise = $2 where id = $1`, [c.id, over.threshold === undefined ? 50000 : over.threshold]);
    const fake = setup();
    fake.yt.videos.set(VIDEO, video());
    fake.yt.live = VIDEO;
    return { pg, c, ...fake };
  }

  test("a tip at or above the threshold adds a moment with only the amount, once", async () => {
    const { pg, c, deps, sent } = await ready();
    const big = await liveTip(pg, c.id, 50000);
    await markTipPlayed(asLedgerDb(pg), deps, big);
    await markTipPlayed(asLedgerDb(pg), deps, big); // OBS confirmed it twice
    expect(await marks(pg)).toEqual([{ title: "₹500 tip", source: "tip", chat_user: null, ref: `tip:${big}` }]);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).not.toContain("Secret Fan");
    expect(JSON.stringify(sent[0])).toContain("₹500 tip");
  });

  test("a smaller tip adds nothing", async () => {
    const { pg, c, deps } = await ready();
    await markTipPlayed(asLedgerDb(pg), deps, await liveTip(pg, c.id, 49900));
    expect(await marks(pg)).toHaveLength(0);
  });

  test("switched off, it does not even call YouTube", async () => {
    const { pg, c, deps, yt } = await ready({ threshold: null });
    await markTipPlayed(asLedgerDb(pg), deps, await liveTip(pg, c.id, 900000));
    expect(await marks(pg)).toHaveLength(0);
    expect(yt.videoCalls).toBe(0);
  });

  test("a creator who is not live adds nothing", async () => {
    const { pg, c, deps, yt } = await ready();
    yt.live = null;
    await markTipPlayed(asLedgerDb(pg), deps, await liveTip(pg, c.id, 50000));
    expect(await marks(pg)).toHaveLength(0);
  });

  test("a test-mode tip adds nothing", async () => {
    const { pg, c, deps } = await ready();
    await markTipPlayed(asLedgerDb(pg), deps, await liveTip(pg, c.id, 50000, false));
    expect(await marks(pg)).toHaveLength(0);
  });

  test("the tip that completes a goal adds one goal moment, even if another alert is confirmed later", async () => {
    const { pg, c, deps } = await ready({ threshold: 2000 });
    await pg.query(
      `insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over, started_at)
       values ($1, 'New mic', 50000, 'never', 'Asia/Kolkata', false, '2026-01-01T00:00:00Z')`,
      [c.id],
    );
    const first = await liveTip(pg, c.id, 30000);
    await markTipPlayed(asLedgerDb(pg), deps, first);
    expect((await marks(pg)).map((m) => m.source)).toEqual(["tip"]); // under the target: no goal moment
    const second = await liveTip(pg, c.id, 30000);
    await markTipPlayed(asLedgerDb(pg), deps, second);
    await markTipPlayed(asLedgerDb(pg), deps, first);
    const all = await marks(pg);
    expect(all.filter((m) => m.source === "goal")).toEqual([
      expect.objectContaining({ title: "Goal reached: New mic", chat_user: null }),
    ]);
  });

  test("automatic moments are in the comment with the chat ones", async () => {
    const { pg, c, deps, yt } = await ready();
    await say(pg, deps, c.token, "Ravi", "Nice shot");
    await markTipPlayed(asLedgerDb(pg), deps, await liveTip(pg, c.id, 50000));
    yt.videos.set(VIDEO, video({ isLive: false }));
    await postDueComments(asLedgerDb(pg), deps);
    expect(yt.posted[0].text).toMatch(/^Timestamps:\n\n12:34 Nice shot( \/ ₹500 tip)?\n?/);
    expect(yt.posted[0].text).toContain("₹500 tip");
  });
});
