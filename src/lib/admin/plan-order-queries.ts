import type { LedgerDb } from "../accrual";
import { toWhole } from "./result";

// What the owner reads about plan purchases (the PayU orders of migration 0055): the recent orders,
// with the proof of what the creator agreed to, and the ones PayU says were paid at another price.
// No site imports and no `server-only`, so the tests run these against an in-memory Postgres.

// The audit lines that put an order on the owner's "to look at" list and take it off again.
export const NEEDS_LOOK = "plan.payment_needs_look";
export const LOOK_HANDLED = "plan.payment_look_handled";

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

// Newest first. `needsLookOnly` keeps just the orders PayU says were paid at another price, that
// are still not paid here and that the owner has not marked handled.
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
            or (o.status <> 'paid'
                and exists (select 1 from audit_events a
                             where a.action = 'plan.payment_needs_look' and a.entity_type = 'plan_order' and a.entity_ref = o.id::text)
                and not exists (select 1 from audit_events h
                                 where h.action = 'plan.payment_look_handled' and h.entity_type = 'plan_order' and h.entity_ref = o.id::text)))
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

// How many orders PayU says were paid at another price, are still not paid here and have not been
// marked handled: the number on the owner's overview.
export async function countNeedsLook(db: LedgerDb): Promise<number> {
  const [r] = await db<{ n: string }[]>`
    select count(*)::text as n from plan_orders o
     where o.status <> 'paid'
       and exists (select 1 from audit_events a
                    where a.action = 'plan.payment_needs_look' and a.entity_type = 'plan_order' and a.entity_ref = o.id::text)
       and not exists (select 1 from audit_events h
                        where h.action = 'plan.payment_look_handled' and h.entity_type = 'plan_order' and h.entity_ref = o.id::text)
  `;
  return toWhole(r?.n ?? "0");
}

// The owner has dealt with a payment on the "to look at" list (refunded it in PayU, or gave the
// creator the features by hand): one audit line takes it off the list and the overview badge, and the
// reason is kept. The order row itself is not changed, and the audit history stays complete.
export async function markNeedsLookHandled(
  db: LedgerDb,
  orderId: number,
  reason: string,
): Promise<"handled" | "not_flagged" | "already_handled"> {
  return db.begin(async (tx) => {
    // The order row is locked so two clicks cannot both write a line.
    const [order] = await tx<{ status: string }[]>`select status from plan_orders where id = ${orderId} for update`;
    if (!order) return "not_flagged" as const;
    const [flags] = await tx<{ flagged: boolean; handled: boolean }[]>`
      select exists (select 1 from audit_events where action = ${NEEDS_LOOK} and entity_type = 'plan_order' and entity_ref = ${String(orderId)}) as flagged,
             exists (select 1 from audit_events where action = ${LOOK_HANDLED} and entity_type = 'plan_order' and entity_ref = ${String(orderId)}) as handled
    `;
    if (!flags.flagged) return "not_flagged" as const;
    if (flags.handled) return "already_handled" as const;
    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
      values (null, 'owner', ${LOOK_HANDLED}, 'plan_order', ${String(orderId)}, ${{ status: order.status }}::jsonb, ${reason})
    `;
    return "handled" as const;
  });
}
