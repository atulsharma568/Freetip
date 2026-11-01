import { expect, test } from "@playwright/test";
import { purgeOldTipText } from "../src/lib/retention";
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
