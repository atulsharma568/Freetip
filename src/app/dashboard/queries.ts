import { getDb } from "@/lib/db";
import {
  EXPORT_MAX_ROWS,
  TIPS_PAGE_SIZE,
  estimateShare,
  type TipsQuery,
} from "@/lib/earnings";
import { RECAP_DAYS, RECAP_MAX_STREAMS, RECAP_MAX_TIPS, groupStreams, type StreamRecap } from "@/lib/stream-recap";

export type OverviewKey = "today" | "7d" | "30d" | "all";

export interface OverviewRow {
  key: OverviewKey;
  count: number;
  grossPaise: number;
  sharePaise: number;
}

// Captured tips only. "Today" starts at midnight in India; the others roll back
// from now. The share is summed per tip with the same rounding as
// `estimateShare` and at the rates each tip was charged at (saved on the order), so the strip and
// the tips list agree and a later change of rate leaves earlier tips alone.
export async function loadOverview(creatorId: number): Promise<OverviewRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db<{ key: OverviewKey; count: number; gross: string; share: string }[]>`
    with t as (
      select captured_at,
             gross_amount_minor as gross,
             gross_amount_minor
               - ((gross_amount_minor * platform_bps::bigint + 5000) / 10000)
               - ((gross_amount_minor * processing_bps::bigint + 5000) / 10000) as share
      from tip_orders
      where creator_id = ${creatorId}
        and status = 'captured'
        and captured_at is not null
    ),
    ranges as (
      select 'today' as key,
             date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as since
      union all select '7d', now() - interval '7 days'
      union all select '30d', now() - interval '30 days'
      union all select 'all', '-infinity'::timestamptz
    )
    select r.key,
           count(t.gross)::int as count,
           coalesce(sum(t.gross), 0)::text as gross,
           coalesce(sum(t.share), 0)::text as share
    from ranges r
    left join t on t.captured_at >= r.since
    group by r.key
  `;
  return rows.map((r) => ({
    key: r.key,
    count: r.count,
    grossPaise: Number(r.gross),
    sharePaise: Number(r.share),
  }));
}

export interface DayRow {
  day: string; // YYYY-MM-DD, an India calendar day
  count: number;
  grossPaise: number;
}

// Captured tips per India calendar day for the last `days` days including
// today, with empty days as zero so the chart has no gaps.
export async function loadDailyTips(creatorId: number, days: number): Promise<DayRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db<{ day: string; count: number; gross: string }[]>`
    with d as (
      select generate_series(
        (now() at time zone 'Asia/Kolkata')::date - ${days - 1}::int,
        (now() at time zone 'Asia/Kolkata')::date,
        interval '1 day'
      )::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
           count(t.id)::int as count,
           coalesce(sum(t.gross_amount_minor), 0)::text as gross
    from d
    left join tip_orders t
      on t.creator_id = ${creatorId}
     and t.status = 'captured'
     and t.captured_at is not null
     and (t.captured_at at time zone 'Asia/Kolkata')::date = d.day
    group by d.day
    order by d.day
  `;
  return rows.map((r) => ({ day: r.day, count: r.count, grossPaise: Number(r.gross) }));
}

export interface TipRow {
  id: number;
  capturedAt: Date;
  name: string;
  amountPaise: number;
  sharePaise: number;
  // A rejected message's text is never returned, as on the live tip island.
  message: string | null;
  messageStatus: "pending" | "approved" | "rejected";
  rejected: boolean;
}

type DbTip = {
  id: number;
  captured_at: Date;
  fan_name: string | null;
  fan_message: string | null;
  message_status: "pending" | "approved" | "rejected";
  gross_amount_minor: string;
  platform_bps: number;
  processing_bps: number;
};

function selectTips(
  creatorId: number,
  { range, messageOnly }: TipsQuery,
  limit: number,
  offset: number,
) {
  const db = getDb();
  if (!db) return Promise.resolve([] as DbTip[]);
  const days = range === "7d" ? 7 : range === "30d" ? 30 : null;
  return db<DbTip[]>`
    select id::int as id, captured_at, fan_name, fan_message, message_status,
           gross_amount_minor, platform_bps, processing_bps
    from tip_orders
    where creator_id = ${creatorId}
      and status = 'captured'
      and captured_at is not null
      ${days ? db`and captured_at > now() - make_interval(days => ${days})` : db``}
      ${messageOnly ? db`and btrim(coalesce(fan_message, '')) <> ''` : db``}
    order by captured_at desc, id desc
    limit ${limit}
    offset ${offset}
  `;
}

function toTipRow(r: DbTip): TipRow {
  const gross = Number(r.gross_amount_minor);
  const text = r.fan_message?.trim() ?? "";
  const rejected = r.message_status === "rejected";
  return {
    id: r.id,
    capturedAt: r.captured_at,
    name: r.fan_name?.trim() || "Anonymous",
    amountPaise: gross,
    sharePaise: estimateShare(gross, { platformBps: r.platform_bps, processingBps: r.processing_bps }),
    message: text && !rejected ? text : null,
    messageStatus: r.message_status,
    rejected: rejected && text !== "",
  };
}

export async function loadTips(
  creatorId: number,
  query: TipsQuery,
): Promise<{ tips: TipRow[]; hasMore: boolean }> {
  const rows = await selectTips(
    creatorId,
    query,
    TIPS_PAGE_SIZE + 1,
    (query.page - 1) * TIPS_PAGE_SIZE,
  );
  return {
    tips: rows.slice(0, TIPS_PAGE_SIZE).map(toTipRow),
    hasMore: rows.length > TIPS_PAGE_SIZE,
  };
}

// Every tip matching the filters (paging ignored), newest first, capped so one
// download cannot read the whole table. `truncated` is true when the cap hit.
export async function loadTipsForExport(
  creatorId: number,
  query: TipsQuery,
): Promise<{ tips: TipRow[]; truncated: boolean }> {
  const rows = await selectTips(creatorId, query, EXPORT_MAX_ROWS + 1, 0);
  return {
    tips: rows.slice(0, EXPORT_MAX_ROWS).map(toTipRow),
    truncated: rows.length > EXPORT_MAX_ROWS,
  };
}

// The creator's latest streams for the recap page: captured tips from the last
// RECAP_DAYS days grouped into streams (see stream-recap.ts). Capped so one very
// busy creator cannot make the page read an unbounded table.
export async function loadRecapStreams(creatorId: number): Promise<StreamRecap[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db<
    { captured_at: Date; fan_name: string | null; gross_amount_minor: string; platform_bps: number; processing_bps: number }[]
  >`
    select captured_at, fan_name, gross_amount_minor, platform_bps, processing_bps
    from tip_orders
    where creator_id = ${creatorId}
      and status = 'captured'
      and captured_at is not null
      and captured_at > now() - make_interval(days => ${RECAP_DAYS})
    order by captured_at desc
    limit ${RECAP_MAX_TIPS}
  `;
  const tips = rows.map((r) => ({
    capturedAt: r.captured_at,
    name: r.fan_name,
    amountPaise: Number(r.gross_amount_minor),
    rates: { platformBps: r.platform_bps, processingBps: r.processing_bps },
  }));
  return groupStreams(tips).slice(0, RECAP_MAX_STREAMS);
}
