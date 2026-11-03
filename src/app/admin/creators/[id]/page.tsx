import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAuditPage, getLastFeatureChange } from "@/lib/admin/audit-queries";
import { getCreatorDetail } from "@/lib/admin/creator-detail";
import { getFeeHistory } from "@/lib/admin/fee-queries";
import { describeSetting, getCreatorRates } from "@/lib/fee-rates";
import { CLOSED_EMAIL_DOMAIN } from "@/lib/account-close";
import { fmtIST } from "@/lib/admin/format";
import { formatINR, load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import type { Query } from "@/lib/accrual";
import { getPageSummary } from "@/lib/page-doc/store";
import { requireOwner } from "@/lib/owner-auth";
import { setCreatorFeatures } from "@/app/actions/admin";
import { setCreatorFeeRates } from "@/app/actions/fees";
import { copyCreatorPage, resetCreatorPage, restoreCreatorPage } from "@/app/actions/page-doc";
import { CouldNotRead, DatabaseNotSetUp } from "../../_components/Notices";
import { CreatorActions } from "../../_components/CreatorActions";
import { PageHeader } from "../../_components/PageHeader";
import { FeeRatesBox } from "./FeeRatesBox";
import { FeaturesForm } from "./FeaturesForm";
import { TipPageBox } from "./TipPageBox";

export const dynamic = "force-dynamic";

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const creatorId = Number(id);
  const db = adminDb();
  if (!db) return <DatabaseNotSetUp />;
  const result = await getCreatorDetail(db, creatorId);
  if (!result.ok) return <CouldNotRead message="Could not read this creator." detail={result.error} />;
  const c = result.data;
  if (!c) notFound();

  // Each of these is read apart so one missing migration only affects its own box.
  const [featuresRead, lastChange, audit, pageRead, ratesRead, feeHistory, sourcesRead] = await Promise.all([
    load("the paid features", async () => {
      const [f] = await db<{ paid_features: string[] | null }[]>`select paid_features from users where id = ${creatorId}`;
      return f?.paid_features ?? [];
    }),
    getLastFeatureChange(db, creatorId),
    getAuditPage(db, { creatorId }, 5),
    load("the tip page", () => getPageSummary(db as unknown as Query, creatorId)),
    load("the fee rates", () => getCreatorRates(db, creatorId)),
    getFeeHistory(db, creatorId),
    // The creators whose page can be copied as a template; the box works without the list.
    load("the creators to copy from", () =>
      db<{ id: string; handle: string; custom: boolean }[]>`
        select id::text as id, handle,
               (paid_features @> array['pageBuilder']::text[] and page_published is not null) as custom
        from users where handle is not null and creator_status = 'active' and id <> ${creatorId}
        order by handle limit 200
      `,
    ),
  ]);
  const copySources = sourcesRead.ok ? sourcesRead.data.map((r) => ({ id: Number(r.id), handle: r.handle, custom: r.custom })) : [];

  const closed = c.email.endsWith(CLOSED_EMAIL_DOMAIN);
  const status = c.creatorStatus as "pending" | "active" | "suspended";
  const enc = encodeURIComponent;

  const rows: [string, string][] = [
    ["Email", c.email],
    ["Handle", c.handle ?? "not set"],
    ["Previous handle", c.previousHandle ? `${c.previousHandle} (changed once, stays reserved)` : "—"],
    ["Legal name", c.legalName ?? "—"],
    ["UPI ID", c.upiVpa ?? "—"],
    ["YouTube channel", c.ytChannelName ?? "—"],
    ["Joined", fmtIST(c.createdAt)],
    ["Captured tips", `${c.capturedCount} (${formatINR(c.capturedMinor)} gross)`],
  ];

  const linkClass =
    "inline-flex min-h-9 items-center rounded-full border border-control px-4 text-xs text-muted transition-colors hover:border-text/40 hover:text-text";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Creator"
        title={c.name ?? c.email}
        back={{ href: "/admin/creators", label: "Creators" }}
        note={
          <>
            Gross is what fans paid, from the tips table. What the creator is owed is on{" "}
            <Link href="/admin/finance/balances" className="underline">
              Balances
            </Link>
            .
          </>
        }
      />

      <section aria-label="Status and actions" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={closed ? "closed" : c.creatorStatus} />
          <StatusBadge status={c.onboardingState} />
          <span className="text-xs text-muted">payout setup</span>
        </div>
        <CreatorActions
          id={c.id}
          handle={c.handle}
          creatorStatus={status}
          onboardingState={c.onboardingState}
          closed={closed}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/audit?creator=${c.id}`} className={linkClass}>
            Audit history
          </Link>
          {c.handle && (
            <Link href={`/admin/finance/payments?q=${enc(c.handle)}`} className={linkClass}>
              Payments this month
            </Link>
          )}
          {!closed && (
            <Link href={`/admin/messages?q=${enc(c.email)}`} className={linkClass}>
              Messages from this email
            </Link>
          )}
        </div>
      </section>

      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="break-all text-text">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text">Fee rates</h2>
          <p className="max-w-2xl text-xs text-muted">
            What this creator pays out of each tip: our platform fee and the processing charge. By default every creator follows the
            site rates, which you change for everyone on the{" "}
            <Link href="/admin/fees" className="underline">
              Fee rates
            </Link>{" "}
            page. Fans always pay exactly the tip.
          </p>
        </div>
        {!ratesRead.ok ? (
          <CouldNotRead message="Could not read the fee rates. Run migration 0054 in Neon." detail={ratesRead.error} />
        ) : (
          <FeeRatesBox
            key={`${ratesRead.data.site.platformBps}-${ratesRead.data.site.processingBps}-${ratesRead.data.override?.platformBps}-${ratesRead.data.override?.processingBps}`}
            action={setCreatorFeeRates.bind(null, c.id)}
            site={ratesRead.data.site}
            override={ratesRead.data.override}
            history={
              feeHistory.ok
                ? feeHistory.data.map((h) => ({
                    at: fmtIST(h.at),
                    from: describeSetting(h.before),
                    to: describeSetting(h.after),
                    reason: h.reason,
                  }))
                : []
            }
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text">Paid features</h2>
          <p className="max-w-2xl text-xs text-muted">
            Everything is off until you tick it here, for this creator only. Creators never see a plan or a price; a
            feature that is off is simply not shown to them. Planned features are listed so you can see what is coming,
            but cannot be switched on.
          </p>
        </div>
        {!featuresRead.ok ? (
          <CouldNotRead message="Could not read the switches. Run migration 0035 in Neon." detail={featuresRead.error} />
        ) : (
          <FeaturesForm
            key={featuresRead.data.join(",")}
            action={setCreatorFeatures.bind(null, c.id)}
            granted={featuresRead.data}
            lastChanged={
              !lastChange.ok ? "(could not read the audit history)" : lastChange.data ? fmtIST(lastChange.data.at) : null
            }
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text">Custom tip page</h2>
          <p className="max-w-2xl text-xs text-muted">
            A custom page is set up by you for this creator and shown only while the &ldquo;Custom tip page&rdquo; switch
            above is on. The creator cannot edit it. Open the editor to change it, swap it with the previous version, or go back to the normal page.
          </p>
        </div>
        {!pageRead.ok ? (
          <CouldNotRead message="Could not read the tip page settings. Run migration 0051 in Neon." detail={pageRead.error} />
        ) : (
          <TipPageBox
            summary={pageRead.data}
            editHref={`/admin/creators/${c.id}/page`}
            overlaysHref={`/admin/creators/${c.id}/overlays`}
            restoreAction={restoreCreatorPage.bind(null, c.id)}
            resetAction={resetCreatorPage.bind(null, c.id)}
            copyAction={copyCreatorPage.bind(null, c.id)}
            copySources={copySources}
          />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text">Latest audit events</h2>
          <Link href={`/admin/audit?creator=${c.id}`} className="text-xs text-muted underline hover:text-text">
            See all
          </Link>
        </div>
        {!audit.ok ? (
          <CouldNotRead message="Could not read the audit history." detail={audit.error} />
        ) : audit.data.rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded for this creator yet.</p>
        ) : (
          <ul className="divide-y divide-control rounded-surface border border-control bg-surface text-sm">
            {audit.data.rows.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="numeric text-text">{e.action}</span>
                <span className="text-muted">{e.reason ?? ""}</span>
                <span className="text-muted">{fmtIST(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Latest tips</h2>
        {c.recentTips.length === 0 ? (
          <AdminEmptyState title="No tips yet" description="Tips to this creator appear here." />
        ) : (
          <ul className="divide-y divide-control rounded-surface border border-control bg-surface text-sm">
            {c.recentTips.map((t) => (
              <li key={t.reference} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="numeric text-muted">{t.reference}</span>
                <span className="text-text">{t.fanName ?? "Anonymous"}</span>
                <span className="numeric text-text">{formatINR(t.grossMinor)}</span>
                <StatusBadge status={t.status} />
                <span className="text-muted">{fmtIST(t.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Payouts</h2>
        {c.payouts.length === 0 ? (
          <p className="text-sm text-muted">None. The site does not send payouts yet.</p>
        ) : (
          <ul className="divide-y divide-control rounded-surface border border-control bg-surface text-sm">
            {c.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="numeric text-text">{formatINR(p.amountMinor)}</span>
                <StatusBadge status={p.status} />
                <span className="text-muted">{fmtIST(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
