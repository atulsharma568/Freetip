import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";

export default async function AdminAuditPage() {
  await requireOwner();
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Audit history
        </p>
        <h1 className="display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">
          Keep financial history explainable.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Financial postings and future owner actions will be recorded with
          actor, source, reason and timestamps. Posted ledger history will be
          reversed, not edited.
        </p>
      </div>

      <AdminEmptyState
        title="No financial audit events yet"
        description="The append-only audit stream will begin when the first real financial event or authorized owner action is recorded."
      />
    </div>
  );
}
