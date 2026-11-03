import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { FEE_TABS, getFeeOverview, parseFeeTab, type FeeTab } from "@/lib/admin/fee-queries";
import { adminDb } from "@/lib/admin/server-db";
import { describeRates, keepOfHundred } from "@/lib/fee-rates";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader, Pager } from "../_components/PageHeader";
import { CreatorFeeTable } from "./CreatorFeeTable";
import { SiteRatesForm } from "./SiteRatesForm";

export const dynamic = "force-dynamic";

type Params = { q?: string; tab?: string; page?: string };

export default async function AdminFeesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tab = parseFeeTab(params.tab);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const header = (
    <PageHeader
      eyebrow="Money"
      title="Fee rates"
      note="What each creator pays out of a tip: our platform fee and the processing charge. A change only reaches tips made after it; every earlier tip keeps the rate it was made under. Fans always pay exactly the tip."
    />
  );

  const db = adminDb();
  if (!db) {
    return (
      <div className="space-y-8">
        {header}
        <DatabaseNotSetUp />
      </div>
    );
  }

  const result = await getFeeOverview(db, { q, tab, page });
  if (!result.ok) {
    return (
      <div className="space-y-8">
        {header}
        <CouldNotRead message="Could not read the fee rates. Run migration 0054 in Neon." detail={result.error} />
      </div>
    );
  }
  const o = result.data;

  const hrefFor = (next: { tab?: FeeTab; page?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("tab", next.tab ?? tab);
    if ((next.page ?? 1) > 1) sp.set("page", String(next.page));
    return `/admin/fees?${sp.toString()}`;
  };

  return (
    <div className="space-y-10">
      {header}

      <section className="space-y-3" aria-labelledby="site-rates-heading">
        <div className="space-y-1">
          <h2 id="site-rates-heading" className="text-base font-semibold text-text">
            Site rates (everyone without their own)
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Now <span className="numeric text-text">{describeRates(o.site)}</span>, so a creator keeps{" "}
            <span className="numeric text-text">{keepOfHundred(o.site)}</span> of a ₹100 tip.{" "}
            <span className="numeric text-text">{o.counts.site}</span> of <span className="numeric text-text">{o.counts.all}</span>{" "}
            creators follow them. Change them here to change all of those at once; a creator with their own rates is never moved by
            this.
          </p>
        </div>
        <SiteRatesForm site={o.site} following={o.counts.site} />
      </section>

      <section className="space-y-4" aria-labelledby="creator-rates-heading">
        <div className="space-y-1">
          <h2 id="creator-rates-heading" className="text-base font-semibold text-text">
            Creators
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Give one creator their own rates from their page (open them below), or tick several and change them together. Setting
            0% and 0% means they keep the full tip; the payment gateway&apos;s own charge is then Freetip&apos;s cost.
          </p>
        </div>

        <nav aria-label="Rate lists" className="flex flex-wrap gap-2">
          {FEE_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={hrefFor({ tab: t.key })}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                  active ? "bg-accent text-ink" : "border border-control text-muted hover:border-text/40 hover:text-text"
                }`}
              >
                {t.label}
                <span className="numeric text-xs">{o.counts[t.key]}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/admin/fees" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, email or handle"
            aria-label="Search creators"
            className={`${FIELD_CLASS} w-full max-w-md`}
          />
          <button type="submit" className={buttonClass("quiet", "md")}>
            Search
          </button>
          {q && (
            <Link href="/admin/fees" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
              Clear
            </Link>
          )}
        </form>

        {o.total === 0 ? (
          q || o.counts.all > 0 ? (
            <p className="text-sm text-muted">{q ? `No creator in this list matches “${q}”.` : "Nobody is in this list."}</p>
          ) : (
            <AdminEmptyState title="No creators yet" description="Creators appear here once they sign in with Google." />
          )
        ) : (
          <div className="space-y-3">
            <Pager
              page={o.page}
              pageSize={o.pageSize}
              total={o.total}
              shown={o.rows.length}
              noun="creator"
              hrefFor={(p) => hrefFor({ page: p })}
            />
            <CreatorFeeTable key={`${tab}-${q}-${o.page}`} rows={o.rows} site={o.site} />
          </div>
        )}
      </section>
    </div>
  );
}
