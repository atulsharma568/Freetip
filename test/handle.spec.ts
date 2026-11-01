import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { checkHandle, claimHandle, renameHandle } from "../src/lib/handle";
import { closeCreatorAccount } from "../src/lib/account-close";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Claiming and the one allowed handle change, against the real schema (in-memory
// Postgres). The advisory lock is a no-op on one connection, so lock races are not
// shown; the unique indexes that back it up are.

let seq = 0;
async function creator(pg: PGlite, handle: string | null = null) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle) values ($1, $2, $3) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, handle],
  );
  return { id: Number(r.rows[0].id), googleId: `g${seq}` };
}

const handleOf = async (pg: PGlite, id: number) =>
  (await pg.query<{ handle: string | null }>(`select handle from users where id = $1`, [id])).rows[0].handle;

test("checkHandle lower-cases, trims, and rejects bad or reserved names", () => {
  expect(checkHandle("  Riya_Plays ")).toEqual({ ok: true, handle: "riya_plays" });
  expect(checkHandle("ab").ok).toBe(false);
  expect(checkHandle("has-dash").ok).toBe(false);
  expect(checkHandle("admin").ok).toBe(false);
  expect(checkHandle("overlay").ok).toBe(false);
});

test("a first claim works once, and not on a name already in use", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg);
  const b = await creator(pg);
  expect(await claimHandle(db, a.googleId, "riya")).toEqual({ status: "ok", handle: "riya" });
  expect(await claimHandle(db, a.googleId, "riya2")).toEqual({ status: "already_set" });
  expect(await claimHandle(db, b.googleId, "riya")).toEqual({ status: "taken" });
  expect(await claimHandle(db, "nobody", "free_name")).toEqual({ status: "not_found" });
});

test("the one change moves the handle, keeps the old one reserved, and is logged", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "oldname");
  const b = await creator(pg);

  expect(await renameHandle(db, a.googleId, "newname")).toEqual({ status: "ok", handle: "newname" });
  expect(await handleOf(pg, a.id)).toBe("newname");

  // Nobody can take the old name, not even by the first-claim path.
  expect(await claimHandle(db, b.googleId, "oldname")).toEqual({ status: "taken" });
  expect(await handleOf(pg, b.id)).toBeNull();

  const hist = await pg.query(`select old_handle, user_id::text from handle_history`);
  expect(hist.rows).toEqual([{ old_handle: "oldname", user_id: String(a.id) }]);

  const audit = await pg.query<{ action: string; after_json: unknown }>(
    `select action, after_json from audit_events where action = 'handle.renamed'`,
  );
  expect(audit.rows).toEqual([{ action: "handle.renamed", after_json: { from: "oldname", to: "newname" } }]);
});

test("a second change is refused and nothing moves", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "first");
  await renameHandle(db, a.googleId, "second");
  expect(await renameHandle(db, a.googleId, "third")).toEqual({ status: "already_renamed" });
  expect(await renameHandle(db, a.googleId, "first")).toEqual({ status: "already_renamed" });
  expect(await handleOf(pg, a.id)).toBe("second");
});

test("a rename to a name in use, an old name of someone else, or the same name changes nothing", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "alpha");
  const b = await creator(pg, "bravo");
  const c = await creator(pg, "charlie");
  await renameHandle(db, c.googleId, "charlie2");

  expect(await renameHandle(db, a.googleId, "bravo")).toEqual({ status: "taken" });
  expect(await renameHandle(db, a.googleId, "charlie")).toEqual({ status: "taken" });
  expect(await renameHandle(db, a.googleId, "alpha")).toEqual({ status: "same" });
  expect(await handleOf(pg, a.id)).toBe("alpha");
  expect(await handleOf(pg, b.id)).toBe("bravo");

  // A failed attempt does not use up the one change.
  expect(await renameHandle(db, a.googleId, "alpha2")).toEqual({ status: "ok", handle: "alpha2" });
});

test("no handle yet, closed accounts and unknown accounts cannot rename", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const none = await creator(pg);
  expect(await renameHandle(db, none.googleId, "something")).toEqual({ status: "no_handle" });
  expect(await renameHandle(db, "nobody", "something")).toEqual({ status: "not_found" });

  const gone = await creator(pg, "closing");
  const closed = await closeCreatorAccount(db, gone.id, { role: "creator", userId: gone.id });
  expect(closed.status).toBe("closed");
  // Its google_id is now "closed:<id>", so the old Google id finds nothing.
  expect(await renameHandle(db, gone.googleId, "reborn")).toEqual({ status: "not_found" });
  // And the closed account's handle stays reserved.
  const other = await creator(pg);
  expect(await claimHandle(db, other.googleId, "closing")).toEqual({ status: "taken" });
});

test("the database itself refuses a second history row per creator and a repeated old handle", async () => {
  const pg = await freshDatabase();
  const a = await creator(pg, "one");
  await pg.query(`insert into handle_history (old_handle, user_id) values ('gone1', $1)`, [a.id]);
  await expect(pg.query(`insert into handle_history (old_handle, user_id) values ('gone2', $1)`, [a.id])).rejects.toThrow();
  const b = await creator(pg, "two");
  await expect(pg.query(`insert into handle_history (old_handle, user_id) values ('gone1', $1)`, [b.id])).rejects.toThrow();
});
