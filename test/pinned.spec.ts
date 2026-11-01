import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { PIN_SECONDS_DEFAULT, checkPinRequest, clampSeconds, parsePinSettings, pinOffer, resolvePinned } from "../src/lib/pinned";
import { loadPinned, loadPinnedPanel, pinAgain, pinApprovedTip, unpinAll } from "../src/lib/pinned-db";
import { pickNext, tipThanksLine, type TipRow } from "../src/lib/alerts";
import { planFeatures } from "../src/lib/plans";
import { tipExtraColumns } from "../src/lib/tip-extras";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Paid highlighted messages (phase 6): the pure rules, the pin and unpin flow against the
// real schema in memory, and the guarantee that a pinned message always waits for approval.

let seq = 0;

async function creator(pg: PGlite, o: { features?: string[]; minPaise?: number | null; seconds?: number } = {}) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, highlight_min_paise, highlight_seconds)
     values ($1, $2, $3, 'active', $4, $5, $6) returning id::text`,
    [`pg${seq}`, `pin${seq}@example.com`, `pinhandle${seq}`, o.features ?? ["highlightedMessages"], o.minPaise === undefined ? 20000 : o.minPaise, o.seconds ?? 30],
  );
  return Number(r.rows[0].id);
}

async function tip(
  pg: PGlite,
  creatorId: number,
  o: { highlight?: boolean; status?: string; messageStatus?: string; message?: string | null; name?: string | null; hoursAgo?: number; gross?: number } = {},
) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, fan_name, fan_message, status, message_status, highlight, captured_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() - make_interval(hours => $9)) returning id::text`,
    [
      creatorId,
      `tip_pin_${seq}`,
      o.gross ?? 25000,
      "name" in o ? o.name : "Riya",
      "message" in o ? o.message : "Great stream!",
      o.status ?? "captured",
      o.messageStatus ?? "approved",
      o.highlight ?? true,
      o.hoursAgo ?? 0,
    ],
  );
  return Number(r.rows[0].id);
}

const until = async (pg: PGlite, id: number) =>
  (await pg.query<{ secs: string | null }>(`select extract(epoch from (highlight_until - now()))::text as secs from tip_orders where id = $1`, [id])).rows[0].secs;

test.describe("rules", () => {
  test("the offer needs a whole-paise minimum at or above the site minimum", () => {
    expect(pinOffer(null)).toBeNull();
    expect(pinOffer({ highlight_min_paise: null })).toBeNull();
    expect(pinOffer({ highlight_min_paise: 1999 })).toBeNull();
    expect(pinOffer({ highlight_min_paise: 2000.5 })).toBeNull();
    expect(pinOffer({ highlight_min_paise: 20000, highlight_seconds: 45 })).toEqual({ minPaise: 20000, seconds: 45 });
  });

  test("the pinned time is clamped to 10 to 120 seconds, 30 when unknown", () => {
    expect(clampSeconds(3)).toBe(10);
    expect(clampSeconds(500)).toBe(120);
    expect(clampSeconds(null)).toBe(PIN_SECONDS_DEFAULT);
    expect(clampSeconds(Number.NaN)).toBe(PIN_SECONDS_DEFAULT);
    expect(pinOffer({ highlight_min_paise: 5000, highlight_seconds: null })?.seconds).toBe(PIN_SECONDS_DEFAULT);
  });

  test("the settings form: empty turns it off, a number under the site minimum is refused", () => {
    expect(parsePinSettings("", "30")).toEqual({ ok: true, minPaise: null, seconds: 30 });
    expect(parsePinSettings("200", "60")).toEqual({ ok: true, minPaise: 20000, seconds: 60 });
    expect(parsePinSettings("19", "30").ok).toBe(false);
    expect(parsePinSettings("abc", "30").ok).toBe(false);
    expect(parsePinSettings("200", "9").ok).toBe(false);
    expect(parsePinSettings("200", "121").ok).toBe(false);
    expect(parsePinSettings("200", "").ok).toBe(false);
    expect(parsePinSettings("100001", "30").ok).toBe(false);
  });

  test("a fan's request is refused before payment when it cannot be met", () => {
    const offer = { minPaise: 20000, seconds: 30 };
    expect(checkPinRequest({ featureOn: true, offer, amountPaise: 20000, message: "hi" })).toBeNull();
    expect(checkPinRequest({ featureOn: false, offer, amountPaise: 20000, message: "hi" })).toMatch(/not offering/);
    expect(checkPinRequest({ featureOn: true, offer: null, amountPaise: 20000, message: "hi" })).toMatch(/not offering/);
    expect(checkPinRequest({ featureOn: true, offer, amountPaise: 19999, message: "hi" })).toMatch(/₹200/);
    expect(checkPinRequest({ featureOn: true, offer, amountPaise: 20000, message: "  " })).toMatch(/message/);
    expect(checkPinRequest({ featureOn: true, offer, amountPaise: 20000, message: null })).toMatch(/message/);
  });

  test("a pin is a column on the tip, and a plain tip sets none", () => {
    expect(tipExtraColumns({ soundId: null, voice: false, pin: true })).toEqual({ highlight: true });
    expect(tipExtraColumns({ soundId: null, voice: false })).toEqual({});
    expect(tipExtraColumns({ soundId: null, voice: false, pin: false })).toEqual({});
  });

  test("the feature is built and only on when the owner ticks it", () => {
    expect(planFeatures(null).highlightedMessages).toBe(false);
    expect(planFeatures({ paid_features: ["highlightedMessages"] }).highlightedMessages).toBe(true);
  });
});

