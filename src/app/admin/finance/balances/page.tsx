import { AdminEmptyState } from "@/components/admin/EmptyState";
import { MetricCard } from "@/components/admin/MetricCard";
import { getCreatorBalances, type BalancesSummary, type CreatorBalanceRow } from "@/lib/admin/balance-queries";
import { formatINR } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { HOLD_DAYS_NEW_CREATOR, HOLD_DAYS_OTHER, HOLD_DAYS_UPI } from "@/lib/balances";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DefinitionNote, FinanceNotSetUp } from "../../_components/Notices";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// A negative balance keeps its minus sign and its colour; it is never rounded up.
function Signed({ minor }: { minor: number }) {
  return <span className={minor < 0 ? "text-red-400" : undefined}>{formatINR(minor)}</span>;
}

export default async function CreatorBalancesPage() {
  await requireOwner();
  const db = adminDb();
  const result = db ? await getCreatorBalances(db) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Balances
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">What creators are owed</h1>
        <DefinitionNote>
          Live money only, read from the ledger. Balance is everything owed to the creator. Held is
          the part still inside its waiting period ({HOLD_DAYS_UPI} days for a UPI tip,{" "}
          {HOLD_DAYS_OTHER} for any other tip, {HOLD_DAYS_NEW_CREATOR} while the creator has no
          completed payout). Available is balance less held. Nothing here moves money: no payout
          can be made from the site yet.
        </DefinitionNote>
      </div>

      {!result ? (
        <FinanceNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead detail={result.error} />
      ) : result.data.rows.length === 0 ? (
        <AdminEmptyState
          title="No balances yet"
          description="A creator appears here once a live tip has been posted to the ledger. Test-mode tips are never counted."
        />
      ) : (
        <Body summary={result.data} />
      )}
    </div>
  );
}

function Body({ summary }: { summary: BalancesSummary }) {
  const { rows } = summary;
  const sum = (pick: (r: CreatorBalanceRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const payable = rows.filter((r) => r.payableNow);

  return (
    <>
      <p className="text-xs text-muted">
        Data as of{" "}
        {summary.fetchedAt.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        IST
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Owed to creators" value={formatINR(sum((r) => r.balanceMinor))} />
        <MetricCard label="Held" value={formatINR(sum((r) => r.heldMinor))} />
        <MetricCard
          label="Available"
          value={formatINR(sum((r) => r.availableMinor))}
          accent={sum((r) => r.availableMinor) > 0}
        />
        <MetricCard
          label={`Ready for a payout (${formatINR(summary.minPayoutMinor)} or more)`}
          value={String(payable.length)}
          sub={formatINR(payable.reduce((s, r) => s + r.availableMinor, 0))}
          note="Available at least the minimum, creator active, UPI ID on file."
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Balance</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Held</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Available</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Next release</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {rows.map((r) => (
              <tr key={r.creatorId} className="transition-colors hover:bg-surface/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-text">{r.name ?? "—"}</p>
                  {r.handle && <p className="text-xs text-muted">@{r.handle}</p>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                  <Signed minor={r.balanceMinor} />
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                  {formatINR(r.heldMinor)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                  {formatINR(r.availableMinor)}
                </td>
                <td className="px-4 py-3 text-right text-muted">{fmt(r.nextReleaseAt)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {r.balanceMinor < 0
                    ? "Owes us"
                    : r.payableNow
                      ? "Ready"
                      : r.creatorStatus !== "active"
                        ? `Creator ${r.creatorStatus}`
                        : !r.hasUpiId
                          ? "No UPI ID"
                          : r.availableMinor < summary.minPayoutMinor
                            ? "Below minimum"
                            : "—"}
                  {!r.hasCompletedPayout && r.balanceMinor >= 0 ? " · first payout" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
