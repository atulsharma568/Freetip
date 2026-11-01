import { expect, test } from "@playwright/test";
import type { PGlite } from "@electric-sql/pglite";
import { levelAfterTip, levelFor, levelStartXp, xpForTip, MAX_LEVEL } from "../src/lib/fan-levels";
import { deleteFan, eraseFans, fanKey, normaliseFanName, postFanXp, reverseFanXp } from "../src/lib/fan-profiles";
import { fansCsv, loadFans, parseFansQuery, sortFans, birthdayLabel, type FanRow } from "../src/lib/fan-list";
import { BIRTHDAY_TEMPLATE_MAX, istMonthDay, parseBirthday, renderBirthdayMessage, resolveBirthday } from "../src/lib/birthday";
import { loadAlertExtras, resolveAlertExtras, type Sql } from "../src/lib/alert-extras";
import { planFeatures } from "../src/lib/plans";
import { purgeOldFanProfiles, purgeOldTipText } from "../src/lib/retention";
import { closeCreatorAccount } from "../src/lib/account-close";
import { tipExtraColumns } from "../src/lib/tip-extras";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// Fan identity (phase 3): levels, the name-only profile, the fan list and the birthday
// message, against the real schema in memory.

const SECRET = "a-test-salt-that-is-long-enough";
let seq = 0;

async function creator(pg: PGlite, features: string[] = ["fanLevels"], birthdayMessage: string | null = null) {
  seq += 1;
  const r = await pg.query<{ id: string }>(
    `insert into users (google_id, email, handle, creator_status, paid_features, birthday_message)
     values ($1, $2, $3, 'active', $4, $5) returning id::text`,
    [`g${seq}`, `c${seq}@example.com`, `handle${seq}`, features, birthdayMessage],
  );
  return Number(r.rows[0].id);
}

async function tip(pg: PGlite, creatorId: number, o: { name?: string | null; gross?: number; anonymous?: boolean; birthday?: string | null; status?: string } = {}) {
  seq += 1;
  const gross = o.gross ?? 10000;
  const t = await pg.query<{ id: string }>(
    `insert into tip_orders (creator_id, public_reference, gross_amount_minor, fan_name, anonymous, birthday_md, status, captured_at)
     values ($1, $2, $3, $4, $5, $6, $7, now()) returning id::text`,
    [creatorId, `tip_${seq}`, gross, "name" in o ? o.name : "Riya", o.anonymous ?? false, o.birthday ?? null, o.status ?? "captured"],
  );
  const ref = `pay_${seq}`;
  await pg.query(
    `insert into payment_attempts (tip_order_id, provider, provider_order_ref, provider_payment_ref, provider_status, amount_minor, idempotency_key, livemode)
     values ($1, 'razorpay', $2, $3, 'captured', $4, $5, true)`,
    [t.rows[0].id, `order_${seq}`, ref, gross, `tip_${seq}`],
  );
  return { tipId: Number(t.rows[0].id), ref };
}

const one = async <T extends object>(pg: PGlite, sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows;

test.describe("levels", () => {
  test("1 point per whole rupee", () => {
    expect(xpForTip(10000)).toBe(100);
    expect(xpForTip(9950)).toBe(99);
    expect(xpForTip(99)).toBe(0);
    expect(xpForTip(-5)).toBe(0);
  });

  test("the level steps are 100 more each time, and stop at the maximum", () => {
    expect(levelStartXp(1)).toBe(0);
    expect(levelStartXp(2)).toBe(100);
    expect(levelStartXp(3)).toBe(300);
    expect(levelStartXp(4)).toBe(600);
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(299)).toBe(2);
    expect(levelFor(300)).toBe(3);
    expect(levelFor(1e12)).toBe(MAX_LEVEL);
  });

  test("a tip that crosses a step says so", () => {
    expect(levelAfterTip(150, 150)).toEqual({ level: 2, up: true });
    expect(levelAfterTip(150, 20)).toEqual({ level: 2, up: false });
    expect(levelAfterTip(90, 90)).toEqual({ level: 1, up: false });
  });
});

