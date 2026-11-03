import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { planFeatures } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import type { LedgerDb } from "@/lib/accrual";
import { formatRupees } from "@/lib/earnings";
import { FAN_LIST_LIMIT, FAN_SORTS, FAN_SORT_LABELS, loadFans, parseFansQuery, type FanRow } from "@/lib/fan-list";
import { levelStartXp } from "@/lib/fan-levels";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { EmptyState } from "../parts/EmptyState";
import { Tile } from "../parts/Tile";
import { pillOutline } from "../parts/styles";
import { FanList, type FanItem } from "./FanList";

export const metadata: Metadata = {
  title: `Fans: ${SITE_NAME}`,
  robots: { index: false },
};

const latestFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export default async function FansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<
    { id: number; handle: string | null; creator_status: string; paid_features: string[] | null }[]
  >`
    select id, handle, creator_status, paid_features from users where google_id = ${googleId}
  `;
  const features = planFeatures(user);
  if (!user?.handle || !(features.fanLevels || features.fanCrm)) redirect("/dashboard");

  const query = parseFansQuery(await searchParams);
  let fans: FanRow[] = [];
  let total = 0;
  let readFailed = false;
  if (features.fanCrm) {
    try {
      ({ fans, total } = await loadFans(db as unknown as LedgerDb, user.id, query));
    } catch (err) {
      console.error("Fans page: could not read the fan list (migration 0038 run?)", err);
      readFailed = true;
    }
  }

  const items: FanItem[] = fans.slice(0, FAN_LIST_LIMIT).map((f) => ({
    key: f.key,
    name: f.name,
    level: features.fanLevels ? f.level : null,
    tips: f.tips,
    total: formatRupees(f.totalPaise),
    latest: latestFormat.format(f.lastAt),
    note: f.note ?? "",
  }));

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="fans" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Fans</h1>
          <p className="text-pretty text-base text-muted">
            A fan here is a name: whoever types the same name on your page counts as one fan. Fans who tip
            anonymously or leave the name blank are never counted, and anyone can type someone else&apos;s name, so
            treat this as a friendly list, not proof of who anyone is. Profiles are kept for 12 months after a fan&apos;s
            latest tip. Counting starts on the day a feature is switched on for you.
          </p>
        </div>

        {features.fanLevels && (
          <Tile id="levels" level={2} title="Fan levels">
            <p className="text-sm text-muted">
              A fan with a name earns 1 point for every ₹1 they tip you, and their level shows beside their name on your
              alert. The alert says &quot;Level up!&quot; on the tip that raises it. A tip that Razorpay takes back loses its points.
            </p>
            <p className="numeric text-sm text-text">
              {[2, 3, 4, 5, 10].map((n) => `Lv ${n}: ${levelStartXp(n).toLocaleString("en-IN")} points`).join(" · ")}
            </p>
          </Tile>
        )}

        {features.fanCrm && (
          <section className="space-y-4" aria-labelledby="fan-list-title">
            <h2 id="fan-list-title" className="text-sm font-medium uppercase tracking-widest text-muted">
              Your fans{total > 0 ? ` (${total.toLocaleString("en-IN")})` : ""}
            </h2>

            <form method="get" className="flex flex-wrap items-center gap-2" role="search">
              <input
                type="search"
                name="q"
                defaultValue={query.q}
                maxLength={50}
                aria-label="Search fans by name"
                placeholder="Search by name"
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted focus:border-accent"
              />
              <input type="hidden" name="sort" value={query.sort} />
              <button type="submit" className={pillOutline}>
                Search
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort fans">
              {FAN_SORTS.filter((s) => s !== "level" || features.fanLevels).map((s) => (
                <Link
                  key={s}
                  href={fansHref({ q: query.q, sort: s })}
                  aria-current={query.sort === s ? "true" : undefined}
                  className={`inline-flex h-11 items-center rounded-full px-4 text-sm transition-colors duration-200 ${
                    query.sort === s ? "bg-accent font-medium text-ink" : "border border-control text-text hover:border-accent"
                  }`}
                >
                  {FAN_SORT_LABELS[s]}
                </Link>
              ))}
            </div>

            {readFailed ? (
              <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">
                Could not read your fans just now. Try again in a moment.
              </p>
            ) : items.length === 0 ? (
              query.q ? (
                <p className="rounded-surface border border-line/60 bg-surface p-6 text-muted">No fan matches that name.</p>
              ) : (
                <EmptyState
                  sample={
                    <div className="flex items-center gap-3 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                      <span className="font-medium text-text">Riya</span>
                      <span className="numeric text-muted">Lv 3 · 4 tips</span>
                      <span className="numeric ml-auto text-text">₹750</span>
                    </div>
                  }
                  title="No fans yet."
                  body="A fan appears here after a paid tip that carries a name. Tips sent before this feature was switched on are not counted."
                />
              )
            ) : (
              <>
                <FanList fans={items} />
                {total > items.length && (
                  <p className="text-sm text-muted">
                    Showing the first {items.length} of {total.toLocaleString("en-IN")}. Search to find a fan, or download them all.
                  </p>
                )}
                <div className="space-y-2">
                  <a href={exportHref(query)} download="fans.csv" className={pillOutline}>
                    Download CSV
                  </a>
                  <p className="text-sm text-muted">
                    Every fan matching the search, not just this page. Times are in IST. You are responsible for a list you
                    download; keep it private.
                  </p>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function qs({ q, sort }: { q: string; sort: string }) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (sort !== "recent") p.set("sort", sort);
  return p.toString();
}

function fansHref(query: { q: string; sort: string }) {
  const s = qs(query);
  return s ? `/dashboard/fans?${s}` : "/dashboard/fans";
}

function exportHref(query: { q: string; sort: string }) {
  const s = qs(query);
  return s ? `/api/dashboard/fans/export?${s}` : "/api/dashboard/fans/export";
}
