import { expect, test } from "@playwright/test";
import { purgeHandledContactMessages, purgeOldTimestamps, purgeOldTipText } from "../src/lib/retention";
import { closeCreatorAccount } from "../src/lib/account-close";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The 90-day promise in the privacy policy, and the contact-message erasure on
// closing, against the real schema (in-memory Postgres).

let seq = 0;

async function creator(pg: Awaited<ReturnType<typeof freshDatabase>>, email = "c@example.com") {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status) values ($1, $2, $3, 'active') returning id::text`,
    [`g${seq}`, email, `handle${seq}`],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: Awaited<ReturnType<typeof freshDatabase>>, creatorId: number, ref: string, ageDays: number, status = "captured") {
  await pg.query(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, fan_name, fan_message, status, created_at)
     values ($1, $2, 10000, 'Fan', 'hello there', $3, now() - make_interval(days => $4))`,
    [creatorId, ref, status, ageDays],
  );
}

test("tip names and messages older than 90 days are blanked, newer ones and the amounts stay", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg);
  await tip(pg, id, "old_captured", 91);
  await tip(pg, id, "old_failed", 200, "failed");
  await tip(pg, id, "fresh", 89);

  const res = await purgeOldTipText(asLedgerDb(pg));
  expect(res).toEqual({ cleared: 2 });

  const rows = (await pg.query<{ public_reference: string; fan_name: string | null; fan_message: string | null; gross_amount_minor: string }>(
    `select public_reference, fan_name, fan_message, gross_amount_minor::text from tip_orders order by public_reference`,
  )).rows;
  const by = Object.fromEntries(rows.map((r) => [r.public_reference, r]));
  expect(by.old_captured.fan_name).toBeNull();
  expect(by.old_captured.fan_message).toBeNull();
  expect(by.old_captured.gross_amount_minor).toBe("10000");
  expect(by.old_failed.fan_message).toBeNull();
  expect(by.fresh.fan_name).toBe("Fan");
  expect(by.fresh.fan_message).toBe("hello there");

  const audit = await pg.query<{ after_json: object }>(`select after_json from audit_events where action = 'tips.text_purged'`);
  expect(audit.rows).toHaveLength(1);
  expect(audit.rows[0].after_json).toMatchObject({ cleared: 2, retention_days: 90 });
});

test("running it again with nothing due clears nothing and writes no audit row", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg);
  await tip(pg, id, "old", 120);
  await purgeOldTipText(asLedgerDb(pg));
  const again = await purgeOldTipText(asLedgerDb(pg));
  expect(again).toEqual({ cleared: 0 });
  const audit = await pg.query(`select 1 from audit_events where action = 'tips.text_purged'`);
  expect(audit.rows).toHaveLength(1);
});

test("closing an account deletes the contact messages sent from its sign-in email, only", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg, "Creator@Example.com");
  const insert = (email: string) =>
    pg.query(
      `insert into contact_messages (name, email, topic, message) values ('N', $1, 'general', 'a long enough message')`,
      [email],
    );
  await insert("creator@example.com");
  await insert("other@example.com");

  const res = await closeCreatorAccount(asLedgerDb(pg), id, { role: "creator", userId: id });
  expect(res.status).toBe("closed");

  const left = await pg.query<{ email: string }>(`select email from contact_messages`);
  expect(left.rows.map((r) => r.email)).toEqual(["other@example.com"]);
  const audit = await pg.query<{ after_json: { contact_messages_removed: number } }>(
    `select after_json from audit_events where action = 'account.closed'`,
  );
  expect(audit.rows[0].after_json.contact_messages_removed).toBe(1);
});

