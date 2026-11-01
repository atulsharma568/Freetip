import { expect, test } from "@playwright/test";
import { getCreatorDetail } from "../src/lib/admin/creator-detail";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

test("creator detail: profile, captured totals, latest tips; unknown id is null", async () => {
  const pg = await freshDatabase();
  const u = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, name, creator_status, upi_vpa)
     values ('g1', 'a@example.com', 'ace', 'Ace', 'active', 'ace@upi') returning id::text`,
  );
  const id = Number(u.rows[0].id);
  await pg.query(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, status, captured_at, fan_name)
     values ($1, 'ref-1', 10000, 'captured', now(), 'Kabir'), ($1, 'ref-2', 5000, 'failed', null, null)`,
    [id],
  );
  const db = asLedgerDb(pg);

  const r = await getCreatorDetail(db, id);
  expect(r.ok).toBe(true);
  if (!r.ok || !r.data) throw new Error("expected data");
  expect(r.data).toMatchObject({ handle: "ace", capturedCount: 1, capturedMinor: 10000, upiVpa: "ace@upi" });
  expect(r.data.recentTips).toHaveLength(2);
  expect(r.data.payouts).toEqual([]);

  const none = await getCreatorDetail(db, id + 999);
  expect(none).toEqual({ ok: true, data: null });
});
