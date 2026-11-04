import { fmtIST } from "@/lib/admin/format";
import Link from "next/link";
import { Suspense } from "react";
import { DateRangeNav } from "@/components/admin/DateRangeNav";
import { MetricCard } from "@/components/admin/MetricCard";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getFinanceSummary, getTurnover, formatINR, type FinanceSummary, type Turnover } from "@/lib/admin/finance-queries";
import { financialYearIST, parsePreset, rangeFromPreset } from "@/lib/admin/date-range";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import {
  CouldNotRead,
  DefinitionNote,
  FinanceNotSetUp,
  TestModeLine,
} from "../_components/Notices";

export const dynamic = "force-dynamic";

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-text">{children}</h2>;
}

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireOwner();
  const { range: rangeParam } = await searchParams;
  const preset = parsePreset(rangeParam);
  const range = rangeFromPreset(preset);

  const db = adminDb();
  const [result, turnover] = db
    ? await Promise.all([getFinanceSummary(db, range), getTurnover(db, financialYearIST())])
    : [null, null];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Finance</p>
        <h1 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">Money movement</h1>
        <DefinitionNote>
          Money figures count live Razorpay payments only; test-mode payments are not counted.
        </DefinitionNote>
      </div>

      <Suspense>
        <DateRangeNav current={preset} />
      </Suspense>

      {!result ? (
        <FinanceNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead detail={result.error} />
      ) : (
        <FinanceBody summary={result.data} turnover={turnover} />
      )}
    </div>
  );
}

function FinanceBody({ summary, turnover }: { summary: FinanceSummary; turnover: Awaited<ReturnType<typeof getTurnover>> | null }) {
  const { notPosted } = summary;
  const noLiveTips =
    summary.tipsCapturedCount === 0 && notPosted.count === 0 && summary.owedToCreatorsMinor === 0;

  return (
    <>
      <p className="text-xs text-muted">
        Data as of{" "}
        {fmtIST(summary.fetchedAt)}{" "}
        IST
      </p>
      <TestModeLine count={summary.testModeTipCount} />

      <section className="space-y-3">
        <Heading>Tips captured (live), this period</Heading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Tips captured" value={String(summary.tipsCapturedCount)} />
          <MetricCard
            label="Gross captured"
            value={formatINR(summary.grossCapturedMinor)}
            accent={summary.grossCapturedMinor > 0}
          />
        </div>
      </section>

      <TurnoverSection turnover={turnover} />

      <section className="space-y-3">
        <Heading>Posted to the books, this period</Heading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Creators' share"
            value={formatINR(summary.creatorShareMinor)}
            note="Credited to creators on the ledger. Refunds, disputes and payouts are not recorded yet."
          />
          <MetricCard
            label="Our fee"
            value={formatINR(summary.ourFeeMinor)}
            note="Platform fee on the ledger"
          />
          <MetricCard
            label="Processing charge collected"
            value={formatINR(summary.processingChargeMinor)}
            note="The flat 2.75% charge taken from creators. Razorpay's own charge is not posted yet; once it is, what is left here is our gain or loss on processing."
          />
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Balances now, all time</Heading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Owed to creators"
            value={formatINR(summary.owedToCreatorsMinor)}
            note="A negative figure means creators owe us."
          />
          <MetricCard
            label="Posted, not yet settled (gross)"
            value={formatINR(summary.razorpayOwesUsMinor)}
            note="The whole tip amount of posted tips. Razorpay pays out net of its own charge (about 2% plus GST), so less than this will reach the bank. Settlements are not recorded yet."
          />
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Not yet posted, all time</Heading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Captured live tips with no ledger posting"
            value={String(notPosted.count)}
            sub={formatINR(notPosted.grossMinor)}
            accent={notPosted.count > 0}
          />
        </div>
        {notPosted.count > 0 && (
          <p className="text-sm text-muted">
            These tips are not in the figures under &ldquo;Posted to the books&rdquo; yet. Post them from{" "}
            <Link href="/admin/reconciliation" className="text-accent underline underline-offset-4">
              Reconciliation
            </Link>
            .
          </p>
        )}
      </section>

      <p className="max-w-2xl text-xs text-muted">
        Refunds, disputes, settlements and creator payouts are not recorded by the site yet, so they
        are not shown here.
      </p>

      {noLiveTips && (
        <AdminEmptyState
          title="No live tips yet"
          description="No live-mode tip has been captured, posted or owed. Test-mode tips are never counted. Figures appear here once real keys are live and a real tip is paid."
        />
      )}
    </>
  );
}

// How close we are to the GST registration trigger, for the financial year so far. Not tied to
// the date range above.
function TurnoverSection({ turnover }: { turnover: Awaited<ReturnType<typeof getTurnover>> | null }) {
  if (!turnover) return null;
  if (!turnover.ok) return <CouldNotRead detail={turnover.error} />;
  const t: Turnover = turnover.data;
  const pct = Math.min(100, Math.round((t.countedMinor / t.triggerMinor) * 100));
  const word =
    t.countedMinor >= t.triggerMinor
      ? "The trigger is reached. Register for GST within 30 days of the day it was crossed."
      : pct >= 80
        ? "Close to the trigger. Start the GST registration paperwork now."
        : "Below the trigger. No registration is needed yet.";
  return (
    <section className="space-y-3">
      <Heading>GST trigger, {t.yearLabel} so far</Heading>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross tips" value={formatINR(t.grossTipsMinor)} note="Live tips captured this financial year (the cautious reading)." />
        <MetricCard label="Our fees and charges" value={formatINR(t.feesMinor)} note={`Platform fee plus the processing charge, on the ledger, plus pass sales (${formatINR(t.planSalesMinor)} this year).`} />
        <MetricCard label="Counted against the trigger" value={`${pct}%`} sub={`${formatINR(t.countedMinor)} of ${formatINR(t.triggerMinor)}`} accent={pct >= 80} note="The larger of the two figures above." />
      </div>
      <p className="max-w-2xl text-sm text-muted">{word} A reading of public sources, not an accountant&rsquo;s advice; see docs/rules-check.md section 2.</p>
    </section>
  );
}
