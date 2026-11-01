import Link from "next/link";
import { getFinanceSummary, formatINR } from "@/lib/admin/finance-queries";
import { rangeAllTime } from "@/lib/admin/date-range";
import { getQueue } from "@/lib/admin/queue";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { TONE_MARK, TONE_TEXT } from "@/components/admin/tones";
import { CouldNotRead } from "./_components/Notices";
import { PageHeader } from "./_components/PageHeader";

export const dynamic = "force-dynamic";

const sections = [
  {
    href: "/admin/finance",
    title: "Finance",
    description:
      "Live tips captured, what the ledger has posted, what creators are owed and what is posted but not yet settled.",
  },
  {
    href: "/admin/reconciliation",
    title: "Reconciliation",
    description:
      "Tips not yet posted, the button that posts them, and a check of Razorpay for payments the site missed.",
  },
  {
    href: "/admin/audit",
    title: "Audit history",
    description: "Append-only history of owner actions: approvals, suspensions, feature switches, removals.",
  },
  {
    href: "/admin/features",
    title: "Paid features",
    description: "Which creator has which paid feature switched on, with a count per feature.",
  },
  {
    href: "/admin/health",
    title: "Health",
    description: "The scheduled jobs and a checklist of which server settings are set (never their values).",
  },
];

// Which Razorpay key the server holds. Only a live key makes real money.
function razorpayKeyState(): string {
  const key = process.env.RAZORPAY_KEY_ID;
  if (!key) return "Razorpay · no key set";
  if (key.startsWith("rzp_live_")) return "Razorpay · live key set";
  return "Razorpay · test key set (test money is not counted)";
}

export default async function AdminOverviewPage() {
  await requireOwner();

  const db = adminDb();
  const [result, queue] = db ? await Promise.all([getFinanceSummary(db, rangeAllTime()), getQueue(db)]) : [null, null];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner console"
        title="Needs you today"
        note="Figures count live Razorpay payments only; test-mode payments are not counted. Nothing here moves money: creator payouts are not built yet."
      />

      <section aria-label="Waiting for you" className="space-y-3">
        {queue ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queue.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col justify-between gap-3 rounded-surface border border-control bg-surface p-5 transition-colors hover:border-accent/60"
                >
                  <span className="text-sm text-muted">{item.label}</span>
                  {item.count.ok ? (
                    <span
                      className={`numeric text-3xl font-semibold ${item.count.data > 0 ? "text-accent" : "text-text"}`}
                    >
                      {item.count.data}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : (
                    <span className={`text-sm ${TONE_TEXT.bad}`} title={item.count.error}>
                      <span aria-hidden="true">{TONE_MARK.bad} </span>Could not read
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">The database is not set up, so nothing can be counted.</p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-surface border border-control bg-surface p-5 transition-colors hover:border-accent/60"
          >
            <h2 className="text-xl font-semibold text-text group-hover:text-accent">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{section.description}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-surface border border-control bg-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Current state</p>
        {result && !result.ok ? (
          <div className="mt-5">
            <CouldNotRead detail={result.error} />
          </div>
        ) : (
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm text-muted">Payment provider</dt>
              <dd className="mt-1 font-medium text-text">{razorpayKeyState()}</dd>
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
