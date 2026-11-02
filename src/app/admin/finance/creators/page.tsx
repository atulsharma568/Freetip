import { Signed } from "@/components/admin/Signed";
import Link from "next/link";
import { fmtIST } from "@/lib/admin/format";
import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getCreatorEarnings, type CreatorEarningsRow } from "@/lib/admin/creator-queries";
import { formatINR, getTestModeTipCount } from "@/lib/admin/finance-queries";
import { requireOwner } from "@/lib/owner-auth";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { adminDb } from "@/lib/admin/server-db";
import {
  listHref,
  pageOfRows,
  parseListQuery,
  ROWS_PER_PAGE,
  searchRows,
  type ListQuery,
} from "@/lib/admin/list-view";
import {
  CouldNotRead,
  DefinitionNote,
  FinanceNotSetUp,
  TestModeLine,
} from "../../_components/Notices";
import { ListSearch } from "../../_components/ListSearch";
import { Pager } from "../../_components/PageHeader";

export const dynamic = "force-dynamic";

function fmt(date: Date | null): string {
  return fmtIST(date, "date");
}

export default async function CreatorEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; q?: string; page?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const rangeParam = params.range;
  const query = parseListQuery(params);
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);

  const db = adminDb();
  const result = db ? await getCreatorEarnings(db, range) : null;
  const testModeTips = db ? await getTestModeTipCount(db, range) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance · Creator earnings
        </p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
          Per-creator breakdown
        </h1>
        <DefinitionNote>
          Live Razorpay payments only. Share and fee are what the ledger posted in the period; owed
          now is the creator&apos;s whole balance on the ledger and can be negative.
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
      ) : result.data.length === 0 ? (
        <AdminEmptyState
          title="No creator earnings yet"
          description="Creators with a live captured tip, or anything owed to them on the ledger, appear here. Test-mode tips are not counted."
        />
      ) : (
        <CreatorTable rows={result.data} query={query} range={preset} />
      )}
    </div>
  );
}

const PATH = "/admin/finance/creators";

function CreatorTable({ rows: all, query, range }: { rows: CreatorEarningsRow[]; query: ListQuery; range: string }) {
  // The footer adds up every creator that matches the search (everyone when there is none),
  // not only the page on screen.
  const rows = searchRows(all, query.q, (r) => [r.name, r.handle, r.ytChannelName]);
  const shown = pageOfRows(rows, query.page);
  const keep = { range };
  const sum = (pick: (r: CreatorEarningsRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

  return (
    <div className="space-y-3">
      <ListSearch
        action={PATH}
        q={query.q}
        keep={keep}
        label="Search creators"
        placeholder="Search name, handle or channel"
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No creator matches “{query.q}”.</p>
      ) : (
        <>
          <Pager
            page={shown.page}
            pageSize={ROWS_PER_PAGE}
            total={shown.total}
            shown={shown.rows.length}
            noun="creator"
            hrefFor={(p) => listHref(PATH, keep, query.q, p)}
          />
          <div className="overflow-x-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-control bg-raised">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Tips</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Gross</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Creator share</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Our fee</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Owed now</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Last tip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {shown.rows.map((r) => (
                  <tr key={r.creatorId} className="hover:bg-raised transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/creators/${r.creatorId}`} className="font-medium text-text hover:text-accent">
                        {r.name ?? "—"}
                      </Link>
                      {r.handle && <p className="text-xs text-muted">@{r.handle}</p>}
                      {r.ytChannelName && <p className="text-xs text-muted">{r.ytChannelName}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">{r.tipCount}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                      {formatINR(r.grossMinor)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                      <Signed minor={r.creatorShareMinor} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                      <Signed minor={r.ourFeeMinor} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                      <Signed minor={r.owedNowMinor} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{fmt(r.lastTipAt)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-control bg-raised">
                  <td className="px-4 py-3 text-sm font-medium text-muted">
                    {rows.length} creator{rows.length !== 1 ? "s" : ""}
                    {query.q ? " matching" : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                    {sum((r) => r.tipCount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-accent">
                    {formatINR(sum((r) => r.grossMinor))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                    <Signed minor={sum((r) => r.creatorShareMinor)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-text">
                    <Signed minor={sum((r) => r.ourFeeMinor)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-text">
                    <Signed minor={sum((r) => r.owedNowMinor)} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
