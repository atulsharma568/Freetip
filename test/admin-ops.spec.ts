import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { getAuditActions, getAuditPage, getLastFeatureChange } from "../src/lib/admin/audit-queries";
import { getCreatorList, parseCreatorTab } from "../src/lib/admin/creator-list";
import { getFeatureMatrix } from "../src/lib/admin/features-queries";
import { fmtIST } from "../src/lib/admin/format";
import { cronJobs, describeSchedule, envStatus } from "../src/lib/admin/health";
import { rangeAllTime } from "../src/lib/admin/date-range";
import { getPayments } from "../src/lib/admin/payment-queries";
import { badgesFrom, getQueue } from "../src/lib/admin/queue";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The owner console's reads: audit history, the creators tabs, the feature matrix,
// the "needs you today" queue, and the health page's lists.

let seq = 0;
async function creator(
  pg: PGlite,
  o: { handle?: string; status?: string; onboarding?: string; features?: string[]; email?: string } = {},
): Promise<number> {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, onboarding_state, paid_features)
     values ($1, $2, $3, $4, $5, $6, $7) returning id::text`,
    [
      `g${seq}`,
      o.email ?? `c${seq}@example.com`,
      o.handle ?? `handle${seq}`,
      `Creator ${seq}`,
      o.status ?? "active",
      o.onboarding ?? "active",
      o.features ?? [],
    ],
  );
  return Number(r.rows[0].id);
}

async function audit(pg: PGlite, userId: number | null, action: string, at: string, reason = "set by the owner") {
  await pg.query(
    `insert into audit_events (actor_role, action, entity_type, entity_ref, before_json, after_json, reason, created_at)
     values ('owner', $1, 'user', $2, $3::jsonb, $4::jsonb, $5, $6)`,
    [action, userId === null ? null : String(userId), JSON.stringify({ a: 1 }), JSON.stringify({ a: 2 }), reason, at],
  );
}

test("audit page: newest first, filter by creator and action, honest totals and paging", async () => {
  const pg = await freshDatabase();
  const ace = await creator(pg, { handle: "ace" });
  const bea = await creator(pg, { handle: "bea" });
  await audit(pg, ace, "creator.approved", "2026-11-01T10:00:00Z");
  await audit(pg, ace, "creator.features_changed", "2026-11-01T11:00:00Z");
  await audit(pg, bea, "creator.suspended", "2026-11-01T12:00:00Z", "spam");
  const db = asLedgerDb(pg);

  const all = await getAuditPage(db, {});
  if (!all.ok) throw new Error(all.error);
  expect(all.data.total).toBe(3);
  expect(all.data.rows.map((r) => r.action)).toEqual([
    "creator.suspended",
    "creator.features_changed",
    "creator.approved",
  ]);
  expect(all.data.rows[0]).toMatchObject({ creatorId: bea, creatorLabel: "bea", reason: "spam", actorRole: "owner" });
  expect(all.data.rows[0].before).toEqual({ a: 1 });

  const byHandle = await getAuditPage(db, { creator: "ace" });
  expect(byHandle.ok && byHandle.data.total).toBe(2);
  const byId = await getAuditPage(db, { creator: String(bea) });
  expect(byId.ok && byId.data.rows.map((r) => r.action)).toEqual(["creator.suspended"]);
  const exact = await getAuditPage(db, { creatorId: ace }, 1);
  if (!exact.ok) throw new Error(exact.error);
  expect(exact.data.total).toBe(2);
  expect(exact.data.rows).toHaveLength(1);
  const byAction = await getAuditPage(db, { action: "creator.approved" });
  expect(byAction.ok && byAction.data.total).toBe(1);
  const page2 = await getAuditPage(db, { page: 2 }, 2);
  expect(page2.ok && page2.data.rows.map((r) => r.action)).toEqual(["creator.approved"]);

  const actions = await getAuditActions(db);
  expect(actions).toEqual({ ok: true, data: ["creator.approved", "creator.features_changed", "creator.suspended"] });

  const last = await getLastFeatureChange(db, ace);
  expect(last.ok && last.data?.at.toISOString()).toBe("2026-11-01T11:00:00.000Z");
  const none = await getLastFeatureChange(db, bea);
  expect(none).toEqual({ ok: true, data: null });
});

test("an owner removal of a sound is one statement that gives the audit row what it needs", async () => {
  const pg = await freshDatabase();
  const id = await creator(pg, { handle: "ace" });
  const s = await pg.query<{ id: string }>(
    `insert into creator_sounds (creator_id, name, blob_url, duration_ms, size_bytes) values ($1, 'Boom', 'https://x/y.mp3', 1000, 1000) returning id::text`,
    [id],
  );
  // The same statement as adminDeleteSound.
  const rows = await pg.query<{ blob_url: string; creator_id: string; name: string; handle: string | null }>(
    `with gone as (
       delete from creator_sounds where id = $1 returning blob_url, creator_id, name
     )
     select g.blob_url, g.creator_id::text, g.name, u.handle from gone g join users u on u.id = g.creator_id`,
    [Number(s.rows[0].id)],
  );
  expect(rows.rows).toEqual([{ blob_url: "https://x/y.mp3", creator_id: String(id), name: "Boom", handle: "ace" }]);
  const left = await pg.query(`select 1 from creator_sounds`);
  expect(left.rows).toHaveLength(0);
});

test("creators tabs count what needs a decision; closed accounts only show under All", async () => {
  const pg = await freshDatabase();
  await creator(pg, { status: "pending", onboarding: "not_started" }); // awaiting, pending
  await creator(pg, { status: "pending", onboarding: "submitted" }); // awaiting, pending, submitted
  await creator(pg, { status: "active", onboarding: "submitted" }); // awaiting, submitted
  await creator(pg, { status: "suspended", onboarding: "active" }); // suspended only
  await creator(pg, { status: "active", onboarding: "active" }); // none
  await creator(pg, { status: "pending", onboarding: "submitted", email: "closed-1@closed.invalid" }); // closed
  const db = asLedgerDb(pg);

  const r = await getCreatorList(db, { q: "", tab: "awaiting", page: 1 });
  if (!r.ok) throw new Error(r.error);
  expect(r.data.counts).toEqual({ awaiting: 3, pending: 2, submitted: 2, suspended: 1, all: 6 });
  expect(r.data.total).toBe(3);
  expect(r.data.rows).toHaveLength(3);

  const all = await getCreatorList(db, { q: "", tab: "all", page: 1 }, 4);
  if (!all.ok) throw new Error(all.error);
  expect(all.data.total).toBe(6);
  expect(all.data.rows).toHaveLength(4);
  expect(all.data.rows.some((c) => c.closed)).toBe(true);

  const searched = await getCreatorList(db, { q: "Creator 2", tab: "all", page: 1 });
  expect(searched.ok && searched.data.total).toBe(1);

  expect(parseCreatorTab(undefined, false)).toBe("awaiting");
  expect(parseCreatorTab(undefined, true)).toBe("all");
  expect(parseCreatorTab("suspended", true)).toBe("suspended");
  expect(parseCreatorTab("nonsense", false)).toBe("awaiting");
});

test("feature matrix shows what the site shows: extras are off without the base switch", async () => {
  const pg = await freshDatabase();
  const a = await creator(pg, { features: ["timestamps", "tipMarks", "supportStreak"] });
  const b = await creator(pg, { features: ["tipMarks"] }); // base missing: effectively nothing
  await creator(pg, { features: [] });
  await creator(pg, { features: [], email: "gone@closed.invalid" });
  const db = asLedgerDb(pg);

  const r = await getFeatureMatrix(db, { onlyOn: true });
  if (!r.ok) throw new Error(r.error);
  expect(r.data.creators).toBe(3);
  expect(r.data.withAny).toBe(1);
  expect(r.data.rows.map((x) => x.id)).toEqual([a]);
  expect(r.data.counts).toMatchObject({ timestamps: 1, tipMarks: 1, supportStreak: 1, topSupporter: 0 });
  expect(r.data.rows[0].effective.tipMarks).toBe(true);

  const everyone = await getFeatureMatrix(db, { onlyOn: false });
  expect(everyone.ok && everyone.data.matching).toBe(3);
  expect(everyone.ok && everyone.data.rows.find((x) => x.id === b)?.anyOn).toBe(false);
});

test("the needs-you queue counts each thing once and badges follow it", async () => {
  const pg = await freshDatabase();
  const p = await creator(pg, { status: "pending", onboarding: "submitted" });
  await creator(pg, { status: "active", onboarding: "submitted" });
  await creator(pg, { status: "active", onboarding: "active" });
  await pg.query(
    `insert into contact_messages (name, email, topic, message, status)
     values ('A', 'a@x.com', 'general', 'a message that is long enough', 'new'),
            ('B', 'b@x.com', 'general', 'another message long enough', 'handled')`,
  );
  await pg.query(
    `insert into handle_requests (user_id, current_handle, requested_handle) values ($1, 'old', 'newer')`,
    [p],
  );
  const q = await getQueue(asLedgerDb(pg));
  const n = (key: string) => {
    const item = q.items.find((i) => i.key === key);
    return item && item.count.ok ? item.count.data : null;
  };
  expect(n("pendingCreators")).toBe(1);
  expect(n("submittedSetups")).toBe(2);
  expect(n("newMessages")).toBe(1);
  expect(n("handleRequests")).toBe(1);
  expect(q.awaitingCreators).toEqual({ ok: true, data: 2 });
  expect(badgesFrom(q)).toEqual({ "/admin/creators": 2, "/admin/messages": 1, "/admin/handle-requests": 1 });
});

test("a failed read in the queue is reported, never turned into zero", async () => {
  const pg = await freshDatabase();
  await pg.exec("drop table handle_requests cascade");
  const q = await getQueue(asLedgerDb(pg));
  const item = q.items.find((i) => i.key === "handleRequests");
  expect(item?.count.ok).toBe(false);
  expect(badgesFrom(q)["/admin/handle-requests"]).toBe(0);
});

test("payment search runs against the real schema and finds nothing in an empty ledger", async () => {
  const pg = await freshDatabase();
  const r = await getPayments(asLedgerDb(pg), rangeAllTime(), 200, "ace_100%");
  expect(r.ok && r.data.rows).toEqual([]);
});

test("fmtIST: IST, one format per style, a dash for nothing", () => {
  const d = new Date("2026-11-01T18:30:00Z"); // 00:00 on 2 Nov in India
  expect(fmtIST(d, "date")).toMatch(/2 Nov 2026/);
  expect(fmtIST(d, "datetime")).toMatch(/2 Nov 2026/);
  expect(fmtIST(d.toISOString(), "short")).toMatch(/2 Nov/);
  expect(fmtIST(null)).toBe("—");
  expect(fmtIST(undefined)).toBe("—");
  expect(fmtIST("not a date")).toBe("—");
});

test("health: every cron route is scheduled and described; env status never carries a value", () => {
  const routes = readdirSync(join(__dirname, "..", "src", "app", "api", "cron"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `/api/cron/${e.name}`)
    .sort();
  const jobs = cronJobs();
  expect(jobs.map((j) => j.path)).toEqual(routes);
  for (const j of jobs) {
    expect(j.schedule, `${j.path} has no schedule in vercel.json`).not.toBeNull();
    expect(j.what, `${j.path} has no description`).not.toMatch(/^No description/);
  }
  expect(describeSchedule("17 3 * * *")).toBe("03:17 UTC daily");
  expect(describeSchedule("*/10 * * * *")).toBe("*/10 * * * *");

  const status = envStatus({ DATABASE_URL: "postgres://secret@host/db", CRON_SECRET: "  ", TTS_AUTOLEARN: "1" });
  const flat = status.flatMap((g) => g.vars);
  expect(flat.find((v) => v.name === "DATABASE_URL")?.set).toBe(true);
  expect(flat.find((v) => v.name === "CRON_SECRET")?.set).toBe(false);
  expect(flat.find((v) => v.name === "TTS_AUTOLEARN")).toMatchObject({ set: true, parked: true });
  expect(JSON.stringify(status)).not.toContain("secret@host");
});
