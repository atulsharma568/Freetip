import { TickLoader } from "@/components/ui/TickLoader";

// Shown while an owner page reads the database. The shell (nav, header) stays put.
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-16 text-sm text-muted">
      <TickLoader count={12} duration={1.2} />
      Loading…
    </div>
  );
}
