import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { buildCatalogue } from "@/lib/plan-catalogue";
import { planFeatures } from "@/lib/plans";
import { priceView } from "@/lib/pricing";
import { SITE_NAME } from "@/lib/site";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { Tile } from "../parts/Tile";
import { pillOutline } from "../parts/styles";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Paid features: ${SITE_NAME}`,
  robots: { index: false },
};

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

export default async function PlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<
    { handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`select handle, paid_features, creator_status from users where google_id = ${googleId}`;
  if (!user?.handle) redirect("/dashboard");

  const groups = buildCatalogue(planFeatures(user));
  const all = groups.flatMap((g) => g.items);
  const onCount = all.filter((i) => i.on).length;
  const prices = priceView();

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

        <Tile id="plan" level={2} title="The paid plan">
          <div className="space-y-4">
            {prices ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <p>
                    <span className="numeric text-3xl font-semibold text-text">{rupees(prices.monthly)}</span>
                    <span className="text-sm text-muted"> a month</span>
                  </p>
                  <p>
                    <span className="numeric text-3xl font-semibold text-text">{rupees(prices.yearly)}</span>
                    <span className="text-sm text-muted"> a year</span>
                    {prices.yearlySavingPercent > 0 && (
                      <span className="ml-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">
                        Save {prices.yearlySavingPercent}%
                      </span>
                    )}
                  </p>
                </div>
                {prices.early && (
                  <p className="text-sm text-text">
                    Early plan for the first {prices.early.seats} creators: {rupees(prices.early.monthly)} a month
                    or {rupees(prices.early.yearly)} a year, for as long as you keep renewing.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-base text-text">The price will be announced soon.</p>
            )}
            <p className="text-sm text-muted">
              {onCount > 0
                ? `You have ${onCount} of ${all.length} paid features switched on.`
                : "You have no paid features switched on yet."}
            </p>
            <button type="button" disabled aria-describedby="plan-buy-note" className={pillOutline}>
              Buying opens soon
            </button>
            <p id="plan-buy-note" className="text-xs text-muted">
              You will be able to pay here and your features switch on straight away.
            </p>
          </div>
        </Tile>

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
                        In the paid plan
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