test.describe("what the overlay may draw", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  const row = (o: Partial<Parameters<typeof resolvePinned>[0] & object> = {}) => ({
    id: 5,
    fan_name: "Riya",
    fan_message: "Great stream!",
    gross_amount_minor: "25000",
    status: "captured",
    message_status: "approved",
    highlight_until: new Date(now.getTime() + 20_000),
    ...o,
  });

  test("an approved message inside its time shows, with the seconds left", () => {
    expect(resolvePinned(row(), [], now)).toEqual({ id: 5, name: "Riya", amountPaise: 25000, message: "Great stream!", secondsLeft: 20 });
  });

  test("nothing shows when it is over, not approved, not captured or empty", () => {
    expect(resolvePinned(row({ highlight_until: new Date(now.getTime() - 1) }), [], now)).toBeNull();
    expect(resolvePinned(row({ highlight_until: null }), [], now)).toBeNull();
    expect(resolvePinned(row({ message_status: "pending" }), [], now)).toBeNull();
    expect(resolvePinned(row({ message_status: "rejected" }), [], now)).toBeNull();
    expect(resolvePinned(row({ status: "refunded" }), [], now)).toBeNull();
    expect(resolvePinned(row({ fan_message: "   " }), [], now)).toBeNull();
    expect(resolvePinned(null, [], now)).toBeNull();
  });

  test("a banned word added after payment hides the message, and a banned name becomes Anonymous", () => {
    expect(resolvePinned(row({ fan_message: "you are a spoon" }), ["spoon"], now)).toBeNull();
    expect(resolvePinned(row({ fan_name: "Spoon King" }), ["spoon"], now)?.name).toBe("Anonymous");
    expect(resolvePinned(row({ fan_name: null }), [], now)?.name).toBe("Anonymous");
  });
});

test.describe("approval is always needed", () => {
  const at = new Date("2026-11-01T10:00:00Z");
  const tipRow = (o: Partial<TipRow> = {}): TipRow => ({
    id: 1,
    fan_name: "Riya",
    fan_message: "Great stream!",
    gross_amount_minor: 25000,
    message_status: "pending",
    captured_at: new Date(at.getTime() - 1000),
    message_decided_at: null,
    alert_shown_at: null,
    message_shown_at: null,
    ...o,
  });

  test("a plain instant tip still plays with its message at once", () => {
    expect(pickNext("instant", [tipRow()], at)).toEqual({ id: 1, kind: "alert", withMessage: true });
  });

  test("an instant tip with a pin plays without its message until the creator approves it", () => {
    expect(pickNext("instant", [tipRow({ highlight: true })], at)).toEqual({ id: 1, kind: "alert", withMessage: false });
    // After the alert, the message follows only once approved.
    const shown = tipRow({ highlight: true, alert_shown_at: new Date(at.getTime() - 500) });
    expect(pickNext("instant", [shown], at)).toBeNull();
    const approved = tipRow({
      highlight: true,
      message_status: "approved",
      message_decided_at: new Date(at.getTime() - 200),
      alert_shown_at: new Date(at.getTime() - 500),
    });
    expect(pickNext("instant", [approved], at)).toEqual({ id: 1, kind: "message", withMessage: true });
  });

  test("split and approve modes behave as before for a pinned tip", () => {
    expect(pickNext("split", [tipRow({ highlight: true })], at)).toEqual({ id: 1, kind: "alert", withMessage: false });
    expect(pickNext("approve", [tipRow({ highlight: true })], at)).toBeNull();
  });

  test("the thank-you line never promises a pinned message before approval", () => {
    expect(tipThanksLine(false, "hi", "instant", true)).toMatch(/once they approve/);
    expect(tipThanksLine(false, "hi", "split", true)).toMatch(/once they approve/);
    expect(tipThanksLine(false, "hi", "approve", true)).toMatch(/once they approve/);
    // Without a pin, instant mode still says it shows at once.
    expect(tipThanksLine(false, "hi", "instant")).toBe("They'll see your message on stream.");
  });
});

