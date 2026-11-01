import { fmtIST } from "@/lib/admin/format";
import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getSettlements, type SettlementRow } from "@/lib/admin/payment-queries";
import { formatINR } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DefinitionNote, FinanceNotSetUp } from "../../_components/Notices";

export const dynamic = "force-dynamic";

function fmtDate(date: Date | null): string {
  return fmtIST(date, "date");
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireOwner();
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);
  const db = adminDb();
  const result = db ? await getSettlements(db, range) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Settlements
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Razorpay settlements
        </h1>
        <p className="max-w-xl text-sm text-muted">
          Razorpay settlements are separate from creator payouts. A settlement is money
          arriving in Freetip&apos;s bank account; a payout is Freetip transferring the
          creator&apos;s share to them.
        </p>
        <DefinitionNote>
          Nothing is recorded here yet: the site does not read Razorpay&apos;s settlement reports and
          does not pay creators, so an empty list does not mean nothing was settled. The gross
          amount posted but not yet settled, according to the books, is on the Finance page.
        </DefinitionNote>
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {!result ? (
        <FinanceNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead detail={result.error} />
      ) : result.data.length === 0 ? (
        <AdminEmptyState
          title="No settlements recorded"
          description="The site does not record Razorpay settlements yet, so this list is empty whatever Razorpay has paid out. Matching settlement reports to the ledger is a later step."
        />
      ) : (
        <SettlementTable rows={result.data} />
      )}
    </div>
  );
}

function SettlementTable({ rows }: { rows: SettlementRow[] }) {
  return (
    <div className="overflow-x-auto rounded-surface border border-control">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-control bg-raised">
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Settlement ID</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Payments</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Gross</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Provider fees</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Taxes</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Net received</th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Settled</th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Expected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-control bg-surface">
          {rows.map((r) => (
            <tr key={r.settlementId} className="hover:bg-raised transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-muted">
                {r.providerRef}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                {r.paymentCount > 0 ? r.paymentCount : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                {formatINR(r.grossMinor)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                {r.feesMinor > 0 ? formatINR(r.feesMinor) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                {r.taxesMinor > 0 ? formatINR(r.taxesMinor) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                {formatINR(r.netMinor)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 text-right text-muted">
                {fmtDate(r.settledAt)}
              </td>
              <td className="px-4 py-3 text-right text-muted">
                {fmtDate(r.expectedAt)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-control bg-raised">
            <td className="px-4 py-3 text-sm font-medium text-muted">
              {rows.length} batch{rows.length !== 1 ? "es" : ""}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
              {rows.reduce((s, r) => s + r.paymentCount, 0)}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-accent">
              {formatINR(rows.reduce((s, r) => s + r.grossMinor, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
              {formatINR(rows.reduce((s, r) => s + r.feesMinor, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
              {formatINR(rows.reduce((s, r) => s + r.taxesMinor, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
              {formatINR(rows.reduce((s, r) => s + r.netMinor, 0))}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
