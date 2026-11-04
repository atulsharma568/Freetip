import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fixturesEnabled } from "@/lib/page-fixtures";
import { PLAN_CARDS } from "@/app/dashboard/plans/cards-data";
import { PlanCards, type BuyState } from "@/app/dashboard/plans/PlanCards";
import { DashboardShell } from "@/app/dashboard/parts/DashboardShell";
import { Msg } from "@/app/dashboard/parts/Msg";
import { paymentNotice, type OrderSummary } from "@/lib/plan-view";
import { TIER_PRICES, type TierPrices } from "@/lib/pricing";

// The Buy form and the payment messages with made-up prices, for the browser tests. 404 unless
// PAGE_FIXTURES=1 (only the Playwright config sets it, never Vercel). Nothing here can reach PayU:
// the form's action needs a signed-in creator and the fixture server has none.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans fixture", robots: { index: false, follow: false } };

const order = (over: Partial<OrderSummary>): OrderSummary => ({
  id: 7,
  status: "pending",
  plan: "creator",
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

const SOON: BuyState = { kind: "soon" };

// Quotes from the real prices: the early price when asked, the normal price otherwise. `covered1`
// marks a month of Starter that a running Creator pass already includes (?covered=1).
function open(p: TierPrices, early: boolean, renewing: boolean, covered1: boolean): BuyState {
  const amount = (term: 1 | 12) => (early ? (term === 12 ? p.early.yearly : p.early.monthly) : term === 12 ? p.yearly : p.monthly) * 100;
  return {
    kind: "open",
    renewing,
    options: {
      1: { term: 1, amountMinor: amount(1), early, covered: covered1 },
      12: { term: 12, amountMinor: amount(12), early, covered: false },
    },
  };
}

export default async function PlansFixturePage({ searchParams }: { searchParams: Promise<{ early?: string; renewing?: string; notice?: string; buy?: string; covered?: string }> }) {
  if (!fixturesEnabled()) notFound();
  const { early, renewing, notice, buy, covered } = await searchParams;
  const isEarly = early === "1";
  const isRenewing = renewing === "1";
  // ?buy=off: nothing can be bought yet (the plan cards show the off button).
  const off = buy === "off";
  // ?covered=1: a Creator pass already covers a month of Starter.
  const isCovered = covered === "1";
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
        <PlanCards
          testMode={false}
          starter={{ ...PLAN_CARDS.starter, buy: off ? SOON : open(TIER_PRICES.starter, isEarly, isRenewing, isCovered), earlyOpen: off ? null : isEarly, status: isRenewing ? "Your Starter plan runs until 10 December 2026, 11:30 am IST." : null }}
          creator={{ ...PLAN_CARDS.creator, buy: off ? SOON : open(TIER_PRICES.creator, isEarly, isRenewing, false), earlyOpen: off ? null : isEarly }}
          custom={PLAN_CARDS.custom}
        />
      </div>
    </DashboardShell>
  );
}
