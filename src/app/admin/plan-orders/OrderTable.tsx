import Link from "next/link";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { markPlanPaymentHandled } from "@/app/actions/admin";
import { formatINR } from "@/lib/admin/result";
import { fmtIST } from "@/lib/admin/format";
import type { PlanOrderRow } from "@/lib/admin/plan-order-queries";
import { PLAN_NAMES, type PlanKey } from "@/lib/pricing";

const planName = (plan: string) => PLAN_NAMES[plan as PlanKey] ?? plan;
const term = (months: number) => (months === 12 ? "12 months" : `${months} month${months === 1 ? "" : "s"}`);

// `canHandle` adds the "Mark handled" button, used on the "to look at" list.
export function OrderTable({ rows, canHandle = false }: { rows: PlanOrderRow[]; canHandle?: boolean }) {
  return (
    <div data-lenis-prevent className="overflow-x-auto rounded-surface border border-control">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-control bg-raised">
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Order</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Plan</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Amount</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Agreed</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-control bg-surface">
          {rows.map((r) => (
            <tr key={r.id} className="align-top transition-colors hover:bg-raised">
              <td className="px-4 py-3 text-muted">
                <span className="numeric text-text">#{r.id}</span>
                <span className="block text-xs">{fmtIST(r.createdAt)}</span>
                {!r.livemode && <span className="block text-xs">test payment</span>}
              </td>
              <td className="px-4 py-3">
                <Link href={`/admin/creators/${r.creatorId}`} className="text-text underline decoration-line hover:decoration-accent">
                  {r.handle ?? r.email}
                </Link>
              </td>
              <td className="px-4 py-3 text-text">
                {planName(r.plan)}, {term(r.termMonths)}
                {r.early ? <span className="block text-xs text-muted">early price</span> : null}
              </td>
              <td className="numeric px-4 py-3 text-right text-text">{formatINR(r.amountMinor)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
                {r.endedAt && <span className="block text-xs text-muted">ended {fmtIST(r.endedAt, "date")}</span>}
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {r.agreedAt ? (
                  <>
                    {fmtIST(r.agreedAt)}
                    <span className="block">terms of {r.termsVersion ?? "unknown date"}</span>
                  </>
                ) : (
                  "no record (made before it was kept)"
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {r.needsLook && <span className="block text-text">PayU: paid, but {r.needsLook}</span>}
                {r.payuRef && <span className="block">PayU payment {r.payuRef}</span>}
                {r.failureReason && <span className="block">{r.failureReason}</span>}
                {r.endedReason && <span className="block">{r.endedReason}</span>}
                {canHandle && (
                  <div className="mt-2">
                    <ConfirmAction
                      action={markPlanPaymentHandled.bind(null, r.id)}
                      label="Mark handled"
                      confirmLabel="Mark handled"
                      pendingLabel="Saving…"
                      tone="quiet"
                      description="Take this payment off the list. Do it once you have refunded it in PayU or given the creator the features yourself. Nothing is changed on the order; the reason is kept in the audit history."
                      askReason
                    />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