test("handled contact messages older than 12 months are deleted, new or unhandled ones stay", async () => {
  const pg = await freshDatabase();
  const add = (email: string, status: string, months: number) =>
    pg.query(
      `insert into contact_messages (name, email, topic, message, status, created_at)
       values ('N', $1, 'general', 'a long enough message', $2, now() - make_interval(months => $3))`,
      [email, status, months],
    );
  await add("old-handled@example.com", "handled", 13);
  await add("old-new@example.com", "new", 24);
  await add("recent-handled@example.com", "handled", 11);

  expect(await purgeHandledContactMessages(asLedgerDb(pg))).toEqual({ deleted: 1 });
  const left = await pg.query<{ email: string }>(`select email from contact_messages order by email`);
  expect(left.rows.map((r) => r.email)).toEqual(["old-new@example.com", "recent-handled@example.com"]);
  const audit = await pg.query(`select 1 from audit_events where action = 'contact.messages_purged'`);
  expect(audit.rows).toHaveLength(1);

  expect(await purgeHandledContactMessages(asLedgerDb(pg))).toEqual({ deleted: 0 });
});

test("stream timestamps older than 90 days are deleted, with finished streams that have none left", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg);
  const stream = (video: string, state: string, ageDays: number) =>
    pg.query(
      `insert into timestamp_streams (video_id, creator_id, state, created_at) values ($1, $2, $3, now() - make_interval(days => $4))`,
      [video, id, state, ageDays],
    );
  const moment = (video: string, ageDays: number) =>
    pg.query(
      `insert into stream_timestamps (creator_id, video_id, chat_user, title, created_at)
       values ($1, $2, 'viewer', 'nice', now() - make_interval(days => $3))`,
      [id, video, ageDays],
    );
  await stream("oldPosted11", "posted", 100);
  await moment("oldPosted11", 100);
  await stream("oldQueued11", "queued", 100); // still waiting for its stream to end
  await moment("oldQueued11", 100);
  await stream("recent11111", "posted", 10);
  await moment("recent11111", 10);

  expect(await purgeOldTimestamps(asLedgerDb(pg))).toEqual({ deleted: 2 });
  const moments = await pg.query<{ video_id: string }>(`select video_id from stream_timestamps`);
  expect(moments.rows.map((r) => r.video_id)).toEqual(["recent11111"]);
  const streams = await pg.query<{ video_id: string }>(`select video_id from timestamp_streams order by video_id`);
  expect(streams.rows.map((r) => r.video_id)).toEqual(["oldQueued11", "recent11111"]);
  const audit = await pg.query(`select 1 from audit_events where action = 'timestamps.purged'`);
  expect(audit.rows).toHaveLength(1);

  expect(await purgeOldTimestamps(asLedgerDb(pg))).toEqual({ deleted: 0 });
});

test("closing an account erases its stream timestamps and the YouTube and Discord secrets", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg);
  await pg.query(
    `update users set ts_token_hash = 'h', yt_refresh_token_enc = 'v1.x.y.z', discord_webhook_enc = 'v1.a.b.c',
                      ts_editor_token_hash = 'e', ts_public = true, ts_tip_min_paise = 50000,
                      ts_helper_token_hash = 'k', ts_helper_seen_at = now() where id = $1`,
    [id],
  );
  await pg.query(`insert into timestamp_streams (video_id, creator_id) values ('abcDEF12345', $1)`, [id]);
  await pg.query(`insert into stream_timestamps (creator_id, video_id, chat_user, title) values ($1, 'abcDEF12345', 'viewer', 'nice')`, [id]);

  expect((await closeCreatorAccount(asLedgerDb(pg), id, { role: "creator", userId: id })).status).toBe("closed");

  expect((await pg.query(`select 1 from stream_timestamps`)).rows).toHaveLength(0);
  expect((await pg.query(`select 1 from timestamp_streams`)).rows).toHaveLength(0);
  const u = await pg.query<Record<string, unknown>>(
    `select ts_token_hash, yt_refresh_token_enc, discord_webhook_enc, ts_editor_token_hash, ts_public, ts_tip_min_paise,
            ts_helper_token_hash, ts_helper_seen_at
       from users where id = $1`,
    [id],
  );
  expect(u.rows[0]).toEqual({
    ts_token_hash: null, yt_refresh_token_enc: null, discord_webhook_enc: null,
    ts_editor_token_hash: null, ts_public: false, ts_tip_min_paise: null,
    ts_helper_token_hash: null, ts_helper_seen_at: null,
  });
});
