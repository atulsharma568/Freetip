import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { closeCreatorAccount, CLOSED_EMAIL_DOMAIN } from "../src/lib/account-close";
import { postCaptureAccrual } from "../src/lib/accrual";
import { postTipReversal } from "../src/lib/reversal";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Closing an account against the real schema (in-memory Postgres): what is erased,
// what stays, and what stops it. Lock behaviour under real concurrency is not shown.

let seq = 0;

async function fullCreator(pg: PGlite) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, name, display_name, picture_url, bio, handle,
        yt_channel_id, yt_channel_name, yt_channel_url, legal_name, upi_vpa, banned_words,
        goal_title, goal_target_paise, goal_started_at, overlay_token_hash, creator_status)
     values ($1, $2, 'Real Name', 'Shown Name', 'https://lh3.googleusercontent.com/a', 'my bio', $3,
        'UC123', 'My Channel', 'https://youtube.com/channel/UC123', 'Legal Name', 'me@upi', 'badword',
        'New mic', 500000, now(), $4, 'active') returning id::text`,
    [`g${seq}`, `real${seq}@example.com`, `handle${seq}`, `tok${seq}`],
  );
  const id = Number(r.rows[0].id);
  await pg.query(
    `insert into creator_sounds (creator_id, name, blob_url, duration_ms, size_bytes)
     values ($1, 'ding', $2, 500, 1000)`,
    [id, `https://blob.example/ding${seq}.wav`],
  );
  return { id, googleId: `g${seq}`, email: `real${seq}@example.com`, handle: `handle${seq}` };
}

async function liveTip(pg: PGlite, creatorId: number, gross = 10000) {
  seq += 1;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at)
     values ($1, $2, $3, 'captured', now()) returning id::text`,
    [creatorId, `tip_${seq}`, gross],
  );
  const paymentRef = `pay_${seq}`;
  await pg.query(
    `insert into payment_attempts
       (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status,
        amount_minor, idempotency_key, livemode, captured_amount_minor, captured_currency, captured_at)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, true, $4, 'INR', now())`,
    [t.rows[0].id, `order_${seq}`, paymentRef, gross, `tip_${seq}`],
  );
  return { paymentRef, gross };
}

const row = async (pg: PGlite, id: number) =>
  (await pg.query<Record<string, unknown>>(`select * from users where id = $1`, [id])).rows[0];

test("a creator with no money is emptied, keeps the handle and the records, and is logged", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  const res = await closeCreatorAccount(asLedgerDb(pg), c.id, { role: "creator", userId: c.id });
  expect(res).toEqual({ status: "closed", blobUrls: [`https://blob.example/ding${seq}.wav`] });

  const u = await row(pg, c.id);
  expect(u.google_id).toBe(`closed:${c.id}`);
  expect(u.email).toBe(`closed-${c.id}${CLOSED_EMAIL_DOMAIN}`);
  for (const col of [
    "name", "display_name", "picture_url", "bio", "yt_channel_id", "yt_channel_name", "yt_channel_url",
    "legal_name", "upi_vpa", "goal_title", "goal_target_paise", "goal_started_at", "overlay_token_hash",
  ]) {
    expect(u[col], col).toBeNull();
  }
  expect(u.banned_words).toBe("");
  expect(u.handle).toBe(c.handle);
  expect(u.creator_status).toBe("suspended");

  expect((await pg.query(`select 1 from creator_sounds where creator_id = $1`, [c.id])).rows).toHaveLength(0);
  const audit = await pg.query<{ action: string; actor_role: string; after_json: Record<string, unknown> }>(
    `select action, actor_role, after_json from audit_events where entity_ref = $1`,
    [String(c.id)],
  );
  expect(audit.rows).toHaveLength(1);
  expect(audit.rows[0].action).toBe("account.closed");
  expect(audit.rows[0].after_json).toEqual({ kept_payout_identity: false, sounds_removed: 1, contact_messages_removed: 0 });
  expect(JSON.stringify(audit.rows[0])).not.toContain("Real Name");
});

