import { getDb } from "@/lib/db";
import {
  GATEWAY_BPS,
  PLATFORM_BPS,
  TIPS_PAGE_SIZE,
  estimateShare,
  type TipsQuery,
} from "@/lib/earnings";

export type OverviewKey = "today" | "7d" | "30d" | "all";

export interface OverviewRow {
  key: OverviewKey;
  count: number;
  grossPaise: number;
  sharePaise: number;
}

// Captured tips only. "Today" starts at midnight in India; the others roll back
// from now. The share is summed per tip with the same rounding as
// `estimateShare`, so the strip and the tips list agree.
export async function loadOverview(creatorId: number): Promise<OverviewRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db<{ key: OverviewKey; count: number; gross: string; share: string }[]>`
    with t as (
      select captured_at,
             gross_amount_minor as gross,
             gross_amount_minor
               - ((gross_amount_minor * ${PLATFORM_BPS}::bigint + 5000) / 10000)
               - ((gross_amount_minor * ${GATEWAY_BPS}::bigint + 5000) / 10000) as share
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

export async function loadTips(
  creatorId: number,
  { range, messageOnly, page }: TipsQuery,
): Promise<{ tips: TipRow[]; hasMore: boolean }> {
  const db = getDb();
  if (!db) return { tips: [], hasMore: false };
  const days = range === "7d" ? 7 : range === "30d" ? 30 : null;
  const rows = await db<
    {
      id: number;
      captured_at: Date;
      fan_name: string | null;
      fan_message: string | null;
      message_status: "pending" | "approved" | "rejected";
      gross_amount_minor: string;
    }[]
  >`
    select id::int as id, captured_at, fan_name, fan_message, message_status,
           gross_amount_minor
    from tip_orders
    where creator_id = ${creatorId}
      and status = 'captured'
      and captured_at is not null
      ${days ? db`and captured_at > now() - make_interval(days => ${days})` : db``}
      ${messageOnly ? db`and btrim(coalesce(fan_message, '')) <> ''` : db``}
    order by captured_at desc, id desc
    limit ${TIPS_PAGE_SIZE + 1}
    offset ${(page - 1) * TIPS_PAGE_SIZE}
  `;
  const tips = rows.slice(0, TIPS_PAGE_SIZE).map((r) => {
    const gross = Number(r.gross_amount_minor);
    const text = r.fan_message?.trim() ?? "";
    const rejected = r.message_status === "rejected";
    return {
      id: r.id,
      capturedAt: r.captured_at,
      name: r.fan_name?.trim() || "Anonymous",
      amountPaise: gross,
      sharePaise: estimateShare(gross),
      message: text && !rejected ? text : null,
      messageStatus: r.message_status,
      rejected: rejected && text !== "",
    };
  });
  return { tips, hasMore: rows.length > TIPS_PAGE_SIZE };
}