test.describe("names and keys", () => {
  test("the same name matches however it is spaced or cased, but not across creators", () => {
    expect(normaliseFanName("  Riya   Sharma ")).toBe("riya sharma");
    expect(normaliseFanName(null)).toBe("");
    expect(fanKey(SECRET, 1, "Riya")).toBe(fanKey(SECRET, 1, " riya "));
    expect(fanKey(SECRET, 1, "Riya")).not.toBe(fanKey(SECRET, 2, "Riya"));
    expect(fanKey(SECRET, 1, "Riya")).not.toBe(fanKey("another-salt-that-is-long", 1, "Riya"));
    expect(fanKey(SECRET, 1, "Riya")).toMatch(/^[0-9a-f]{64}$/);
  });
});

test.describe("counting a captured tip", () => {
  test("a named tip makes a profile, a second one adds to it, a repeat adds nothing", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await tip(pg, c, { gross: 25000 });
    expect(await postFanXp(db, a.ref, SECRET)).toEqual({ status: "counted", xp: 250 });
    expect(await postFanXp(db, a.ref, SECRET)).toEqual({ status: "already" });
    const b = await tip(pg, c, { name: " riya ", gross: 5000 });
    await postFanXp(db, b.ref, SECRET);

    const rows = await one<{ display_name: string; tips: number; total_paise: string; xp: string }>(
      pg, `select display_name, tips, total_paise::text, xp::text from fan_profiles`);
    expect(rows).toEqual([{ display_name: "riya", tips: 2, total_paise: "30000", xp: "300" }]);
  });

  test("anonymous, nameless, unconfirmed and switched-off tips make no profile", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    expect((await postFanXp(db, (await tip(pg, c, { anonymous: true })).ref, SECRET))).toEqual({ status: "skipped", reason: "no_name" });
    expect((await postFanXp(db, (await tip(pg, c, { name: null })).ref, SECRET))).toEqual({ status: "skipped", reason: "no_name" });
    expect((await postFanXp(db, (await tip(pg, c, { name: "   " })).ref, SECRET))).toEqual({ status: "skipped", reason: "no_name" });
    expect((await postFanXp(db, (await tip(pg, c, { status: "payment_pending" })).ref, SECRET))).toEqual({ status: "skipped", reason: "not_captured" });
    const off = await creator(pg, []);
    expect((await postFanXp(db, (await tip(pg, off)).ref, SECRET))).toEqual({ status: "skipped", reason: "feature_off" });
    expect((await postFanXp(db, (await tip(pg, c)).ref, undefined))).toEqual({ status: "skipped", reason: "no_secret" });
    expect((await postFanXp(db, (await tip(pg, c)).ref, "short"))).toEqual({ status: "skipped", reason: "no_secret" });
    expect((await postFanXp(db, "pay_missing", SECRET))).toEqual({ status: "skipped", reason: "no_such_payment" });
    expect(await one(pg, `select 1 from fan_profiles`)).toHaveLength(0);
  });

  test("either the levels or the fan list switch is enough; the same name on two creators is two fans", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const crm = await creator(pg, ["fanCrm"]);
    const levels = await creator(pg, ["fanLevels"]);
    await postFanXp(db, (await tip(pg, crm)).ref, SECRET);
    await postFanXp(db, (await tip(pg, levels)).ref, SECRET);
    const rows = await one<{ creator_id: string; fan_key: string }>(pg, `select creator_id::text, fan_key from fan_profiles`);
    expect(rows).toHaveLength(2);
    expect(rows[0].fan_key).not.toBe(rows[1].fan_key);
  });

  test("a birthday on the tip lands on the profile and a later tip without one keeps it", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await postFanXp(db, (await tip(pg, c, { birthday: "03-14" })).ref, SECRET);
    await postFanXp(db, (await tip(pg, c)).ref, SECRET);
    expect((await one<{ birthday_md: string }>(pg, `select birthday_md from fan_profiles`))[0].birthday_md).toBe("03-14");
  });

  test("a whole payment taken back removes the points, and an empty profile goes", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await tip(pg, c, { gross: 10000 });
    const b = await tip(pg, c, { gross: 20000 });
    await postFanXp(db, a.ref, SECRET);
    await postFanXp(db, b.ref, SECRET);
    expect(await reverseFanXp(db, a.ref)).toEqual({ reversed: true });
    expect(await reverseFanXp(db, a.ref)).toEqual({ reversed: false });
    expect((await one<{ tips: number; xp: string }>(pg, `select tips, xp::text from fan_profiles`))[0]).toEqual({ tips: 1, xp: "200" });
    await reverseFanXp(db, b.ref);
    expect(await one(pg, `select 1 from fan_profiles`)).toHaveLength(0);
    // A tip that was never counted has nothing to take back.
    expect(await reverseFanXp(db, (await tip(pg, await creator(pg, []))).ref)).toEqual({ reversed: false });
  });

  test("a creator's note keeps an otherwise empty profile", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const a = await tip(pg, c);
    await postFanXp(db, a.ref, SECRET);
    await pg.query(`update fan_profiles set note = 'regular'`);
    await reverseFanXp(db, a.ref);
    expect((await one<{ tips: number }>(pg, `select tips from fan_profiles`))[0].tips).toBe(0);
  });
});

