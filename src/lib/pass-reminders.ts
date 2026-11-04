import type { LedgerDb } from "./accrual";
import { istMoment, REMIND_DAYS } from "./plan-view";
import { PLAN_NAMES, type PlanKey } from "./pricing";

// The reminder a creator gets REMIND_DAYS days before a plan's pass ends, once per end date and
// plan (a creator holding both plans gets one for each, except that a Starter end that a longer
// Creator pass covers changes nothing, so it gets none). No site
// imports and no `server-only`: the sender is passed in, so the tests run it against an in-memory
// Postgres with a pretend sender.
//
// Once per end date: users.<plan>_reminded_until holds the end date the last reminder was for.
// Buying another term moves the end date, so the next reminder comes before the new end. The row is
// claimed before the send (so two runs cannot both send) and given back when the send did not
// happen (so tomorrow's run tries again, for as long as the window lasts).

export type SendResult = "sent" | "off" | "failed";

export interface ReminderTarget {
  name: string | null;
  email: string;
  plan: PlanKey;
  endsAt: Date;
}

// Plain text. The subject holds only our own words and a date; the name goes in the body.
export function buildReminder(t: ReminderTarget, siteUrl: string): { subject: string; text: string } {
  const first = (t.name ?? "").replace(/[^\p{L}\p{N} .'-]/gu, " ").trim().split(/\s+/)[0]?.slice(0, 30) || "there";
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(t.endsAt);
  return {
    subject: `Your Freetip ${PLAN_NAMES[t.plan]} plan ends on ${day}`,
    text: [
      `Hi ${first},`,
      "",
      `Your Freetip ${PLAN_NAMES[t.plan]} plan ends on ${istMoment(t.endsAt)}. After that its paid features switch off, and your tips, alerts and everything else that is free carry on as before.`,
      "",
      `To keep them, buy another term here: ${siteUrl}/dashboard/plans`,
      `A new term of the ${PLAN_NAMES[t.plan]} plan starts when this one ends, so you lose no days. Nothing is charged unless you pay yourself; there is no automatic renewal.`,
      "",
      "Freetip",
    ].join("\n"),
  };
}

export interface ReminderResult {
  looked: number;
  sent: number;
  failed: number;
  // The sender is not set up: nothing was claimed and the run stopped.
  off: boolean;
}

export async function sendPassReminders(
  db: LedgerDb,
  send: (t: ReminderTarget) => Promise<SendResult>,
  opts: { now?: Date; limit?: number } = {},
): Promise<ReminderResult> {
  const now = (opts.now ?? new Date()).toISOString();
  const rows = await db<{ id: string; email: string; name: string | null; plan: string; until: string }[]>`
    select id::text, email, name, plan, until::text from (
      select id, email, name, creator_status, 'starter' as plan, starter_until as until,
             starter_reminded_until as reminded, creator_until as other_until from users
      union all
      select id, email, name, creator_status, 'creator' as plan, creator_until as until,
             creator_reminded_until as reminded, null::timestamptz as other_until from users
    ) t
     where until is not null
       and until > ${now}::timestamptz
       and until <= ${now}::timestamptz + make_interval(days => ${REMIND_DAYS}::int)
       and reminded is distinct from until
       and creator_status = 'active'
       -- A Starter end that a Creator pass runs past changes nothing for the creator.
       and not (plan = 'starter' and other_until is not null and other_until >= until)
     order by until limit ${opts.limit ?? 100}
  `;
  const out: ReminderResult = { looked: rows.length, sent: 0, failed: 0, off: false };
  for (const row of rows) {
    const plan: PlanKey = row.plan === "starter" ? "starter" : "creator";
    // Compared as text so the full precision of the stored moment is kept.
    const claimed = await claim(db, plan, Number(row.id), row.until);
    if (!claimed) continue;
    let result: SendResult = "failed";
    try {
      result = await send({ name: row.name, email: row.email, plan, endsAt: new Date(row.until) });
    } catch (err) {
      console.error("Pass reminder could not be sent:", err instanceof Error ? err.message : err);
    }
    if (result === "sent") {
      out.sent += 1;
      continue;
    }
    // Not sent: give the claim back so a later run tries again.
    await release(db, plan, Number(row.id), row.until);
    if (result === "off") {
      out.off = true;
      break;
    }
    out.failed += 1;
  }
  return out;
}

// Marks the reminder for this end date as taken, and says whether this run got it (two runs cannot
// both send). One branch per plan: a column name cannot be a query parameter. The end date is
// compared as text: a timestamp parameter is cut to whole milliseconds by the driver, so a date
// written by hand with finer digits would never match and its reminder would be skipped silently.
async function claim(db: LedgerDb, plan: PlanKey, id: number, until: string): Promise<boolean> {
  const rows =
    plan === "starter"
      ? await db<{ id: string }[]>`
          update users set starter_reminded_until = starter_until
           where id = ${id} and starter_until::text = ${until}::text and starter_reminded_until is distinct from starter_until
          returning id::text`
      : await db<{ id: string }[]>`
          update users set creator_reminded_until = creator_until
           where id = ${id} and creator_until::text = ${until}::text and creator_reminded_until is distinct from creator_until
          returning id::text`;
  return rows.length > 0;
}

async function release(db: LedgerDb, plan: PlanKey, id: number, until: string): Promise<void> {
  if (plan === "starter") {
    await db`
      update users set starter_reminded_until = null
       where id = ${id} and starter_until::text = ${until}::text and starter_reminded_until = starter_until`;
  } else {
    await db`
      update users set creator_reminded_until = null
       where id = ${id} and creator_until::text = ${until}::text and creator_reminded_until = creator_until`;
  }
}
