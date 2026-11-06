import "server-only";
import { getDb } from "./db";

// Real totals for the landing page, nothing else: how many creators are active, how many tips
// have been paid (captured) and how many rupees those tips add up to. Fans are anonymous, so
// there is no per-person data here. Any failure (no database, query error) returns zeros, and
// the landing page hides every number that is zero, so a down database shows nothing wrong.
export type PublicTotals = { creators: number; tips: number; rupees: number };

export async function getPublicTotals(): Promise<PublicTotals> {
  const db = getDb();
  if (!db) return { creators: 0, tips: 0, rupees: 0 };
  try {
    const [row] = await db<{ creators: string; tips: string; paise: string }[]>`
      select (select count(*) from users where creator_status = 'active')::text as creators,
             (select count(*) from tip_orders where status = 'captured')::text as tips,
             (select coalesce(sum(gross_amount_minor), 0) from tip_orders where status = 'captured')::text as paise
    `;
    return {
      creators: Number(row?.creators ?? 0),
      tips: Number(row?.tips ?? 0),
      rupees: Math.floor(Number(row?.paise ?? 0) / 100),
    };
  } catch {
    return { creators: 0, tips: 0, rupees: 0 };
  }
}
