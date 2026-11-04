import Link from "next/link";
import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass, FIELD_CLASS, TONE_BADGE, TONE_TEXT } from "@/components/admin/tones";
import { fmtIST } from "@/lib/admin/format";
import { getPayments, type PaymentList } from "@/lib/admin/payment-queries";
import { formatINR, getTestModeTipCount } from "@/lib/admin/finance-queries";
import { parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { adminDb } from "@/lib/admin/server-db";
import { requireAdminViewer } from "@/lib/owner-auth";
import {
  CouldNotRead,
  DefinitionNote,
  FinanceNotSetUp,
  TestModeLine,
} from "../../_components/Notices";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function PaymentLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; q?: string }>;
}) {
  await requireAdminViewer();
  const { range: rangeParam, q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);

  const db = adminDb();
  const result = db ? await getPayments(db, range, LIMIT, q) : null;
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

      <form action="/admin/finance/payments" className="flex flex-wrap gap-2">
        <input type="hidden" name="range" value={preset} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search order reference, Razorpay id, creator handle or name"
          aria-label="Search payments"
          className={`${FIELD_CLASS} w-full max-w-md`}
        />
        <button type="submit" className={buttonClass("quiet", "md")}>
          Search
        </button>
        {q && (
          <Link
            href={`/admin/finance/payments?range=${preset}`}
            className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text"
          >
            Clear
          </Link>
        )}
      </form>

      {testModeTips?.ok && <TestModeLine count={testModeTips.data} />}

      {!result ? (
        <FinanceNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead detail={result.error} />
      ) : result.data.rows.length === 0 ? (
        q ? (
          <p className="text-sm text-muted">No payment in this period matches “{q}”.</p>
        ) : (
          <AdminEmptyState
            title="No payment orders in this period"
            description="Every tip order appears here with its fee lines, ledger posting and creator share. Test-mode orders are listed as Test and never counted."
          />
        )
      ) : (
        <PaymentTable list={result.data} />
      )}
    </div>
  );
}

const cell = "px-4 py-3 text-right font-mono tabular-nums";

function Pill({ tone, children }: { tone: "good" | "warn"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}>
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
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => {
          const counted = r.live && r.orderStatus === "captured";
          return (
            <li
              key={r.orderId}
              className={`space-y-2 rounded-surface border border-control bg-surface p-4 text-sm ${r.live ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p title={r.publicRef} className="numeric truncate text-xs text-muted">{r.publicRef}</p>
                  <p className="font-medium text-text">{r.creatorName ?? "—"}</p>
                  {r.creatorHandle && <p className="text-xs text-muted">@{r.creatorHandle}</p>}
                </div>
                <p className={`numeric shrink-0 text-lg font-semibold ${counted ? "text-accent" : "text-muted"}`}>
                  {formatINR(r.grossMinor)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={r.orderStatus} />
                {!r.live && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE.neutral}`}>
                    Test
                  </span>
                )}
                {r.refundStatus && <StatusBadge status={r.refundStatus} />}
                {r.disputeStatus && <StatusBadge status={r.disputeStatus} />}
                {counted && (r.posted ? <Pill tone="good">posted</Pill> : <Pill tone="warn">not posted</Pill>)}
              </div>
              {r.posted && (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Our fee</dt>
                    <dd className="numeric text-text">{formatINR(r.ourFeeMinor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Processing</dt>
                    <dd className="numeric text-text">{formatINR(r.processingChargeMinor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Creator</dt>
                    <dd className="numeric font-semibold text-text">{formatINR(r.creatorShareMinor)}</dd>
                  </div>
                </dl>
              )}
              <p className="text-xs text-muted">
                {r.paymentMethod ?? "—"} · captured {fmtIST(r.capturedAt, "short")}
              </p>
            </li>
          );
        })}
        <li className="rounded-surface border border-control bg-raised p-4 text-sm text-muted">
          Live captured tips listed: <span className="numeric text-text">{totals.tipCount}</span> ·{" "}
          <span className="numeric text-accent">{formatINR(totals.grossMinor)}</span> gross ·{" "}
          creators get <span className="numeric text-text">{formatINR(totals.creatorShareMinor)}</span>
        </li>
      </ul>

      <div data-lenis-prevent className="hidden max-h-[75vh] overflow-auto rounded-surface border border-control md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Payment orders, newest first, with fees and the creator&apos;s share</caption>
          <thead className="sticky top-0 z-10 bg-raised">
            <tr className="border-b border-control">
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Order</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Gross</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Method</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Our fee</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Processing charge</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Creator share</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Posted</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Flags</th>
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Captured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control bg-surface">
            {rows.map((r) => {
              const counted = r.live && r.orderStatus === "captured";
              return (
                <tr
                  key={r.orderId}
                  className={`hover:bg-raised transition-colors ${r.live ? "" : "opacity-60"}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-muted">{r.publicRef}</p>
                    {r.providerPaymentRef && (
                      <p className="font-mono text-xs text-muted">{r.providerPaymentRef}</p>
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
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE.neutral}`}
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
                  <td className={`${cell} font-semibold ${r.posted && r.creatorShareMinor < 0 ? TONE_TEXT.bad : "text-text"}`}>
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
                  <td className="px-4 py-3 text-right text-muted">{fmtIST(r.capturedAt, "short")}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-control bg-raised">
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