test.describe("deleting and retention", () => {
  test("a creator deletes one fan: the profile, the counted tips and the birthday on them", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const other = await creator(pg);
    await postFanXp(db, (await tip(pg, c, { birthday: "05-05" })).ref, SECRET);
    await postFanXp(db, (await tip(pg, other, { birthday: "06-06" })).ref, SECRET);
    const key = fanKey(SECRET, c, "Riya");

    // Another creator cannot delete this fan.
    expect(await deleteFan(db, other, key)).toEqual({ deleted: false });
    expect(await deleteFan(db, c, key)).toEqual({ deleted: true });
    expect(await one(pg, `select 1 from fan_profiles where creator_id = $1`, [c])).toHaveLength(0);
    expect(await one(pg, `select 1 from fan_xp_events where creator_id = $1`, [c])).toHaveLength(0);
    expect((await one<{ birthday_md: string | null }>(pg, `select birthday_md from tip_orders where creator_id = $1`, [c]))[0].birthday_md).toBeNull();
    expect(await one(pg, `select 1 from fan_profiles where creator_id = $1`, [other])).toHaveLength(1);
  });

  test("profiles with no tip for 12 months are deleted with their counted tips, active ones stay", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    await postFanXp(db, (await tip(pg, c, { name: "Old Fan" })).ref, SECRET);
    await postFanXp(db, (await tip(pg, c, { name: "New Fan" })).ref, SECRET);
    await pg.query(`update fan_profiles set last_at = now() - interval '13 months' where display_name = 'Old Fan'`);
    await pg.query(`update fan_profiles set last_at = now() - interval '11 months' where display_name = 'New Fan'`);

    expect(await purgeOldFanProfiles(db)).toEqual({ deleted: 1 });
    expect((await one<{ display_name: string }>(pg, `select display_name from fan_profiles`)).map((r) => r.display_name)).toEqual(["New Fan"]);
    expect(await one(pg, `select 1 from fan_xp_events`)).toHaveLength(1);
    expect(await one(pg, `select 1 from audit_events where action = 'fans.purged'`)).toHaveLength(1);
    expect(await purgeOldFanProfiles(db)).toEqual({ deleted: 0 });
  });

  test("the birthday on a tip goes with the name after 90 days", async () => {
    const pg = await freshDatabase();
    const c = await creator(pg);
    await tip(pg, c, { birthday: "01-02" });
    await tip(pg, c, { birthday: "03-04" });
    await pg.query(`update tip_orders set created_at = now() - interval '91 days' where birthday_md = '01-02'`);
    await purgeOldTipText(asLedgerDb(pg));
    const rows = await one<{ birthday_md: string | null; fan_name: string | null }>(pg, `select birthday_md, fan_name from tip_orders order by id`);
    expect(rows).toEqual([{ birthday_md: null, fan_name: null }, { birthday_md: "03-04", fan_name: "Riya" }]);
  });

  test("closing the account erases the profiles, the birthdays and the greeting", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, ["fanLevels", "birthdayMessage"], "Happy birthday {name}!");
    await postFanXp(db, (await tip(pg, c, { birthday: "05-05" })).ref, SECRET);
    // Nothing captured is in the books (not live ledger), so the close is allowed.
    await pg.query(`update payment_attempts set livemode = false`);
    const res = await closeCreatorAccount(db, c, { role: "creator", userId: c });
    expect(res.status).toBe("closed");
    expect(await one(pg, `select 1 from fan_profiles`)).toHaveLength(0);
    expect(await one(pg, `select 1 from fan_xp_events`)).toHaveLength(0);
    expect((await one<{ birthday_md: string | null }>(pg, `select birthday_md from tip_orders`))[0].birthday_md).toBeNull();
    expect((await one<{ birthday_message: string | null }>(pg, `select birthday_message from users where id = $1`, [c]))[0].birthday_message).toBeNull();
    expect(await eraseFans(db, c)).toBe(0);
  });
});

