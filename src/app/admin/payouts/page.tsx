import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { MetricCard } from "@/components/admin/MetricCard";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { TONE_BADGE, toneOf } from "@/components/admin/tones";
import { fmtIST } from "@/lib/admin/format";
import {
  listOpenPayouts,
  listRecentPayouts,
  type CreatorTotals,
  type OpenPayouts,
  type PayoutAdminRow,
} from "@/lib/admin/payout-queries";
import { formatINR } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { payoutRef } from "@/lib/payouts";
import { cancelPayoutAction, markPayoutPaidAction, reversePayoutAction } from "@/app/actions/payouts";
import { CouldNotRead, DefinitionNote, DatabaseNotSetUp } from "../_components/Notices";
import { MarkPaidForm } from "./MarkPaidForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { completed: "Paid", cancelled: "Cancelled", failed: "Reversed" };

export default async function PayoutsPage() {
  await requireOwner();
  const db = adminDb();
  const [open, recent] = db ? await Promise.all([listOpenPayouts(db), listRecentPayouts(db)]) : [null, null];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Finance · Payouts</p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">Payouts to pay</h1>
        <DefinitionNote>
          Every morning (about 9 am) the site starts a payout for each creator with at least ₹500
          available (tips are available a day after a UPI payment) and emails you this list. You pay
          each one from your own bank or UPI app to the UPI ID shown, then enter the UTR here and tick
          that the name matched; every UTR is kept in the list below. Nothing is sent from this site.
          Cancel a payout you will not pay (a wrong UPI ID, say) and the money goes back on the
          creator&apos;s balance; the next morning&apos;s run starts it again. If a payout you marked as
          paid did not arrive (the bank sent it back, or the UTR was for the wrong person), Reverse it in
          the list below: the money goes back on the balance and the payout stays on record as reversed.
        </DefinitionNote>
      </div>

      {!open || !recent ? (
        <DatabaseNotSetUp />
      ) : !open.ok ? (
        <CouldNotRead
          detail={open.error}
          message="Could not read payouts. Migration 0059 (payout requests) must be run in Neon first."
        />
      ) : (
        <>
          <Waiting data={open.data} />
          <Recent rows={recent} />
        </>
      )}
    </div>
  );
}

function Waiting({ data }: { data: OpenPayouts }) {
  const total = data.rows.reduce((s, r) => s + r.amountMinor, 0);
  return (
    <section aria-labelledby="waiting-title" className="space-y-4">
      <h2 id="waiting-title" className="sr-only">
        Waiting to be paid
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Payouts to pay" value={String(data.rows.length)} accent={data.rows.length > 0} />
        <MetricCard label="Total to pay" value={formatINR(total)} accent={total > 0} />
      </div>
      {data.rows.length === 0 ? (
        <AdminEmptyState
          title="Nothing to pay"
          description="Each morning's run adds a payout here for every creator with at least ₹500 available, and emails you the list if email is set up."
        />
      ) : (
        <ul className="space-y-4">
          {data.rows.map((r) => (
            <Request key={r.id} row={r} totals={data.totals.get(r.creatorId)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Request({ row: r, totals }: { row: PayoutAdminRow; totals: CreatorTotals | undefined }) {
  const waitedDays = r.waitedDays;
  const name = r.name?.trim() || "this creator";
  return (
    <li className="space-y-5 rounded-surface border border-control bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href={`/admin/creators/${r.creatorId}`} className="break-words text-lg font-semibold text-text hover:text-accent">
            {r.name ?? "Unnamed creator"}
          </Link>
          {r.handle && <p className="text-sm text-muted">@{r.handle}</p>}
          <p className="text-xs text-muted">
            Reference <span className="numeric text-text">{payoutRef(r.id)}</span> · started {fmtIST(r.requestedAt, "short")} IST
          </p>
        </div>
        <p className="numeric text-3xl font-semibold text-accent">{formatINR(r.amountMinor)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {r.firstPayout && <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_BADGE.neutral}`}>First payout</span>}
        {waitedDays >= 1 && (
          <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_BADGE.warn}`}>
            Waiting {waitedDays} {waitedDays === 1 ? "day" : "days"}
          </span>
        )}
        {r.upiChanged && (
          <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_BADGE.warn}`}>
            UPI ID changed since this payout started: pay the one below
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm text-muted">Pay to this UPI ID</p>
        <p className="numeric select-all break-all text-lg font-semibold text-text">{r.upiVpa ?? "—"}</p>
      </div>

      {totals && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5">
          <Figure label={`Tips (${totals.tipCount})`} value={formatINR(totals.grossMinor)} />
          <Figure label="Freetip fee" value={`−${formatINR(totals.freetipFeeMinor)}`} />
          <Figure label="Payment fee" value={`−${formatINR(totals.processingMinor)}`} />
          <Figure label="Creator's share" value={formatINR(totals.creatorShareMinor)} />
          <Figure label="Paid out before" value={formatINR(totals.paidOutMinor)} />
        </dl>
      )}

      <MarkPaidForm action={markPayoutPaidAction.bind(null, r.id)} creatorName={name} />

      <ConfirmAction
        action={cancelPayoutAction.bind(null, r.id)}
        label="Cancel this payout"
        description="The money goes back on the creator's balance, and the next morning's run starts a new payout if at least ₹500 is available. Use it for a wrong UPI ID or a payout you will not pay today."
        confirmLabel="Cancel payout"
        pendingLabel="Cancelling…"
        askReason
      />
    </li>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="numeric font-semibold text-text">{value}</dd>
    </div>
  );
}

function Recent({ rows }: { rows: Awaited<ReturnType<typeof listRecentPayouts>> }) {
  if (!rows.ok) return <CouldNotRead detail={rows.error} />;
  if (rows.data.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <h2 id="recent-title" className="text-lg font-semibold text-text">
        Paid, cancelled and reversed
      </h2>
      <div className="overflow-x-auto rounded-surface border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-raised">
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Reference</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Amount</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">UTR or reason</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">When (IST)</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control bg-surface">
            {rows.data.map((r) => (
              <tr key={r.id}>
                <td className="numeric px-4 py-3 text-text">{payoutRef(r.id)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/creators/${r.creatorId}`} className="font-medium text-text hover:text-accent">
                    {r.name ?? "—"}
                  </Link>
                  {r.handle && <p className="text-xs text-muted">@{r.handle}</p>}
                </td>
                <td className="numeric px-4 py-3 text-right text-text">{formatINR(r.amountMinor)}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_BADGE[toneOf(r.status)]}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="numeric break-all px-4 py-3 text-muted">
                  {r.status === "completed"
                    ? r.utr ?? "—"
                    : r.status === "failed"
                      ? [r.utr, r.cancelReason].filter(Boolean).join(" · ") || "—"
                      : r.cancelReason ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted">
                  {fmtIST(r.completedAt ?? r.failedAt ?? r.requestedAt, "short")}
                </td>
                <td className="px-4 py-3 align-top">
                  {r.status === "completed" && (
                    <ConfirmAction
                      action={reversePayoutAction.bind(null, r.id)}
                      label="Reverse"
                      description="Use this only if the money did not reach the creator. It goes back on their balance, this payout is kept as reversed, and they can ask again."
                      confirmLabel="Reverse payout"
                      pendingLabel="Reversing…"
                      askReason
                      reasonRequired
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
