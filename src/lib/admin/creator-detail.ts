import type { LedgerDb } from "../accrual";
import { load, toWhole, type Loaded } from "./result";

// One creator for the owner's detail page: the profile, tip totals, the latest
// tips and payouts. Read only. Money here is from tip_orders (what fans paid);
// the ledger-based balance lives on the Balances page.

export interface CreatorDetail {
  id: number;
  name: string | null;
  email: string;
  handle: string | null;
  creatorStatus: string;
  onboardingState: string;
  legalName: string | null;
  upiVpa: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  createdAt: Date;
  capturedCount: number;
  capturedMinor: number;
  recentTips: { reference: string; status: string; grossMinor: number; fanName: string | null; at: Date }[];
  payouts: { id: number; status: string; amountMinor: number; createdAt: Date }[];
}

export function getCreatorDetail(db: LedgerDb, id: number): Promise<Loaded<CreatorDetail | null>> {
  return load("creator detail", async () => {
    const users = await db<{
      id: string;
      name: string | null;
      email: string;
      handle: string | null;
      creator_status: string;
      onboarding_state: string;
      legal_name: string | null;
      upi_vpa: string | null;
      yt_channel_name: string | null;
      yt_channel_url: string | null;
      created_at: Date;
    }[]>`
      select id::text, name, email, handle, creator_status, onboarding_state, legal_name,
             upi_vpa, yt_channel_name, yt_channel_url, created_at
      from users where id = ${id}
    `;
    const u = users[0];
    if (!u) return null;

    const totals = await db<{ n: string; gross: string }[]>`
      select count(*)::text as n, coalesce(sum(gross_amount_minor), 0)::text as gross
      from tip_orders where creator_id = ${id} and status = 'captured'
    `;
    const tips = await db<{
      public_reference: string;
      status: string;
      gross_amount_minor: string;
      fan_name: string | null;
      created_at: Date;
    }[]>`
      select public_reference, status, gross_amount_minor::text, fan_name, created_at
      from tip_orders where creator_id = ${id}
      order by created_at desc limit 20
    `;
    const payouts = await db<{ id: string; status: string; amount_minor: string; created_at: Date }[]>`
      select id::text, status, amount_minor::text, created_at
      from creator_payouts where creator_id = ${id}
      order by created_at desc limit 20
    `;

    return {
      id: toWhole(u.id),
      name: u.name,
      email: u.email,
      handle: u.handle,
      creatorStatus: u.creator_status,
      onboardingState: u.onboarding_state,
      legalName: u.legal_name,
      upiVpa: u.upi_vpa,
      ytChannelName: u.yt_channel_name,
      ytChannelUrl: u.yt_channel_url,
      createdAt: u.created_at,
      capturedCount: toWhole(totals[0].n),
      capturedMinor: toWhole(totals[0].gross),
      recentTips: tips.map((t) => ({
        reference: t.public_reference,
        status: t.status,
        grossMinor: toWhole(t.gross_amount_minor),
        fanName: t.fan_name,
        at: t.created_at,
      })),
      payouts: payouts.map((p) => ({
        id: toWhole(p.id),
        status: p.status,
        amountMinor: toWhole(p.amount_minor),
        createdAt: p.created_at,
      })),
    };
  });
}
