import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getPayments, type PaymentList } from "@/lib/admin/payment-queries";
import { formatINR, getTestModeTipCount } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import {
  CouldNotRead,
  DefinitionNote,
  FinanceNotSetUp,
  TestModeLine,
} from "../../_components/Notices";

export const dynamic = "force-dynamic";

const LIMIT = 200;

function fmtTs(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PaymentLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireOwner();
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);

  const db = adminDb();
  const result = db ? await getPayments(db, range, LIMIT) : null;
  const testModeTips = db ? await getTestModeTipCount(db, range) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Payment ledger
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">All payments</h1>
        <DefinitionNote>
          Every tip order, newest first. Only live captured tips count in the totals; rows marked
          Test (made in test mode) and orders that were never captured are listed but left out.
        </DefinitionNote>
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {testModeTips?.ok && <TestModeLine count={testModeTips.data} />}

      {!result ? (
        <FinanceNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead detail={result.error} />
      ) : result.data.rows.length === 0 ? (
        <AdminEmptyState
          title="No payment orders in this period"
          description="Every tip order appears here with its fee lines, ledger posting and creator share. Test-mode orders are listed as Test and never counted."
        />
      ) : (
        <PaymentTable list={result.data} />
      )}
    </div>
  );
}

const cell = "px-4 py-3 text-right font-mono tabular-nums";

function Pill({ tone, children }: { tone: "good" | "warn"; children: React.ReactNode }) {
  const style = tone === "good" ? "bg-accent/15 text-accent" : "bg-amber-500/15 text-amber-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {children}
    </span>
  );
}

function PaymentTable({ list }: { list: PaymentList }) {
  const { rows, totals, truncated } = list;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {rows.length} order{rows.length !== 1 ? "s" : ""} listed
        {truncated ? `, capped at ${LIMIT}: older orders in this period are not shown and not in the totals` : ""}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Order</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Gross</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Method</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Our fee</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Processing charge</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Creator share</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Posted</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Flags</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Captured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {rows.map((r) => {
              const counted = r.live && r.orderStatus === "captured";
              return (
                <tr
                  key={r.orderId}
                  className={`hover:bg-surface/40 transition-colors ${r.live ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-muted">{r.publicRef}</p>
                    {r.providerPaymentRef && (
                      <p className="font-mono text-xs text-muted/60">{r.providerPaymentRef}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{r.creatorName ?? "—"}</p>
                    {r.creatorHandle && <p className="text-xs text-muted">@{r.creatorHandle}</p>}
                  </td>
                  <td className={`${cell} ${counted ? "text-accent" : "text-muted"}`}>
                    {formatINR(r.grossMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={r.orderStatus} />
                      {!r.live && (
                        <span
                          title="Made in test mode, or the mode was never recorded. Not counted."
                          className="inline-flex items-center rounded-full bg-muted/15 px-2 py-0.5 text-xs font-medium text-muted"
                        >
                          Test
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.paymentMethod ?? "—"}</td>
                  <td className={`${cell} text-text`}>{r.posted ? formatINR(r.ourFeeMinor) : "—"}</td>
                  <td className={`${cell} text-text`}>
                    {r.posted ? formatINR(r.processingChargeMinor) : "—"}
                  </td>
                  <td className={`${cell} font-semibold ${r.posted && r.creatorShareMinor < 0 ? "text-red-400" : "text-text"}`}>
                    {r.posted ? formatINR(r.creatorShareMinor) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {!r.live || r.orderStatus !== "captured" ? (
                      <span className="text-muted">—</span>
                    ) : r.posted ? (
                      <Pill tone="good">yes</Pill>
                    ) : (
                      <Pill tone="warn">no</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.refundStatus && <StatusBadge status={r.refundStatus} />}
                      {r.disputeStatus && <StatusBadge status={r.disputeStatus} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">{fmtTs(r.capturedAt)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-control bg-surface/60">
              <td className="px-4 py-3 text-sm font-medium text-muted" colSpan={2}>
                Live captured tips listed: {totals.tipCount}
              </td>
              <td className={`${cell} font-medium text-accent`}>{formatINR(totals.grossMinor)}</td>
              <td colSpan={2} />
              <td className={`${cell} font-medium text-text`}>{formatINR(totals.ourFeeMinor)}</td>
              <td className={`${cell} font-medium text-text`}>
                {formatINR(totals.processingChargeMinor)}
              </td>
              <td className={`${cell} font-semibold text-text`}>{formatINR(totals.creatorShareMinor)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
