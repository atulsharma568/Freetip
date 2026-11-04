import { fmtIST } from "@/lib/admin/format";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { MetricCard } from "@/components/admin/MetricCard";
import { Signed } from "@/components/admin/Signed";
import { TONE_BADGE, type Tone } from "@/components/admin/tones";
import Link from "next/link";
import { getCreatorBalances, type BalancesSummary, type CreatorBalanceRow } from "@/lib/admin/balance-queries";
import { formatINR } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { HOLD_DAYS_NEW_CREATOR, HOLD_DAYS_OTHER, HOLD_DAYS_UPI } from "@/lib/balances";
import { requireAdminViewer } from "@/lib/owner-auth";
import {
  listHref,
  pageOfRows,
  parseListQuery,
  ROWS_PER_PAGE,
  searchRows,
  type ListQuery,
} from "@/lib/admin/list-view";
import { CouldNotRead, DefinitionNote, FinanceNotSetUp } from "../../_components/Notices";
import { ListSearch } from "../../_components/ListSearch";
import { Pager } from "../../_components/PageHeader";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  return fmtIST(date, "date");
}

const PATH = "/admin/finance/balances";

export default async function CreatorBalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminViewer();
  const query = parseListQuery(await searchParams);
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
          completed payout). Available is balance less held. A payout a creator has asked for is
          already off the balance and waits on the Payouts to pay page. Nothing here moves money.
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
        <Body summary={result.data} query={query} />
      )}
    </div>
  );
}

function Body({ summary, query }: { summary: BalancesSummary; query: ListQuery }) {
  // The cards count every creator; only the table below is searched and paged.
  const { rows } = summary;
  const found = searchRows(rows, query.q, (r) => [r.name, r.handle]);
  const shown = pageOfRows(found, query.page);
  const sum = (pick: (r: CreatorBalanceRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const payable = rows.filter((r) => r.payableNow);

  return (
    <>
      <p className="text-xs text-muted">
        Data as of{" "}
        {fmtIST(summary.fetchedAt)}{" "}
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

      <ListSearch
        action={PATH}
        q={query.q}
        label="Search creators"
        placeholder="Search name or handle"
      />

      {found.length === 0 ? (
        <p className="text-sm text-muted">No creator matches “{query.q}”.</p>
      ) : (
        <div className="space-y-3">
          <Pager
            page={shown.page}
            pageSize={ROWS_PER_PAGE}
            total={shown.total}
            shown={shown.rows.length}
            noun="creator"
            hrefFor={(p) => listHref(PATH, {}, query.q, p)}
          />
          <div className="overflow-x-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-control bg-raised">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Balance</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Held</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Available</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Next release</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {shown.rows.map((r) => (
                  <tr key={r.creatorId} className="transition-colors hover:bg-raised">
                    <td className="px-4 py-3">
                      <Link href={`/admin/creators/${r.creatorId}`} className="font-medium text-text hover:text-accent">
                        {r.name ?? "—"}
                      </Link>
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
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const [label, tone]: [string, Tone] =
                          r.balanceMinor < 0
                            ? ["Owes us", "bad"]
                            : r.payableNow
                              ? ["Ready", "good"]
                              : r.creatorStatus !== "active"
                                ? [`Creator ${r.creatorStatus}`, "warn"]
                                : !r.hasUpiId
                                  ? ["No UPI ID", "warn"]
                                  : r.availableMinor < summary.minPayoutMinor
                                    ? ["Below minimum", "neutral"]
                                    : ["—", "neutral"];
                        return (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${TONE_BADGE[tone]}`}>{label}</span>
                            {!r.hasCompletedPayout && r.balanceMinor >= 0 && (
                              <span className="rounded-full bg-raised px-2 py-0.5 text-muted">First payout</span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
