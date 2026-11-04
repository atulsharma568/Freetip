import type { LedgerDb } from "./accrual";
import { istMoment, REMIND_DAYS } from "./plan-view";

// The reminder a creator gets REMIND_DAYS days before a pass ends, once per end date. No site
// imports and no `server-only`: the sender is passed in, so the tests run it against an in-memory
// Postgres with a pretend sender.
//
// Once per end date: users.pass_reminded_until holds the end date the last reminder was for. Buying
// another term moves the end date, so the next reminder comes before the new end. The row is
// claimed before the send (so two runs cannot both send) and given back when the send did not
// happen (so tomorrow's run tries again, for as long as the window lasts).

export type SendResult = "sent" | "off" | "failed";

export interface ReminderTarget {
  name: string | null;
  email: string;
  endsAt: Date;
}

// Plain text. The subject holds only our own words and a date; the name goes in the body.
export function buildReminder(t: ReminderTarget, siteUrl: string): { subject: string; text: string } {
  const first = (t.name ?? "").replace(/[^\p{L}\p{N} .'-]/gu, " ").trim().split(/\s+/)[0]?.slice(0, 30) || "there";
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(t.endsAt);
  return {
    subject: `Your Freetip paid features end on ${day}`,
    text: [
      `Hi ${first},`,
      "",
      `Your Freetip paid features end on ${istMoment(t.endsAt)}. After that they switch off, and your tips, alerts and everything else that is free carry on as before.`,
      "",
      `To keep them, buy another term here: ${siteUrl}/dashboard/plans`,
      "A new term starts when this one ends, so you lose no days. Nothing is charged unless you pay yourself; there is no automatic renewal.",
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
  const rows = await db<{ id: string; email: string; name: string | null; pass_until: string }[]>`
    select id::text, email, name, pass_until::text
      from users
     where pass_until is not null
       and pass_until > ${now}::timestamptz
       and pass_until <= ${now}::timestamptz + make_interval(days => ${REMIND_DAYS}::int)
       and pass_reminded_until is distinct from pass_until
       and creator_status = 'active'
     order by pass_until limit ${opts.limit ?? 100}
  `;
  const out: ReminderResult = { looked: rows.length, sent: 0, failed: 0, off: false };
  for (const row of rows) {
    // Compared as text so the full precision of the stored moment is kept.
    const claimed = await db<{ id: string }[]>`
      update users set pass_reminded_until = pass_until
       where id = ${Number(row.id)} and pass_until = ${row.pass_until}::timestamptz and pass_reminded_until is distinct from pass_until
      returning id::text
    `;
    if (!claimed.length) continue;
    let result: SendResult = "failed";
    try {
      result = await send({ name: row.name, email: row.email, endsAt: new Date(row.pass_until) });
    } catch (err) {
      console.error("Pass reminder could not be sent:", err instanceof Error ? err.message : err);
    }
    if (result === "sent") {
      out.sent += 1;
      continue;
    }
    // Not sent: give the claim back so a later run tries again.
    await db`
      update users set pass_reminded_until = null
       where id = ${Number(row.id)} and pass_until = ${row.pass_until}::timestamptz and pass_reminded_until = pass_until
    `;
    if (result === "off") {
      out.off = true;
      break;
    }
    out.failed += 1;
  }
  return out;
}
