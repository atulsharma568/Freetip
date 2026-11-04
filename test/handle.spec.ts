import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { checkHandle, claimHandle, renameHandle } from "../src/lib/handle";
import { checkUpi } from "../src/lib/upi";
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

// ── Handle change requests ───────────────────────────────────────────────────
import { approveHandleRequest, rejectHandleRequest, requestHandleChange } from "../src/lib/handle-requests";

const statusOf = async (pg: PGlite, id: number) =>
  (await pg.query<{ status: string }>(`select status from handle_requests where id = $1`, [id])).rows[0].status;

test("a request changes nothing until approved, then renames once", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "oldname");
  expect(await requestHandleChange(db, a.googleId, "newname")).toEqual({ status: "ok" });
  expect(await handleOf(pg, a.id)).toBe("oldname");
  expect((await pg.query(`select 1 from handle_history`)).rows).toHaveLength(0);

  const id = Number((await pg.query<{ id: string }>(`select id::text from handle_requests`)).rows[0].id);
  expect(await approveHandleRequest(db, id)).toEqual({ status: "approved", handle: "newname" });
  expect(await handleOf(pg, a.id)).toBe("newname");
  expect(await statusOf(pg, id)).toBe("approved");
  const audit = await pg.query<{ actor_role: string }>(`select actor_role from audit_events where action = 'handle.renamed'`);
  expect(audit.rows).toEqual([{ actor_role: "owner" }]);

  // Approved means the one change is used.
  expect(await requestHandleChange(db, a.googleId, "third")).toEqual({ status: "already_renamed" });
  expect(await approveHandleRequest(db, id)).toEqual({ status: "gone" });
});

test("one open request at a time; a rejection leaves the one change unused", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "alpha");
  expect(await requestHandleChange(db, a.googleId, "alpha2")).toEqual({ status: "ok" });
  expect(await requestHandleChange(db, a.googleId, "alpha3")).toEqual({ status: "already_pending" });

  const id = Number((await pg.query<{ id: string }>(`select id::text from handle_requests`)).rows[0].id);
  expect(await rejectHandleRequest(db, id, "  too close to another brand ")).toEqual({ status: "rejected" });
  expect(await handleOf(pg, a.id)).toBe("alpha");
  const note = await pg.query<{ decision_note: string }>(`select decision_note from handle_requests where id = $1`, [id]);
  expect(note.rows[0].decision_note).toBe("too close to another brand");

  expect(await requestHandleChange(db, a.googleId, "alpha3")).toEqual({ status: "ok" });
});

test("requests for a used name, the same name, no handle or a closed account are refused", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "alpha");
  await creator(pg, "bravo");
  const none = await creator(pg);
  expect(await requestHandleChange(db, a.googleId, "bravo")).toEqual({ status: "taken" });
  expect(await requestHandleChange(db, a.googleId, "alpha")).toEqual({ status: "same" });
  expect(await requestHandleChange(db, none.googleId, "something")).toEqual({ status: "no_handle" });
  expect(await requestHandleChange(db, "nobody", "something")).toEqual({ status: "not_found" });
  expect((await pg.query(`select 1 from handle_requests`)).rows).toHaveLength(0);
});

test("approval is blocked when the name was taken meanwhile, and the request stays open", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "alpha");
  const b = await creator(pg);
  await requestHandleChange(db, a.googleId, "wanted");
  await claimHandle(db, b.googleId, "wanted");

  const id = Number((await pg.query<{ id: string }>(`select id::text from handle_requests`)).rows[0].id);
  expect(await approveHandleRequest(db, id)).toEqual({ status: "blocked", reason: "taken" });
  expect(await handleOf(pg, a.id)).toBe("alpha");
  expect(await statusOf(pg, id)).toBe("pending");
});

test("an approval that renamed but stopped before marking the request can be finished", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "alpha");
  await requestHandleChange(db, a.googleId, "beta");
  const id = Number((await pg.query<{ id: string }>(`select id::text from handle_requests`)).rows[0].id);
  // The rename went through, then the process stopped: the request is still pending.
  await pg.query(`update users set handle = 'beta' where id = $1`, [a.id]);
  await pg.query(`insert into handle_history (old_handle, user_id) values ('alpha', $1)`, [a.id]);

  expect(await approveHandleRequest(db, id)).toEqual({ status: "approved", handle: "beta" });
  expect(await statusOf(pg, id)).toBe("approved");
});

test("closing an account erases its handle requests", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg, "leaving");
  await requestHandleChange(db, a.googleId, "leaving2");
  await closeCreatorAccount(db, a.id, { role: "creator", userId: a.id });
  expect((await pg.query(`select 1 from handle_requests`)).rows).toHaveLength(0);
});

test("checkUpi lower-cases and trims a valid UPI ID, and rejects anything else", () => {
  expect(checkUpi("  Riya@OKAxis ")).toEqual({ ok: true, upiVpa: "riya@okaxis" });
  expect(checkUpi("9876543210@paytm").ok).toBe(true);
  expect(checkUpi("").ok).toBe(false);
  expect(checkUpi("riya").ok).toBe(false);
  expect(checkUpi("ab@upi").ok).toBe(false);
  expect(checkUpi("riya@u1").ok).toBe(false);
});

test("a claim with a UPI ID saves both together; without one it saves only the handle", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg);
  const a = await creator(pg);
  const b = await creator(pg);
  const upiOf = async (id: number) =>
    (await pg.query<{ upi_vpa: string | null }>(`select upi_vpa from users where id = $1`, [id])).rows[0].upi_vpa;

  expect(await claimHandle(db, a.googleId, "withupi", "riya@okaxis")).toEqual({ status: "ok", handle: "withupi" });
  expect(await upiOf(a.id)).toBe("riya@okaxis");
  expect(await claimHandle(db, b.googleId, "noupi")).toEqual({ status: "ok", handle: "noupi" });
  expect(await upiOf(b.id)).toBeNull();

  // A refused claim must not write the UPI ID.
  const c = await creator(pg);
  expect(await claimHandle(db, c.googleId, "withupi", "other@okaxis")).toEqual({ status: "taken" });
  expect(await upiOf(c.id)).toBeNull();
});