test.describe("pinning against the real schema", () => {
  let pg: PGlite;
  test.beforeAll(async () => {
    pg = await freshDatabase();
  });

  test("the migration refuses a minimum under the site minimum and a time out of range", async () => {
    const c = await creator(pg);
    await expect(pg.query(`update users set highlight_min_paise = 1999 where id = $1`, [c])).rejects.toThrow();
    await expect(pg.query(`update users set highlight_seconds = 9 where id = $1`, [c])).rejects.toThrow();
    await expect(pg.query(`update users set highlight_seconds = 121 where id = $1`, [c])).rejects.toThrow();
  });

  test("approving a tip that asked for a pin starts its time; nothing starts before that", async () => {
    const c = await creator(pg, { seconds: 45 });
    const t = await tip(pg, c, { messageStatus: "pending" });
    expect(await until(pg, t)).toBeNull();
    // Not approved yet: no pin.
    expect(await pinApprovedTip(asLedgerDb(pg), c, t)).toBe(false);
    await pg.query(`update tip_orders set message_status = 'approved', message_decided_at = now() where id = $1`, [t]);
    expect(await pinApprovedTip(asLedgerDb(pg), c, t)).toBe(true);
    const secs = Number(await until(pg, t));
    expect(secs).toBeGreaterThan(40);
    expect(secs).toBeLessThanOrEqual(45);
    const shown = await loadPinned(asLedgerDb(pg), c, []);
    expect(shown?.id).toBe(t);
    expect(shown?.message).toBe("Great stream!");
  });

  test("a tip that did not ask for a pin, or another creator's, is never pinned", async () => {
    const c = await creator(pg);
    const other = await creator(pg);
    const plain = await tip(pg, c, { highlight: false });
    const theirs = await tip(pg, other);
    expect(await pinApprovedTip(asLedgerDb(pg), c, plain)).toBe(false);
    expect(await pinApprovedTip(asLedgerDb(pg), c, theirs)).toBe(false);
    expect(await until(pg, plain)).toBeNull();
    expect(await until(pg, theirs)).toBeNull();
  });

  test("with the switch off nothing pins and nothing shows", async () => {
    const c = await creator(pg, { features: [] });
    const t = await tip(pg, c);
    expect(await pinApprovedTip(asLedgerDb(pg), c, t)).toBe(false);
    expect((await unpinAll(asLedgerDb(pg), c)).ok).toBe(false);
    expect((await pinAgain(asLedgerDb(pg), c, t)).ok).toBe(false);
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
    // A pin made while it was on stops showing the moment it is switched off.
    const d = await creator(pg);
    const t2 = await tip(pg, d);
    await pinApprovedTip(asLedgerDb(pg), d, t2);
    expect(await loadPinned(asLedgerDb(pg), d, [])).not.toBeNull();
    await pg.query(`update users set paid_features = '{}' where id = $1`, [d]);
    expect(await loadPinned(asLedgerDb(pg), d, [])).toBeNull();
  });

  test("a newer message replaces the older one, which never comes back", async () => {
    const c = await creator(pg, { seconds: 60 });
    const a = await tip(pg, c, { message: "first" });
    const b = await tip(pg, c, { message: "second" });
    await pinApprovedTip(asLedgerDb(pg), c, a);
    expect((await loadPinned(asLedgerDb(pg), c, []))?.message).toBe("first");
    await pinApprovedTip(asLedgerDb(pg), c, b);
    expect((await loadPinned(asLedgerDb(pg), c, []))?.message).toBe("second");
    // The old one was ended at once, not left running behind the new one.
    expect(Number(await until(pg, a))).toBeLessThanOrEqual(0);
    // Taking the newest down must not reveal the older one.
    await unpinAll(asLedgerDb(pg), c);
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
  });

  test("unpin ends everything pinned now and nothing brings it back on its own", async () => {
    const c = await creator(pg, { seconds: 120 });
    const t = await tip(pg, c);
    await pinApprovedTip(asLedgerDb(pg), c, t);
    const res = await unpinAll(asLedgerDb(pg), c);
    expect(res).toEqual({ ok: true, count: 1 });
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
    // A second press finds nothing and says so, without error.
    expect(await unpinAll(asLedgerDb(pg), c)).toEqual({ ok: true, count: 0 });
    // The tip itself is untouched: still captured, still approved (it stays final).
    const [row] = (await pg.query<{ status: string; message_status: string }>(`select status, message_status from tip_orders where id = $1`, [t])).rows;
    expect(row).toEqual({ status: "captured", message_status: "approved" });
    // Re-approving a decided message does nothing (the dashboard only decides pending ones).
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
  });

  test("only the creator who owns the tip can unpin or pin it again", async () => {
    const c = await creator(pg);
    const other = await creator(pg);
    const t = await tip(pg, c);
    await pinApprovedTip(asLedgerDb(pg), c, t);
    // Another creator's unpin touches only their own tips.
    expect(await unpinAll(asLedgerDb(pg), other)).toEqual({ ok: true, count: 0 });
    expect(await loadPinned(asLedgerDb(pg), c, [])).not.toBeNull();
    await unpinAll(asLedgerDb(pg), c);
    const res = await pinAgain(asLedgerDb(pg), other, t);
    expect(res.ok).toBe(false);
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
  });

  test("pin again works within a day for an approved message, and not otherwise", async () => {
    const c = await creator(pg, { seconds: 30 });
    const t = await tip(pg, c);
    await pinApprovedTip(asLedgerDb(pg), c, t);
    await unpinAll(asLedgerDb(pg), c);
    expect((await pinAgain(asLedgerDb(pg), c, t)).ok).toBe(true);
    expect((await loadPinned(asLedgerDb(pg), c, []))?.id).toBe(t);

    const old = await tip(pg, c, { hoursAgo: 30 });
    expect((await pinAgain(asLedgerDb(pg), c, old)).ok).toBe(false);
    const pending = await tip(pg, c, { messageStatus: "pending" });
    expect((await pinAgain(asLedgerDb(pg), c, pending)).ok).toBe(false);
    const rejected = await tip(pg, c, { messageStatus: "rejected" });
    expect((await pinAgain(asLedgerDb(pg), c, rejected)).ok).toBe(false);
    const refunded = await tip(pg, c, { status: "refunded" });
    expect((await pinAgain(asLedgerDb(pg), c, refunded)).ok).toBe(false);
    const plain = await tip(pg, c, { highlight: false });
    expect((await pinAgain(asLedgerDb(pg), c, plain)).ok).toBe(false);
  });

  test("a refunded or charged-back tip stops showing even while its time runs", async () => {
    const c = await creator(pg, { seconds: 120 });
    const t = await tip(pg, c);
    await pinApprovedTip(asLedgerDb(pg), c, t);
    expect(await loadPinned(asLedgerDb(pg), c, [])).not.toBeNull();
    await pg.query(`update tip_orders set status = 'refunded' where id = $1`, [t]);
    expect(await loadPinned(asLedgerDb(pg), c, [])).toBeNull();
  });

  test("a banned word the creator adds later keeps a pinned message off the card", async () => {
    const c = await creator(pg, { seconds: 120 });
    const t = await tip(pg, c, { message: "visit my spoon shop" });
    await pinApprovedTip(asLedgerDb(pg), c, t);
    expect(await loadPinned(asLedgerDb(pg), c, [])).not.toBeNull();
    expect(await loadPinned(asLedgerDb(pg), c, ["spoon"])).toBeNull();
  });

  test("the dashboard list shows live, ended and waiting messages and hides rejected ones", async () => {
    const c = await creator(pg, { seconds: 120 });
    const live = await tip(pg, c, { message: "live one" });
    await pinApprovedTip(asLedgerDb(pg), c, live);
    const ended = await tip(pg, c, { message: "ended one" });
    await pinApprovedTip(asLedgerDb(pg), c, ended);
    // `ended` replaced `live`; pin `live` back by hand to test both states side by side.
    await pg.query(`update tip_orders set highlight_until = now() + interval '50 seconds' where id = $1`, [live]);
    await pg.query(`update tip_orders set highlight_until = now() - interval '1 second' where id = $1`, [ended]);
    const waiting = await tip(pg, c, { message: "waiting one", messageStatus: "pending" });
    await tip(pg, c, { message: "rejected one", messageStatus: "rejected" });
    await tip(pg, c, { message: "no pin asked", highlight: false });
    const items = await loadPinnedPanel(asLedgerDb(pg), c);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(items).toHaveLength(3);
    expect(byId.get(live)?.state).toBe("live");
    expect(byId.get(live)?.secondsLeft).toBeGreaterThan(40);
    expect(byId.get(ended)?.state).toBe("ended");
    expect(byId.get(waiting)?.state).toBe("waiting");
  });
});
