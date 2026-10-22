import "server-only";
import { getDb } from "@/lib/db";
import type { DateRange } from "./date-range";

export type CreatorEarningsRow = {
  creatorId: number;
  name: string | null;
  handle: string | null;
  ytChannelName: string | null;
  tipCount: number;
  grossMinor: number;
  refundedMinor: number;
  providerFeesMinor: number;
  platformFeeMinor: number;
  creatorNetMinor: number;
  settledMinor: number;
  pendingMinor: number;
  lastTipAt: Date | null;
  lastPayoutAt: Date | null;
};

export async function getCreatorEarnings(
  range: DateRange,
): Promise<CreatorEarningsRow[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const rows = await db<{
      creator_id: string;
      name: string | null;
      handle: string | null;
      yt_channel_name: string | null;
      tip_count: string;
      gross_minor: string;
      refunded_minor: string;
      provider_fees_minor: string;
      platform_fee_minor: string;
      settled_minor: string;
      last_tip_at: Date | null;
      last_payout_at: Date | null;
    }[]>`
      select
        u.id                                                          as creator_id,
        u.name,
        u.handle,
        u.yt_channel_name,
        coalesce(t.tip_count, 0)::text                               as tip_count,
        coalesce(t.gross_minor, 0)::text                             as gross_minor,
        coalesce(r.refunded_minor, 0)::text                          as refunded_minor,
        coalesce(f.provider_fees_minor, 0)::text                     as provider_fees_minor,
        coalesce(f.platform_fee_minor, 0)::text                      as platform_fee_minor,
        coalesce(p.settled_minor, 0)::text                           as settled_minor,
        t.last_tip_at,
        p.last_payout_at
      from users u
      -- Tips captured in the period
      left join (
        select
          creator_id,
          count(*)                   as tip_count,
          sum(gross_amount_minor)    as gross_minor,
          max(captured_at)           as last_tip_at
        from tip_orders
        where status = 'captured'
          and captured_at >= ${range.from}
          and captured_at < ${range.to}
        group by creator_id
      ) t on t.creator_id = u.id
      -- Refunds in the period
      left join (
        select
          o.creator_id,
          sum(rf.processed_amount_minor) as refunded_minor
        from refunds rf
        join tip_orders o on o.id = rf.tip_order_id
        where rf.status = 'processed'
          and rf.processed_at >= ${range.from}
          and rf.processed_at < ${range.to}
        group by o.creator_id
      ) r on r.creator_id = u.id
      -- Fee lines in the period
      left join (
        select
          creator_id,
          sum(case when fee_type in ('gateway_fee','gateway_tax','upi_mdr')
                   then amount_minor else 0 end) as provider_fees_minor,
          sum(case when fee_type = 'platform_fee'
                   then amount_minor else 0 end) as platform_fee_minor
        from fee_lines
        where effective_at >= ${range.from}
          and effective_at < ${range.to}
        group by creator_id
      ) f on f.creator_id = u.id
      -- Creator payouts completed in the period
      left join (
        select
          creator_id,
          sum(amount_minor) as settled_minor,
          max(completed_at) as last_payout_at
        from creator_payouts
        where status = 'completed'
          and completed_at >= ${range.from}
          and completed_at < ${range.to}
        group by creator_id
      ) p on p.creator_id = u.id
      -- Only include creators who have at least one tip ever (not just in range)
      where exists (
        select 1 from tip_orders o2
        where o2.creator_id = u.id and o2.status = 'captured'
      )
      order by coalesce(t.gross_minor, 0) desc, u.name
    `;

    return rows.map((r) => {
      const gross = Number(r.gross_minor);
      const refunded = Number(r.refunded_minor);
      const providerFees = Number(r.provider_fees_minor);
      const platformFee = Number(r.platform_fee_minor);
      const settled = Number(r.settled_minor);
      const net = Math.max(0, gross - refunded - providerFees - platformFee);
      const pending = Math.max(0, gross - refunded - settled);

      return {
        creatorId: Number(r.creator_id),
        name: r.name,
        handle: r.handle,
        ytChannelName: r.yt_channel_name,
        tipCount: Number(r.tip_count),
        grossMinor: gross,
        refundedMinor: refunded,
        providerFeesMinor: providerFees,
        platformFeeMinor: platformFee,
        creatorNetMinor: net,
        settledMinor: settled,
        pendingMinor: pending,
        lastTipAt: r.last_tip_at,
        lastPayoutAt: r.last_payout_at,
      };
    });
  } catch {
    return [];
  }
}
