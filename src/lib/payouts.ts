import type { LedgerDb, Query } from "./accrual";
import { MIN_PAYOUT_PAISE } from "./balances";
import { loadEarningsSummary } from "./creator-earnings";

// Manual creator payouts (owner decision, 2026-11-04). A creator asks for what is available; the owner
// pays it from their own bank or UPI app and records the UTR. No code here sends money.
//
// Every step is one database transaction that also writes the ledger and the audit row, so the books
// cannot show a payout that did not happen or miss one that did:
//   request   debit creator_payable    credit payouts_in_flight     (the money leaves the balance at once,
//                                                                    so it cannot be asked for twice)
//   paid      debit payouts_in_flight  credit settlement_clearing   (the UTR is recorded)
//   cancelled debit payouts_in_flight  credit creator_payable       (a reversal of the request)
// A request is taken under a per-creator lock and only after the available amount is worked out again
// inside the transaction, so two clicks, two tabs or a retry pay nothing twice. A partial unique index
// (migration 0059) also allows one open payout per creator.
//
// No site imports and no `server-only`, so the tests can run it against an in-memory Postgres.

export { MIN_PAYOUT_PAISE };
export const FIRST_PAYOUT_MAX_PAISE = 500_000; // ₹5,000 until a first payout has been paid
export const PAYOUT_MAX_PAISE = 2_500_000; // ₹25,000 in one payout; the rest stays available

const LOCK_NAMESPACE = 7001;

export const payoutRef = (id: number) => `FT-${id}`;

// How much a request is for: everything available, up to the ceiling; 0 when below the minimum.
export function amountToRequest(availablePaise: number, hasCompletedPayout: boolean): number {
  const ceiling = hasCompletedPayout ? PAYOUT_MAX_PAISE : FIRST_PAYOUT_MAX_PAISE;
  const amount = Math.min(Math.max(0, availablePaise), ceiling);
  return amount >= MIN_PAYOUT_PAISE ? amount : 0;
}

// A UPI transaction reference (usually 12 digits) or a bank reference: letters and digits only.
export function checkUtr(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const utr = raw.trim().toUpperCase();
  return /^[A-Z0-9]{6,30}$/.test(utr) ? utr : null;
}

export type RefusalReason =
  | "no_creator"
  | "not_active"
  | "no_upi"
  | "open_request"
  | "below_minimum";

export type RequestResult =
  | { status: "requested"; payoutId: number; amountPaise: number; firstPayout: boolean }
  | { status: "refused"; reason: RefusalReason };

export const REFUSAL_WORDS: Record<RefusalReason, string> = {
  no_creator: "We could not find your account.",
  not_active: "Your account is not active, so a payout cannot be requested.",
  no_upi: "There is no UPI ID on your account yet.",
  open_request: "You already have a payout request waiting. It is paid first, then you can ask again.",
  below_minimum: "Your available amount is below the minimum for a payout.",
};

type Actor = { role: "owner" | "creator"; userId: number | null };

async function audit(
  tx: Query,
  actor: Actor,
  action: string,
  payoutId: number,
  after: Record<string, unknown>,
  reason: string | null,
) {
  // postgres.js and the test driver both take the object for a json parameter as is.
  await tx`
    insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
    values (${actor.userId}::bigint, ${actor.role}::text, ${action}::text, 'creator_payout', ${String(payoutId)}::text,
            ${after as never}::jsonb, ${reason}::text)
  `;
}

async function postLines(
  tx: Query,
  o: {
    key: string;
    eventType: string;
    payoutId: number;
    creatorId: number;
    amountPaise: number;
    debit: string;
    credit: string;
    reversalOf?: string | null;
    memo: string;
  },
) {
  const [header] = await tx<{ id: string }[]>`
    insert into ledger_transactions
      (event_type, source_type, source_ref, creator_id, currency, effective_at, idempotency_key, reversal_of, memo)
    values (${o.eventType}::text, 'creator_payout', ${String(o.payoutId)}::text, ${o.creatorId}::bigint, 'INR', now(),
            ${o.key}::text, ${o.reversalOf ?? null}::bigint, ${o.memo}::text)
    returning id::text
  `;
  // The creator is named on the creator_payable line (the ledger requires it) and on the other line too.
  for (const [account, debit, credit] of [
    [o.debit, o.amountPaise, 0],
    [o.credit, 0, o.amountPaise],
  ] as const) {
    await tx`
      insert into ledger_entries (ledger_transaction_id, account_id, creator_id, debit_minor, credit_minor, currency)
      select ${header.id}::bigint, a.id, ${o.creatorId}::bigint, ${debit}::bigint, ${credit}::bigint, 'INR'
        from ledger_accounts a
       where a.code = ${account}::text
    `;
  }
  return header.id;
}

