import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { BuyPass } from "@/app/dashboard/plans/BuyPass";
import { DashboardShell } from "@/app/dashboard/parts/DashboardShell";
import { Msg } from "@/app/dashboard/parts/Msg";
import { paymentNotice, type OrderSummary } from "@/lib/plan-view";

// The Buy form and the payment messages with made-up prices, for the browser tests. 404 unless
// PAGE_FIXTURES=1 (only the Playwright config sets it, never Vercel). Nothing here can reach PayU:
// the form's action needs a signed-in creator and the fixture server has none.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans fixture", robots: { index: false, follow: false } };

const order = (over: Partial<OrderSummary>): OrderSummary => ({
  id: 7,
  status: "pending",
  termMonths: 1,
  amountMinor: 29900,
  livemode: true,
  createdAt: new Date("2026-11-10T06:00:00.000Z"),
  paidAt: null,
  passStartsAt: null,
  passEndsAt: null,
  payuRef: null,
  ...over,
});

export default async function PlansFixturePage({ searchParams }: { searchParams: Promise<{ early?: string; renewing?: string; notice?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { early, renewing, notice } = await searchParams;
  const isEarly = early === "1";
  const shown =
    notice === "paid" ? paymentNotice("paid", order({ status: "paid", passEndsAt: new Date("2026-12-10T06:00:00.000Z") }))
    : notice === "pending" ? paymentNotice("pending", order({}))
    : notice === "failed" ? paymentNotice("failed", order({ status: "failed" }))
    : notice === "cancelled" ? paymentNotice("cancelled", null)
    : null;
  return (
    <DashboardShell handle="fixture" live>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Paid features</h1>
        {shown && <Msg kind={shown.kind} text={shown.text} />}
        <BuyPass
          options={[
            { term: 1, amountMinor: isEarly ? 14900 : 29900, early: isEarly },
            { term: 12, amountMinor: isEarly ? 129900 : 249900, early: isEarly },
          ]}
          renewing={renewing === "1"}
          testMode={false}
        />
      </div>
    </DashboardShell>
  );
}