test.describe("the fan list", () => {
  const row = (name: string, o: Partial<FanRow> = {}): FanRow => ({
    key: name, name, tips: 1, totalPaise: 100, xp: 1, level: 1, birthday: null, note: null,
    firstAt: new Date("2026-01-01T00:00:00Z"), lastAt: new Date("2026-01-01T00:00:00Z"), ...o,
  });

  test("the query reads known sorts and falls back to latest", () => {
    expect(parseFansQuery({ sort: "total", q: " ri " })).toEqual({ sort: "total", q: "ri" });
    expect(parseFansQuery({ sort: "bogus" })).toEqual({ sort: "recent", q: "" });
    expect(parseFansQuery({ q: ["a", "b"] }).q).toBe("a");
    expect(parseFansQuery({ q: "x".repeat(80) }).q).toHaveLength(50);
  });

  test("each sort puts the right fan first", () => {
    const fans = [
      row("b", { totalPaise: 100, xp: 5, tips: 9, lastAt: new Date("2026-03-01") }),
      row("A", { totalPaise: 900, xp: 1, tips: 1, lastAt: new Date("2026-01-01") }),
      row("c", { totalPaise: 500, xp: 50, tips: 3, lastAt: new Date("2026-02-01") }),
    ];
    expect(sortFans(fans, "recent")[0].name).toBe("b");
    expect(sortFans(fans, "total")[0].name).toBe("A");
    expect(sortFans(fans, "level")[0].name).toBe("c");
    expect(sortFans(fans, "tips")[0].name).toBe("b");
    expect(sortFans(fans, "name").map((f) => f.name)).toEqual(["A", "b", "c"]);
  });

  test("the list is the creator's own, searched literally, and the CSV is safe in a spreadsheet", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg);
    const other = await creator(pg);
    await postFanXp(db, (await tip(pg, c, { name: "=SUM(1)", birthday: "03-14" })).ref, SECRET);
    await postFanXp(db, (await tip(pg, c, { name: "100%" })).ref, SECRET);
    await postFanXp(db, (await tip(pg, other, { name: "Other" })).ref, SECRET);

    expect((await loadFans(db, c, { q: "", sort: "recent" })).total).toBe(2);
    expect((await loadFans(db, c, { q: "%", sort: "recent" })).fans.map((f) => f.name)).toEqual(["100%"]);
    expect((await loadFans(db, c, { q: "zzz", sort: "recent" })).total).toBe(0);

    const csv = fansCsv((await loadFans(db, c, { q: "", sort: "name" })).fans);
    expect(csv.split("\r\n")[0]).toBe("Name,Level,Points,Tips,Total (INR),First tip (IST),Latest tip (IST),Birthday,Note");
    expect(csv).toContain("'=SUM(1)");
    expect(csv).toContain("14 Mar");
    expect(csv).not.toContain("Other");
  });

  test("birthday labels", () => {
    expect(birthdayLabel("03-14")).toBe("14 Mar");
    expect(birthdayLabel(null)).toBe("");
  });
});

test.describe("birthday message", () => {
  test("only a real day and month is kept", () => {
    expect(parseBirthday(3, 14)).toBe("03-14");
    expect(parseBirthday(2, 29)).toBe("02-29");
    for (const [m, d] of [[2, 30], [4, 31], [13, 1], [0, 1], [1, 0], [1.5, 2]] as const) expect(parseBirthday(m, d)).toBeNull();
    expect(parseBirthday("3", 14)).toBeNull();
    expect(parseBirthday(null, undefined)).toBeNull();
  });

  test("today is read in India time, whatever the server clock", () => {
    // 31 Dec 20:00 UTC is already 1 Jan in India.
    expect(istMonthDay(new Date("2026-12-31T20:00:00Z"))).toBe("01-01");
    expect(istMonthDay(new Date("2026-12-31T18:29:00Z"))).toBe("12-31");
  });

  test("the greeting is the creator's, with the fan's name, only on the day", () => {
    const o = { template: "Happy birthday, {name}!", tipBirthday: "03-14", todayMd: "03-14", name: "Riya", bannedWords: [] as string[] };
    expect(resolveBirthday(o)).toBe("Happy birthday, Riya!");
    expect(resolveBirthday({ ...o, todayMd: "03-15" })).toBeNull();
    expect(resolveBirthday({ ...o, tipBirthday: null })).toBeNull();
    expect(resolveBirthday({ ...o, template: "  " })).toBeNull();
    expect(resolveBirthday({ ...o, template: null })).toBeNull();
    expect(resolveBirthday({ ...o, name: null })).toBeNull();
    expect(resolveBirthday({ ...o, name: "   " })).toBeNull();
  });

  test("a banned word anywhere in the finished line holds it back", () => {
    const o = { template: "Happy birthday, {name}!", tipBirthday: "03-14", todayMd: "03-14", name: "Riya", bannedWords: ["riya"] };
    expect(resolveBirthday(o)).toBeNull();
    expect(resolveBirthday({ ...o, bannedWords: ["birthday"] })).toBeNull();
  });

  test("a long greeting is cut, and the name cannot lengthen it without end", () => {
    expect(renderBirthdayMessage("x".repeat(500), "n")).toHaveLength(160);
    expect(BIRTHDAY_TEMPLATE_MAX).toBe(120);
  });

  test("the tip stores the birthday only when one is given", () => {
    expect(tipExtraColumns({ soundId: null, voice: false })).toEqual({});
    expect(tipExtraColumns({ soundId: null, voice: false, birthdayMd: "03-14" })).toEqual({ birthday_md: "03-14" });
    expect(tipExtraColumns({ soundId: 3, voice: true, birthdayMd: null })).toEqual({ sound_id: 3, tts_requested: true });
  });
});

