import Link from "next/link";

const sections = [
  {
    href: "/admin/finance",
    title: "Finance",
    description:
      "Captured tips, refunds, fees, creator net earnings, settlements and pending balances.",
  },
  {
    href: "/admin/reconciliation",
    title: "Reconciliation",
    description:
      "Provider reports, internal records, variances and unresolved exceptions.",
  },
  {
    href: "/admin/audit",
    title: "Audit history",
    description:
      "Append-only history for financial events and future owner actions.",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Read-only foundation
        </p>
        <h1 className="display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">
          Owner finance, before payment execution.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Razorpay is not connected yet. This console is intentionally honest:
          it defines where real financial records will appear without showing
          sample totals or pretending that a payment succeeded.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-control bg-surface p-5 transition-colors hover:border-accent/60"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Planned view
            </p>
            <h2 className="mt-3 text-xl font-semibold text-text group-hover:text-accent">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {section.description}
            </p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-control bg-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          Current state
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Payment provider</dt>
            <dd className="mt-1 font-medium text-text">Razorpay · not connected</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Financial records</dt>
            <dd className="mt-1 font-medium text-text">No captured data yet</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Owner actions</dt>
            <dd className="mt-1 font-medium text-text">Read-only</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
