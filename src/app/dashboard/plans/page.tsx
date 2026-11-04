import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { configuredOwnerGoogleIds, isOwnerGoogleId } from "@/lib/owner-auth";
import { payuConfig } from "@/lib/payu";
import { buildCatalogue, type TierKey } from "@/lib/plan-catalogue";
import { quotePlan } from "@/lib/plan-orders";
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
import { pillOutline } from "../parts/styles";
import Link from "next/link";
import { PendingRefresh } from "./PendingRefresh";
import { PLAN_CARDS } from "./cards-data";
import { PlanCards, type BuyState } from "./PlanCards";

const TIER_LABEL: Record<TierKey, string> = { starter: "Starter", creator: "Creator", custom: "Custom page" };

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

  const [user] = await db<
    { id: string; handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`select id::text, handle, paid_features, creator_status from users where google_id = ${googleId}`;
  if (!user?.handle) redirect("/dashboard");

  const groups = buildCatalogue(planFeatures(user));
  const all = groups.flatMap((g) => g.items);
  const onCount = all.filter((i) => i.on).length;

  // Buying: the orders, the running passes and what each term of each plan costs this creator. Read
  // apart so the page still opens before migrations 0055 and 0056 are run (then there is nothing to
  // show but the features).
  const config = payuConfig();
  const isOwner = isOwnerGoogleId(googleId, configuredOwnerGoogleIds());
  let latest: OrderSummary | null = null;
  let payments: OrderSummary[] = [];
  const until: Record<PlanKey, Date | null> = { starter: null, creator: null };
  const buy: Record<PlanKey, BuyState> = { starter: { kind: "soon" }, creator: { kind: "soon" } };
  const earlyOpen: Record<PlanKey, boolean | null> = { starter: null, creator: null };
  try {
    const ledger = db as unknown as LedgerDb;
    const creatorId = Number(user.id);
    const [passRow] = await db<{ starter_until: Date | null; creator_until: Date | null }[]>`
      select starter_until, creator_until from users where id = ${creatorId}`;
    until.starter = passRow?.starter_until ?? null;
    until.creator = passRow?.creator_until ?? null;
    [latest, payments] = await Promise.all([latestOrder(ledger, creatorId), paidOrders(ledger, creatorId)]);
    // Live money only once the owner has opened sales; test money only for the owner.
    if (buyingOpen(config?.mode ?? null, LIVE_SALES_OPEN, isOwner)) {
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
  const notice = paymentNotice(payment, latest);
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
            {latest?.status === "pending" && notice.kind === "info" && <PendingRefresh />}
          </div>
        )}

        <PlanCards
          testMode={config?.mode === "test"}
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
          custom={PLAN_CARDS.custom}
        />

        <Tile id="plan" level={2} title="Your plan">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {onCount > 0
                ? `You have ${onCount} of ${all.length} paid features switched on.`
                : "You have no paid features switched on yet."}
            </p>
            {passes.length === 0 ? (
              <p className="text-sm text-muted">
                {buy.starter.kind === "open" || buy.creator.kind === "open" ? "You have no running plan. Choose one above." : "You have no running plan."}
              </p>
            ) : (
              passes.map(({ plan, status }) =>
                status.state === "none" ? null : (
                  <p key={plan} className="text-sm text-text">
                    {status.state === "ending"
                      ? `Your ${PLAN_NAMES[plan]} plan ends on ${istMoment(status.endsAt)}. Add another term above: it starts when this one ends, so you lose no days.`
                      : `Your ${PLAN_NAMES[plan]} plan runs until ${istMoment(status.endsAt)}.`}
                  </p>
                ),
              )
            )}
          </div>
        </Tile>

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

        {groups.map((g, i) => (
          <section key={g.title} aria-labelledby={`plan-group-${i}`} className="space-y-3">
            <div className="space-y-1">
              <h2 id={`plan-group-${i}`} className="text-sm font-medium uppercase tracking-widest text-muted">
                {g.title}
              </h2>
              <p className="text-sm text-muted">{g.blurb}</p>
            </div>
            <ul className="space-y-3">
              {g.items.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-base font-medium text-text">{item.title}</h3>
                    <p className="text-sm text-muted">{item.benefit}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {item.on ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">
                          <Check size={12} weight="bold" aria-hidden="true" />
                          On for you
                        </span>
                        {item.href && (
                          <Link href={item.href} className={pillOutline}>
                            Open
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full border border-control px-3 py-1 text-xs text-muted">
                        {item.tier ? `In ${TIER_LABEL[item.tier]}` : "In the paid plan"}
                        {item.beta ? " · Beta" : ""}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DashboardShell>
  );
}