test.describe("on the alert", () => {
  const base = { voiceRequested: false, bannedWords: [] as string[], sound: null };
  const ON = planFeatures({ paid_features: ["fanLevels", "birthdayMessage"] });
  const OFF = planFeatures(null);
  const fan = { xp: 150, tipXp: 150 };
  const birthdayInfo = { template: "Happy birthday {name}", tipBirthday: "03-14", name: "Riya" };

  test("level and greeting show on the alert card while the switches are on", () => {
    const x = resolveAlertExtras({ ...base, fan, birthdayInfo }, { kind: "alert", features: ON, todayMd: "03-14" });
    expect(x.level).toEqual({ level: 2, up: true });
    expect(x.birthday).toBe("Happy birthday Riya");
  });

  test("switched off at play time, or the follow-up message card, shows neither", () => {
    expect(resolveAlertExtras({ ...base, fan, birthdayInfo }, { kind: "alert", features: OFF, todayMd: "03-14" })).toMatchObject({ level: null, birthday: null });
    expect(resolveAlertExtras({ ...base, fan, birthdayInfo }, { kind: "message", features: ON, todayMd: "03-14" })).toMatchObject({ level: null, birthday: null });
    expect(resolveAlertExtras(base, { kind: "alert", features: ON })).toMatchObject({ level: null, birthday: null });
  });

  test("the loader reads the counted points and the greeting from the database", async () => {
    const pg = await freshDatabase();
    const db = asLedgerDb(pg);
    const c = await creator(pg, ["fanLevels", "birthdayMessage"], "Happy birthday {name}");
    const t = await tip(pg, c, { gross: 30000, birthday: istMonthDay(new Date()) });
    await postFanXp(db, t.ref, SECRET);
    const sql = db as unknown as Sql;

    const x = await loadAlertExtras(sql, { tipId: t.tipId, creatorId: c, kind: "alert" });
    expect(x.level).toEqual({ level: 3, up: true });
    expect(x.birthday).toBe("Happy birthday Riya");

    // Turn the levels off after the fact: the plain card plays.
    await pg.query(`update users set paid_features = '{birthdayMessage}' where id = $1`, [c]);
    const y = await loadAlertExtras(sql, { tipId: t.tipId, creatorId: c, kind: "alert" });
    expect(y.level).toBeNull();
    expect(y.birthday).toBe("Happy birthday Riya");

    // A tip with no profile (anonymous, or before the switch) has no level.
    const lone = await tip(pg, c, { name: null });
    await pg.query(`update users set paid_features = '{fanLevels}' where id = $1`, [c]);
    expect((await loadAlertExtras(sql, { tipId: lone.tipId, creatorId: c, kind: "alert" })).level).toBeNull();
  });
});

test.describe("switches", () => {
  test("the three features are built and can be switched on", () => {
    const f = planFeatures({ paid_features: ["fanLevels", "fanCrm", "birthdayMessage"] });
    expect(f.fanLevels && f.fanCrm && f.birthdayMessage).toBe(true);
    expect(planFeatures({ paid_features: ["voiceNotes"] }).voiceNotes).toBe(false);
  });
});
