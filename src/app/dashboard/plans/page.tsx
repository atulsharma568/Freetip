import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { configuredOwnerGoogleIds, isOwnerGoogleId } from "@/lib/owner-auth";
import { razorpayConfig } from "@/lib/razorpay-plan";
import { buildCatalogue, buildComparison } from "@/lib/plan-catalogue";
import { expireOne, quotePlan, syncRunningPasses } from "@/lib/plan-orders";
import { settleOwnOrders } from "@/lib/plan-settle";
import {
  istDay,
  istMoment,
  latestOrder,
  paidOrders,
  buyingOpen,
  passStatus,
  paymentNotice,
  receiptNumber,
  rupees as rupeesOf,
  termWords,
  type OrderSummary,
} from "@/lib/plan-view";
import { planFeatures } from "@/lib/plans";
import { LIVE_SALES_OPEN, PLAN_KEYS, PLAN_NAMES, TIER_PRICES, type PlanKey } from "@/lib/pricing";
import { SITE_NAME } from "@/lib/site";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { Msg } from "../parts/Msg";
import { Tile } from "../parts/Tile";
import Link from "next/link";
import { PendingRefresh } from "./PendingRefresh";
import { PLAN_CARDS } from "./cards-data";
import { PlanCards, type BuyState } from "./PlanCards";
import { PlanTable } from "./PlanTable";
import { OneTimeExtras } from "./OneTimeExtras";