test("closing twice, or an unknown id, does nothing", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  const db = asLedgerDb(pg);
  await closeCreatorAccount(db, c.id, { role: "creator", userId: c.id });
  expect(await closeCreatorAccount(db, c.id, { role: "owner", userId: null })).toEqual({ status: "already_closed" });
  expect(await closeCreatorAccount(db, 999999, { role: "owner", userId: null })).toEqual({ status: "not_found" });
  expect((await pg.query(`select 1 from audit_events where action = 'account.closed'`)).rows).toHaveLength(1);
});

test("the same Google account can sign up again afterwards as a new account", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  await closeCreatorAccount(asLedgerDb(pg), c.id, { role: "creator", userId: c.id });
  const again = await pg.query<{ id: string }>(
    `insert into users (google_id, email) values ($1, $2) returning id::text`,
    [c.googleId, c.email],
  );
  expect(Number(again.rows[0].id)).not.toBe(c.id);
});

test("money on the balance stops it and changes nothing", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  const t = await liveTip(pg, c.id);
  const db = asLedgerDb(pg);
  expect(await postCaptureAccrual(db, t.paymentRef)).toEqual({ status: "posted" });
  expect(await closeCreatorAccount(db, c.id, { role: "creator", userId: c.id })).toEqual({
    status: "blocked",
    reason: "balance",
  });
  const u = await row(pg, c.id);
  expect(u.google_id).toBe(c.googleId);
  expect(u.name).toBe("Real Name");
  expect((await pg.query(`select 1 from creator_sounds where creator_id = $1`, [c.id])).rows).toHaveLength(1);
  expect((await pg.query(`select 1 from audit_events where action = 'account.closed'`)).rows).toHaveLength(0);
});

test("a captured live tip not yet in the books stops it", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  await liveTip(pg, c.id);
  expect(await closeCreatorAccount(asLedgerDb(pg), c.id, { role: "creator", userId: c.id })).toEqual({
    status: "blocked",
    reason: "unposted_tips",
  });
});

test("a payout in progress stops it, a finished one does not", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  await pg.query(`insert into creator_payouts (creator_id, amount_minor, status) values ($1, 50000, 'initiated')`, [c.id]);
  expect(await closeCreatorAccount(asLedgerDb(pg), c.id, { role: "creator", userId: c.id })).toEqual({
    status: "blocked",
    reason: "payout_in_progress",
  });
  await pg.query(`update creator_payouts set status = 'completed' where creator_id = $1`, [c.id]);
  expect((await closeCreatorAccount(asLedgerDb(pg), c.id, { role: "creator", userId: c.id })).status).toBe("closed");
});

test("a creator whose money was posted and taken back keeps the payout identity but nothing else", async () => {
  const pg = await freshDatabase();
  const c = await fullCreator(pg);
  const t = await liveTip(pg, c.id);
  const db = asLedgerDb(pg);
  await postCaptureAccrual(db, t.paymentRef);
  expect((await postTipReversal(db, t.paymentRef, t.gross, "refund")).status).toBe("reversed");

  const res = await closeCreatorAccount(db, c.id, { role: "owner", userId: null });
  expect(res.status).toBe("closed");
  const u = await row(pg, c.id);
  expect(u.legal_name).toBe("Legal Name");
  expect(u.upi_vpa).toBe("me@upi");
  expect(u.name).toBeNull();
  expect(u.email).toBe(`closed-${c.id}${CLOSED_EMAIL_DOMAIN}`);
  // The money records are untouched.
  const entries = await pg.query(`select 1 from ledger_entries where creator_id = $1`, [c.id]);
  expect(entries.rows.length).toBeGreaterThan(0);
  const a = await pg.query<{ actor_role: string; after_json: Record<string, unknown> }>(
    `select actor_role, after_json from audit_events where entity_ref = $1`,
    [String(c.id)],
  );
  expect(a.rows[0].actor_role).toBe("owner");
  expect(a.rows[0].after_json.kept_payout_identity).toBe(true);
});
