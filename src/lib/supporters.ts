import type { Query } from "./accrual";
import { findBlockedWord, parseBannedWords } from "./message-filter";

// What the three supporter overlays show: the support streak, the top supporter of the
// last 30 days and the recent supporters. Built from captured tips only. A fan who
// tipped anonymously, left no name or used one of the creator's banned words is shown as
// "Anonymous" (and cannot be the top supporter), and a message is never shown.
// No site imports and no `server-only`, so the tests can run it against an in-memory Postgres.

export const STREAK_WINDOW_SECONDS = 10 * 60;
export const TOP_DAYS = 30;
export const RECENT_COUNT = 10;
const LOOKBACK_TIPS = 80;

export type Streak = { count: number; remainingSeconds: number; windowSeconds: number };
export type TopSupporter = { name: string; totalPaise: number };
export type RecentSupporter = { name: string; amountPaise: number };
export type Supporters = { streak: Streak; top: TopSupporter | null; recent: RecentSupporter[] };

type TipRow = { fan_name: string | null; anonymous: boolean; amount: string; at: Date };

const ANONYMOUS = "Anonymous";

function shownName(row: { fan_name: string | null; anonymous: boolean }, banned: string[]): string | null {
  const name = row.fan_name?.replace(/\s+/g, " ").trim();
  if (row.anonymous || !name) return null;
  if (findBlockedWord(name, banned)) return null;
  return name.slice(0, 40);
}

// Tips that follow each other within the window make one streak. It counts while the
// newest tip is still inside the window and drops to zero once the countdown ends.
export function streakFrom(tipTimes: Date[], now: Date, windowSeconds = STREAK_WINDOW_SECONDS): Streak {
  const times = [...tipTimes].sort((a, b) => b.getTime() - a.getTime());
  const none = { count: 0, remainingSeconds: 0, windowSeconds };
  if (times.length === 0) return none;
  const remaining = windowSeconds - (now.getTime() - times[0].getTime()) / 1000;
  if (remaining <= 0) return none;
  let count = 1;
  for (let i = 1; i < times.length; i++) {
    if ((times[i - 1].getTime() - times[i].getTime()) / 1000 > windowSeconds) break;
    count++;
  }
  return { count, remainingSeconds: Math.ceil(remaining), windowSeconds };
}

export async function loadSupporters(
  db: Query,
  creatorId: number,
  bannedWordsRaw: string | null,
  which: { streak: boolean; top: boolean; recent: boolean },
  now = new Date(),
): Promise<Partial<Supporters>> {
  const banned = parseBannedWords(bannedWordsRaw);
  const out: Partial<Supporters> = {};

  if (which.streak || which.recent) {
    const tips = await db<TipRow[]>`
      select fan_name, anonymous, gross_amount_minor::text as amount, captured_at as at
        from tip_orders
       where creator_id = ${creatorId}::bigint and status = 'captured' and captured_at is not null
       order by captured_at desc
       limit ${LOOKBACK_TIPS}
    `;
    if (which.streak) out.streak = streakFrom(tips.map((t) => new Date(t.at)), now);
    if (which.recent) {
      // One line per named supporter (their latest tip); anonymous tips stay separate lines.
      const seen = new Set<string>();
      const recent: RecentSupporter[] = [];
      for (const t of tips) {
        const name = shownName(t, banned);
        if (name) {
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
        }
        recent.push({ name: name ?? ANONYMOUS, amountPaise: Number(t.amount) });
        if (recent.length >= RECENT_COUNT) break;
      }
      out.recent = recent;
    }
  }

  if (which.top) {
    const since = new Date(now.getTime() - TOP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db<{ fan_name: string; total: string }[]>`
      select max(fan_name) as fan_name, sum(gross_amount_minor)::text as total
        from tip_orders
       where creator_id = ${creatorId}::bigint and status = 'captured' and not anonymous
         and fan_name is not null and btrim(fan_name) <> ''
         and captured_at >= ${since}::timestamptz
       group by lower(btrim(fan_name))
       order by sum(gross_amount_minor) desc
       limit 20
    `;
    // The list is cut at 20 so a banned name at the top does not leave the board empty.
    const best = rows.find((r) => shownName({ fan_name: r.fan_name, anonymous: false }, banned));
    out.top = best ? { name: shownName({ fan_name: best.fan_name, anonymous: false }, banned)!, totalPaise: Number(best.total) } : null;
  }

  return out;
}