export const metadata: Metadata = {
  title: `Paid features: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [account] = await db<{ id: string; handle: string | null; creator_status: string }[]>`
    select id::text, handle, creator_status from users where google_id = ${googleId}`;
  if (!account?.handle) redirect("/dashboard");

  const config = razorpayConfig();
  const ledger = db as unknown as LedgerDb;
  const creatorId = Number(account.id);
  // Before anything is read: ask Razorpay about this creator's own unsettled orders, so a payment whose
  // popup reply and webhook were both lost is switched on now and not at the daily job; switch off a plan
  // that has just ended; and give a running plan the features it lists today. Each is safe to repeat
  // and none can stop the page opening (before migrations 0055 to 0057 they only log).
  const settled = await settleOwnOrders(creatorId);
  await expireOne(ledger, creatorId).catch((err: unknown) => {
    console.error("Plans page: could not switch off an ended plan:", err instanceof Error ? err.message : err);
  });
  await syncRunningPasses(ledger, new Date(), { creatorId }).catch((err: unknown) => {
    console.error("Plans page: could not add the plan's new features:", err instanceof Error ? err.message : err);
  });
  const [user] = await db<
    { id: string; handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`select id::text, handle, paid_features, creator_status from users where id = ${creatorId}`;
  if (!user?.handle) redirect("/dashboard");

  const features = planFeatures(user);
  const all = buildCatalogue(features).flatMap((g) => g.items);
  const onCount = all.filter((i) => i.on).length;
  const comparison = buildComparison(features);

  // Buying: the orders, the running passes and what each term of each plan costs this creator. Read
  // apart so the page still opens before migrations 0055 and 0056 are run (then there is nothing to
  // show but the features).
  const isOwner = isOwnerGoogleId(googleId, configuredOwnerGoogleIds());
  let latest: OrderSummary | null = null;
  let payments: OrderSummary[] = [];
  const until: Record<PlanKey, Date | null> = { starter: null, creator: null };
  const buy: Record<PlanKey, BuyState> = { starter: { kind: "soon" }, creator: { kind: "soon" } };
  const earlyOpen: Record<PlanKey, boolean | null> = { starter: null, creator: null };
  const buyOpen = buyingOpen(config?.mode ?? null, LIVE_SALES_OPEN, isOwner);
  try {
    const [passRow] = await db<{ starter_until: Date | null; creator_until: Date | null }[]>`
      select starter_until, creator_until from users where id = ${creatorId}`;
    until.starter = passRow?.starter_until ?? null;
    until.creator = passRow?.creator_until ?? null;
    [latest, payments] = await Promise.all([latestOrder(ledger, creatorId), paidOrders(ledger, creatorId)]);
    // Live money once the owner has opened sales (and always for the owner); test money only for the owner.
    if (buyOpen) {
      for (const plan of PLAN_KEYS) {
        const quote = await quotePlan(ledger, creatorId, plan, TIER_PRICES[plan]);
        if (!quote) continue;
        buy[plan] = {
          kind: "open",
          options: { 1: { term: 1, ...quote[1] }, 12: { term: 12, ...quote[12] } },
          renewing: passStatus(until[plan]).state !== "none",
        };
        earlyOpen[plan] = quote[1].early || quote[12].early;
      }
    }
  } catch (err) {
    console.error("Plans page: could not read orders (migrations 0055 and 0056 run?)", err instanceof Error ? err.message : err);
  }
  // A payment that was settled by this very page load is said so even when the address has no hint
  // (the popup's reply was lost, or the creator came back by another route).
  const hint = payment ?? (settled && settled.activated > 0 ? "paid" : undefined);
  const notice = paymentNotice(hint, latest);
  const passes = PLAN_KEYS.map((plan) => ({ plan, status: passStatus(until[plan]) })).filter((p) => p.status.state !== "none");
  const cardStatus = (plan: PlanKey): string | null => {
    const st = passStatus(until[plan]);
    if (st.state === "none") return null;
    return st.state === "ending"
      ? `Your ${PLAN_NAMES[plan]} plan ends on ${istMoment(st.endsAt)}. Add a term here: it starts when this one ends, so you lose no days.`
      : `Your ${PLAN_NAMES[plan]} plan runs until ${istMoment(st.endsAt)}.`;
  };
  const creatorRunning = passStatus(until.creator).state !== "none";

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pb-24 pt-4">
        <DashboardNav current="plans" />
        <div className="space-y-3">
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Paid features</h1>
          <p className="text-pretty text-base text-muted">
            Tips, the OBS alert, sounds, goals and the recap are free for every creator. These extras are for
            creators who want their alerts, tip page and stream to look and work their own way. Our fee on a
            tip stays the same on every plan.
          </p>
        </div>

        {notice && (
          <div className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
            <Msg kind={notice.kind} text={notice.text} />
            {notice.kind === "error" && (
              <p className="mt-3 text-sm">
                <Link href="/contact" className="text-text underline decoration-line hover:decoration-accent">
                  Contact us
                </Link>
              </p>
            )}
            {latest?.status === "pending" && notice.kind === "info" && hint !== "cancelled" && <PendingRefresh />}
          </div>
        )}

        <Tile id="plan" level={2} title="Your plan">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {onCount > 0
                ? `You have ${onCount} of ${all.length} paid features switched on.`
                : "You have no paid features switched on yet."}
            </p>
            {passes.length === 0 ? (
              <p className="text-sm text-muted">
                {buy.starter.kind === "open" || buy.creator.kind === "open" ? "You have no running plan. Choose one below." : "You have no running plan."}
              </p>
            ) : (
              passes.map(({ plan, status }) =>
                status.state === "none" ? null : (
                  <p key={plan} className="text-sm text-text">
                    {status.state === "ending"
                      ? `Your ${PLAN_NAMES[plan]} plan ends on ${istMoment(status.endsAt)}. Add another term below: it starts when this one ends, so you lose no days.`
                      : `Your ${PLAN_NAMES[plan]} plan runs until ${istMoment(status.endsAt)}.`}
                  </p>
                ),
              )
            )}
          </div>
        </Tile>

        <PlanCards
          testMode={config?.mode === "test"}
          liveOwnerTest={config?.mode === "live" && !LIVE_SALES_OPEN && isOwner}
          showPrices={buyOpen}
          starter={{
            ...PLAN_CARDS.starter,
            buy: buy.starter,
            status: cardStatus("starter"),
            earlyOpen: earlyOpen.starter,
            note: creatorRunning
              ? "Your Creator plan already includes everything in Starter. A Starter term only adds anything after Creator ends."
              : null,
          }}
          creator={{ ...PLAN_CARDS.creator, buy: buy.creator, status: cardStatus("creator"), earlyOpen: earlyOpen.creator }}
        />

        <PlanTable groups={comparison.groups} handPicked={comparison.handPicked} />

        <OneTimeExtras showPrices={buyOpen} />

        {payments.length > 0 && (
          <Tile id="payments" level={2} title="Your payments">
            <ul className="divide-y divide-line/60">
              {payments.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="min-w-0 text-sm text-text">
                    <span className="numeric font-medium">{rupeesOf(o.amountMinor)}</span> for {PLAN_NAMES[o.plan]}, {termWords(o.termMonths)}
                    <span className="text-muted">
                      {" "}
                      · paid {istDay(o.paidAt ?? o.createdAt)}
                      {!o.livemode ? " · test payment" : ""}
                      {o.endedAt ? " · plan ended early" : ""}
                    </span>
                  </p>
                  <Link href={`/dashboard/plans/receipt/${o.id}`} className="text-sm text-text underline decoration-line hover:decoration-accent">
                    Receipt {receiptNumber(o.id)}
                  </Link>
                </li>
              ))}
            </ul>
          </Tile>
        )}
      </div>
    </DashboardShell>
  );
}
