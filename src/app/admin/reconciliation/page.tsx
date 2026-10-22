import { AdminEmptyState } from "@/components/admin/EmptyState";

export default function AdminReconciliationPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Reconciliation
        </p>
        <h1 className="display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">
          Match provider records to the ledger.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Reconciliation will compare provider payments, refunds, settlements
          and payouts with Tipsite&apos;s immutable records.
        </p>
      </div>

      <AdminEmptyState
        title="No reconciliation runs have been completed"
        description="The first run will be enabled after the provider report/API source, reporting timezone, settlement cutoff and variance policy are decided."
      />
    </div>
  );
}