export async function requestPayout(db: LedgerDb, creatorId: number, now = new Date()): Promise<RequestResult> {
  return db.begin(async (tx): Promise<RequestResult> => {
    await tx`select pg_advisory_xact_lock(${LOCK_NAMESPACE}::int, ${creatorId}::int)`;

    const [creator] = await tx<{ creator_status: string; onboarding_state: string; upi_vpa: string | null }[]>`
      select creator_status, onboarding_state, upi_vpa from users where id = ${creatorId}
    `;
    if (!creator) return { status: "refused", reason: "no_creator" };
    if (creator.creator_status !== "active" || creator.onboarding_state !== "active") {
      return { status: "refused", reason: "not_active" };
    }
    if (!creator.upi_vpa) return { status: "refused", reason: "no_upi" };

    const open = await tx<{ one: number }[]>`
      select 1 as one from creator_payouts
       where creator_id = ${creatorId} and status in ('initiated', 'in_transit') limit 1
    `;
    if (open.length) return { status: "refused", reason: "open_request" };

    // Worked out again here, under the lock, from the ledger: never trusted from the page.
    const summary = await loadEarningsSummary(tx, creatorId, now);
    const amount = amountToRequest(summary.availablePaise, summary.hasCompletedPayout);
    if (amount === 0) return { status: "refused", reason: "below_minimum" };

    const [row] = await tx<{ id: string }[]>`
      insert into creator_payouts
        (creator_id, amount_minor, currency, status, upi_vpa, requested_at, initiated_at, first_payout)
      values (${creatorId}::bigint, ${amount}::bigint, 'INR', 'initiated', ${creator.upi_vpa}::text, ${now.toISOString()}::timestamptz,
              ${now.toISOString()}::timestamptz, ${!summary.hasCompletedPayout}::boolean)
      returning id::text
    `;
    const payoutId = Number(row.id);
    await postLines(tx, {
      key: `payout:${payoutId}:request`,
      eventType: "payout_requested",
      payoutId,
      creatorId,
      amountPaise: amount,
      debit: "creator_payable",
      credit: "payouts_in_flight",
      memo: "Payout requested",
    });
    await audit(
      tx,
      { role: "creator", userId: creatorId },
      "payout.requested",
      payoutId,
      { amount_minor: amount, first_payout: !summary.hasCompletedPayout },
      null,
    );
    return { status: "requested", payoutId, amountPaise: amount, firstPayout: !summary.hasCompletedPayout };
  });
}

export type PaidResult =
  | { status: "paid" }
  | { status: "already" }
  | { status: "refused"; reason: "missing" | "not_open" | "bad_utr" | "utr_used" | "name_not_checked" };

export async function markPayoutPaid(
  db: LedgerDb,
  payoutId: number,
  input: { utr: unknown; nameMatched: boolean },
): Promise<PaidResult> {
  const utr = checkUtr(input.utr);
  if (!utr) return { status: "refused", reason: "bad_utr" };
  if (!input.nameMatched) return { status: "refused", reason: "name_not_checked" };

  return db.begin(async (tx): Promise<PaidResult> => {
    const [p] = await tx<{ creator_id: string; amount_minor: string; status: string; upi_vpa: string | null }[]>`
      select creator_id::text, amount_minor::text, status, upi_vpa
        from creator_payouts where id = ${payoutId} for update
    `;
    if (!p) return { status: "refused", reason: "missing" };
    if (p.status === "completed") return { status: "already" };
    if (p.status !== "initiated" && p.status !== "in_transit") return { status: "refused", reason: "not_open" };

    const used = await tx<{ one: number }[]>`
      select 1 as one from creator_payouts where provider_transfer_ref = ${utr} and id <> ${payoutId} limit 1
    `;
    if (used.length) return { status: "refused", reason: "utr_used" };

    const creatorId = Number(p.creator_id);
    const amount = Number(p.amount_minor);
    await tx`
      update creator_payouts
         set status = 'completed', completed_at = now(), provider_transfer_ref = ${utr}, name_matched = true
       where id = ${payoutId}
    `;
    await postLines(tx, {
      key: `payout:${payoutId}:paid`,
      eventType: "payout_paid",
      payoutId,
      creatorId,
      amountPaise: amount,
      debit: "payouts_in_flight",
      credit: "settlement_clearing",
      memo: "Payout paid",
    });
    await audit(tx, { role: "owner", userId: null }, "payout.paid", payoutId, { utr, amount_minor: amount, upi_vpa: p.upi_vpa }, null);
    return { status: "paid" };
  });
}

export type CancelResult =
  | { status: "cancelled" }
  | { status: "already" }
  | { status: "refused"; reason: "missing" | "not_open" };

// Puts a request that was not paid back on the creator's balance (a reversal of the request posting).
export async function cancelPayout(db: LedgerDb, payoutId: number, reason: string | null): Promise<CancelResult> {
  return db.begin(async (tx): Promise<CancelResult> => {
    const [p] = await tx<{ creator_id: string; amount_minor: string; status: string }[]>`
      select creator_id::text, amount_minor::text, status from creator_payouts where id = ${payoutId} for update
    `;
    if (!p) return { status: "refused", reason: "missing" };
    if (p.status === "cancelled") return { status: "already" };
    if (p.status !== "initiated" && p.status !== "in_transit") return { status: "refused", reason: "not_open" };

    const [request] = await tx<{ id: string }[]>`
      select id::text from ledger_transactions where idempotency_key = ${`payout:${payoutId}:request`}
    `;
    if (!request) throw new Error(`Payout ${payoutId} has no request posting to reverse`);

    const creatorId = Number(p.creator_id);
    const amount = Number(p.amount_minor);
    await tx`
      update creator_payouts set status = 'cancelled', failed_at = now(), cancel_reason = ${reason}::text where id = ${payoutId}
    `;
    await postLines(tx, {
      key: `payout:${payoutId}:cancel`,
      eventType: "payout_cancelled",
      payoutId,
      creatorId,
      amountPaise: amount,
      debit: "payouts_in_flight",
      credit: "creator_payable",
      reversalOf: request.id,
      memo: "Payout request cancelled",
    });
    await audit(tx, { role: "owner", userId: null }, "payout.cancelled", payoutId, { amount_minor: amount }, reason);
    return { status: "cancelled" };
  });
}
