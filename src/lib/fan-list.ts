import type { LedgerDb } from "./accrual";
import { csvCell, formatIst } from "./earnings";
import { levelFor } from "./fan-levels";

// The creator's fan list (fan list feature): who they have, sorted and searched, one
// download, and nothing about anyone who tipped without a name. Names only; there is no
// way to know who a fan really is.

export const FAN_SORTS = ["recent", "total", "level", "tips", "name"] as const;
export type FanSort = (typeof FAN_SORTS)[number];

export const FAN_SORT_LABELS: Record<FanSort, string> = {
  recent: "Latest tip",
  total: "Biggest total",
  level: "Highest level",
  tips: "Most tips",
  name: "Name",
};

export const FAN_LIST_LIMIT = 200;

export interface FansQuery {
  q: string;
  sort: FanSort;
}

export function parseFansQuery(params: Record<string, string | string[] | undefined>): FansQuery {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const sort = one(params.sort);
  return {
    q: one(params.q).trim().slice(0, 50),
    sort: (FAN_SORTS as readonly string[]).includes(sort) ? (sort as FanSort) : "recent",
  };
}

export interface FanRow {
  key: string;
  name: string;
  tips: number;
  totalPaise: number;
  xp: number;
  level: number;
  birthday: string | null; // "MM-DD"
  note: string | null;
  firstAt: Date;
  lastAt: Date;
}

export function sortFans(fans: FanRow[], sort: FanSort): FanRow[] {
  const byRecent = (a: FanRow, b: FanRow) => b.lastAt.getTime() - a.lastAt.getTime();
  const compare: Record<FanSort, (a: FanRow, b: FanRow) => number> = {
    recent: byRecent,
    total: (a, b) => b.totalPaise - a.totalPaise || byRecent(a, b),
    level: (a, b) => b.xp - a.xp || byRecent(a, b),
    tips: (a, b) => b.tips - a.tips || byRecent(a, b),
    name: (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || byRecent(a, b),
  };
  return [...fans].sort(compare[sort]);
}

// Most fans one list or download covers; a creator with more sees the newest.
export const FAN_READ_LIMIT = 10000;

// Every fan matching the search (newest first up to the read limit), sorted. The page shows
// the first FAN_LIST_LIMIT; the download takes them all.
export async function loadFans(db: LedgerDb, creatorId: number, query: FansQuery): Promise<{ fans: FanRow[]; total: number }> {
  // % and _ typed in the box are searched for literally.
  const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db<
    {
      fan_key: string;
      display_name: string;
      tips: number;
      total_paise: string;
      xp: string;
      birthday_md: string | null;
      note: string | null;
      first_at: Date;
      last_at: Date;
    }[]
  >`
    select fan_key, display_name, tips, total_paise::text, xp::text, birthday_md, note, first_at, last_at
      from fan_profiles
     where creator_id = ${creatorId}::bigint
       and (${query.q}::text = '' or display_name ilike ${like}::text)
     order by last_at desc
     limit ${FAN_READ_LIMIT}
  `;
  const fans = rows.map((r) => ({
    key: r.fan_key,
    name: r.display_name,
    tips: r.tips,
    totalPaise: Number(r.total_paise),
    xp: Number(r.xp),
    level: levelFor(Number(r.xp)),
    birthday: r.birthday_md,
    note: r.note,
    firstAt: new Date(r.first_at),
    lastAt: new Date(r.last_at),
  }));
  return { fans: sortFans(fans, query.sort), total: fans.length };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "14 Mar" from "03-14"; empty for none.
export function birthdayLabel(md: string | null): string {
  const m = md?.match(/^(\d\d)-(\d\d)$/);
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1] ?? ""}`.trim() : "";
}

export function fansCsv(fans: FanRow[]): string {
  const rows = [["Name", "Level", "Points", "Tips", "Total (INR)", "First tip (IST)", "Latest tip (IST)", "Birthday", "Note"]];
  for (const f of fans) {
    rows.push([
      f.name,
      String(f.level),
      String(f.xp),
      String(f.tips),
      (f.totalPaise / 100).toFixed(2),
      formatIst(f.firstAt),
      formatIst(f.lastAt),
      birthdayLabel(f.birthday),
      f.note ?? "",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
