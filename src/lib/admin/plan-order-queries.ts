import type { LedgerDb } from "../accrual";
import { toWhole } from "./result";

// What the owner reads about plan purchases (the PayU orders of migration 0055): the recent orders,
// with the proof of what the creator agreed to, and the ones PayU says were paid at another price.
// No site imports and no `server-only`, so the tests run these against an in-memory Postgres.

export interface PlanOrderRow {
  id: number;
  creatorId: number;
  handle: string | null;
  email: string;
  plan: string;
  termMonths: number;
  amountMinor: number;
  status: string;
  livemode: boolean;
  early: boolean;
  createdAt: Date;
  paidAt: Date | null;
  passEndsAt: Date | null;
  endedAt: Date | null;
  endedReason: string | null;
  agreedAt: Date | null;
  termsVersion: string | null;
  payuRef: string | null;
  failureReason: string | null;
  // Set when PayU says the order is paid but not at the plain price (nothing was switched on).
  needsLook: string | null;
}

interface Row extends Record<string, unknown> {
  id: string;
  creator_id: string;
  handle: string | null;
  email: string;
  plan: string;
  term_months: number;
  amount_minor: string;
  status: string;
  livemode: boolean;
  early: boolean;
  created_at: Date;
  paid_at: Date | null;
  pass_ends_at: Date | null;
  ended_at: Date | null;
  ended_reason: string | null;
  agreed_at: Date | null;
  terms_version: string | null;
  payu_ref: string | null;
  failure_reason: string | null;
  needs_look: string | null;
}

// Newest first. `needsLookOnly` keeps just the orders PayU says were paid at another price and that
// are still not paid here.
export async function getPlanOrders(
  db: LedgerDb,
  opts: { creatorId?: number; limit?: number; needsLookOnly?: boolean } = {},
): Promise<PlanOrderRow[]> {
  const creatorId = opts.creatorId ?? null;
  const rows = await db<Row[]>`
    select o.id::text, o.creator_id::text, u.handle, u.email, o.plan, o.term_months, o.amount_minor::text,
           o.status, o.livemode, o.early, o.created_at, o.paid_at, o.pass_ends_at, o.ended_at, o.ended_reason,
           o.agreed_at, o.terms_version, o.payu_ref, o.failure_reason,
           (select a.after_json ->> 'detail' from audit_events a
             where a.action = 'plan.payment_needs_look' and a.entity_type = 'plan_order' and a.entity_ref = o.id::text
             order by a.id desc limit 1) as needs_look
      from plan_orders o join users u on u.id = o.creator_id
     where (${creatorId}::bigint is null or o.creator_id = ${creatorId}::bigint)
       and (${Boolean(opts.needsLookOnly)}::boolean is false
            or (o.status <> 'paid' and exists (
                  select 1 from audit_events a
                   where a.action = 'plan.payment_needs_look' and a.entity_type = 'plan_order' and a.entity_ref = o.id::text)))
     order by o.created_at desc, o.id desc limit ${opts.limit ?? 50}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    creatorId: Number(r.creator_id),
    handle: r.handle,
    email: r.email,
    plan: r.plan,
    termMonths: r.term_months,
    amountMinor: toWhole(r.amount_minor),
    status: r.status,
    livemode: r.livemode,
    early: r.early,
    createdAt: new Date(r.created_at),
    paidAt: r.paid_at ? new Date(r.paid_at) : null,
    passEndsAt: r.pass_ends_at ? new Date(r.pass_ends_at) : null,
    endedAt: r.ended_at ? new Date(r.ended_at) : null,
    endedReason: r.ended_reason,
    agreedAt: r.agreed_at ? new Date(r.agreed_at) : null,
    termsVersion: r.terms_version,
    payuRef: r.payu_ref,
    failureReason: r.failure_reason,
    needsLook: r.needs_look,
  }));
}

// How many orders PayU says were paid at another price and are still not paid here: the number on
// the owner's overview.
export async function countNeedsLook(db: LedgerDb): Promise<number> {
  const [r] = await db<{ n: string }[]>`
    select count(*)::text as n from plan_orders o
     where o.status <> 'paid'
       and exists (select 1 from audit_events a
                    where a.action = 'plan.payment_needs_look' and a.entity_type = 'plan_order' and a.entity_ref = o.id::text)
  `;
  return toWhole(r?.n ?? "0");
}
