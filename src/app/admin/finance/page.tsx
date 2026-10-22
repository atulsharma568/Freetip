import { AdminEmptyState } from "@/components/admin/EmptyState";

const metrics = [
  "Gross captured tips",
  "Refunds",
  "Provider fees and taxes",
  "Tipsite platform revenue",
  "Creator net earnings",
  "Pending or unsettled",
];

export default function AdminFinancePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Finance
        </p>
        <h1 className="display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">
          Money movement, clearly separated.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          These are the reporting categories the ledger will populate by day,
          week and month. No estimates are displayed until provider records
          exist.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric} className="rounded-2xl border border-control bg-surface p-5">
            <p className="text-sm text-muted">{metric}</p>
            <p className="mt-3 text-2xl font-semibold text-text">Not available yet</p>
          </div>
        ))}
      </div>

      <AdminEmptyState
        title="Razorpay is not connected"
        description="Payment orders, verified captures, refunds, settlements and actual fee lines will populate this view only after the Razorpay account model and webhook contract are approved."
      />
    </div>
  );
}
