import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { FEES } from "@/lib/legal";
import {
  EXPORT_MAX_ROWS,
  TIP_RANGES,
  formatRupees,
  parseTipsQuery,
  tipsHref,
  type TipRange,
} from "@/lib/earnings";
import { DashboardNav } from "../DashboardNav";
import { loadTips } from "../queries";
import { DashboardShell } from "../parts/DashboardShell";
import { EmptyState, SampleAlert } from "../parts/EmptyState";
import { CopyButton } from "../parts/CopyButton";
import { pillOutline } from "../parts/styles";

export const metadata: Metadata = {
  title: `Tips: ${SITE_NAME}`,
  robots: { index: false },
};

const RANGE_LABELS: Record<TipRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function TipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{ id: number; handle: string | null; creator_status: string }[]>`
    select id, handle, creator_status from users where google_id = ${googleId}
  `;
  // Nothing to list until the creator has a link.
  if (!user?.handle) redirect("/dashboard");

  const query = parseTipsQuery(await searchParams);
  const { tips, hasMore } = await loadTips(user.id, query);

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="tips" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Tips</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tips">
          {TIP_RANGES.map((r) => (
            <FilterLink
              key={r}
              href={tipsHref({ ...query, range: r, page: 1 })}
              active={query.range === r}
            >
              {RANGE_LABELS[r]}
            </FilterLink>
          ))}
          <FilterLink
            href={tipsHref({ ...query, messageOnly: !query.messageOnly, page: 1 })}
            active={query.messageOnly}
          >
            With a message
          </FilterLink>
        </div>

        {tips.length === 0 ? (
          query.page === 1 && query.range === "all" && !query.messageOnly ? (
            <div className="rounded-surface border border-line/60 bg-surface p-6 md:p-8">
              <EmptyState
                sample={<SampleAlert name="Riya" amount={250} message="Great stream today!" />}
                title="No tips yet."
                body="Each paid tip is listed here with the fan's name, the amount and the message. The one above is a sample."
                cta={
                  <CopyButton
                    value={`https://${SITE_HOST}/${user.handle}`}
                    label="Share your link"
                    className={pillOutline}
                  />
                }
              />
            </div>
          ) : (
            <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">
              {query.page > 1 ? "No more tips here." : "No tips match this filter."}
            </p>
          )
        ) : (
          <ul className="space-y-3">
            {tips.map((t) => (
              <li
                key={t.id}
                className="space-y-2 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
              >
                <p className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words font-medium text-text">{t.name}</span>
                  <span className="numeric shrink-0 text-lg font-semibold text-accent">
                    {formatRupees(t.amountPaise)}
                  </span>
                </p>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted">
                  <time dateTime={t.capturedAt.toISOString()}>
                    {dateFormat.format(t.capturedAt)}
                  </time>
                  <span className="numeric">
                    You&apos;d keep about {formatRupees(t.sharePaise)}
                  </span>
                </p>
                {t.message && <p className="break-words text-base text-text">{t.message}</p>}
                {t.rejected && (
                  <p className="text-sm text-muted">You rejected this message.</p>
                )}
                {t.message && t.messageStatus === "pending" && (
                  <p className="text-sm text-muted">Message waiting for your approval.</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {(query.page > 1 || hasMore) && (
          <nav aria-label="Pages" className="flex items-center justify-between gap-3">
            {query.page > 1 ? (
              <Link
                href={tipsHref({ ...query, page: query.page - 1 })}
                className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
              >
                Newer
              </Link>
            ) : (
              <span />
            )}
            {hasMore && (
              <Link
                href={tipsHref({ ...query, page: query.page + 1 })}
                className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
              >
                Older
              </Link>
            )}
          </nav>
        )}

        {tips.length > 0 && (
          <div className="space-y-2">
            <a
              href={exportHref(query)}
              download="tips.csv"
              className="inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
            >
              Download CSV
            </a>
            <p className="text-sm text-muted">
              Every tip matching the filters above, not just this page (up to{" "}
              {EXPORT_MAX_ROWS.toLocaleString("en-IN")}). Times are in IST.
            </p>
          </div>
        )}

        <p className="text-sm text-muted">
          Only paid tips are listed. The amount you&apos;d keep is an estimate
          (our {FEES.platformPercent}% and the {FEES.gatewayPercent}% processing
          charge taken off).
        </p>
      </div>
    </DashboardShell>
  );
}

function exportHref({ range, messageOnly }: { range: TipRange; messageOnly: boolean }) {
  const qs = new URLSearchParams();
  if (range !== "all") qs.set("range", range);
  if (messageOnly) qs.set("msg", "1");
  const s = qs.toString();
  return s ? `/api/dashboard/tips/export?${s}` : "/api/dashboard/tips/export";
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 items-center rounded-full px-4 text-sm transition-colors duration-200 ${
        active ? "bg-accent font-medium text-ink" : "border border-control text-text hover:border-accent"
      }`}
    >
      {children}
    </Link>
  );
}
