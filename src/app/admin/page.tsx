import Link from "next/link";
import { getFinanceSummary, formatINR } from "@/lib/admin/finance-queries";
import { rangeAllTime } from "@/lib/admin/date-range";
import { getQueue } from "@/lib/admin/queue";
import { razorpayKeyMode } from "@/lib/admin/key-mode";
import { adminDb } from "@/lib/admin/server-db";
import { requireAdminViewer } from "@/lib/owner-auth";
import { TONE_MARK, TONE_TEXT } from "@/components/admin/tones";
import { CouldNotRead } from "./_components/Notices";
import { viewerCanOpen } from "./_components/nav-items";
import { PageHeader } from "./_components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const viewer = (await requireAdminViewer()) === "viewer";

  const db = adminDb();
  // A viewer sees only the queue items for pages they may open.
  const [result, fullQueue] = db
    ? await Promise.all([getFinanceSummary(db, rangeAllTime()), getQueue(db)])
    : [null, null];
  const queue = fullQueue && viewer ? { ...fullQueue, items: fullQueue.items.filter((i) => viewerCanOpen(i.href)) } : fullQueue;

  const waitingTotal = queue
    ? queue.items.reduce((sum, i) => sum + (i.count.ok ? i.count.data : 0), 0)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner console"
        title="Needs you today"
        note="Figures count live Razorpay payments only; test-mode payments are not counted. Nothing here moves money: creator payouts are paid by hand from Payouts to pay."
      />

      <section aria-labelledby="waiting-heading" className="space-y-3">
        <h2 id="waiting-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          {queue ? (waitingTotal > 0 ? `${waitingTotal} waiting for you` : "Nothing waiting for you") : "Waiting for you"}
        </h2>
        {queue ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queue.items.map((item) => {
              const n = item.count.ok ? item.count.data : 0;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={`flex h-full min-h-28 flex-col justify-between gap-3 rounded-surface border bg-surface p-5 transition-colors hover:border-accent ${
                      n > 0 ? "border-accent/50" : "border-control"
                    }`}
                  >
                    <span className="text-sm text-muted">{item.label}</span>
                    {item.count.ok ? (
                      n > 0 ? (
                        <span className="numeric flex items-center justify-between text-3xl font-semibold text-accent">
                          <span>
                            {n}
                            <span className="sr-only"> waiting</span>
                          </span>
                          <span aria-hidden="true" className="text-lg">→</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">
                          <span aria-hidden="true">{TONE_MARK.good} </span>All clear
                        </span>
                      )
                    ) : (
                      <span className={`text-sm ${TONE_TEXT.bad}`} title={item.count.error}>
                        <span aria-hidden="true">{TONE_MARK.bad} </span>Could not read
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">The database is not set up, so nothing can be counted.</p>
        )}
      </section>

      <section className="rounded-surface border border-control bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Current state</h2>
        {result && !result.ok ? (
          <div className="mt-5">
            <CouldNotRead detail={result.error} />
          </div>
        ) : (
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-muted">Payment provider</dt>
              <dd className="mt-1 font-medium text-text">{razorpayKeyMode().long}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Live tips captured</dt>
              <dd className="mt-1 font-medium text-text">
                {result?.ok
                  ? `${result.data.tipsCapturedCount} · ${formatINR(result.data.grossCapturedMinor)}`
                  : "Database not set up"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Owed to creators</dt>
              <dd className="mt-1 font-medium text-text">
                {result?.ok ? formatINR(result.data.owedToCreatorsMinor) : "Database not set up"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Not yet posted to the books</dt>
              <dd className="mt-1 font-medium text-text">
                {result?.ok ? String(result.data.notPosted.count) : "Database not set up"}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
