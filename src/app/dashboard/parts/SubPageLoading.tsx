import { DashboardShell } from "./DashboardShell";
import { TickLoader } from "@/components/ui/TickLoader";

// What shows while a dashboard sub-page (Tips, Sounds, Rules...) is read: the narrow
// single column those pages use (tab row, title, two tiles) as flat blocks, so
// nothing jumps when the real page arrives. The overview has its own, wider one. The
// blocks rest under reduced motion.
function Block({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-surface bg-surface motion-safe:animate-pulse ${className}`} />;
}

export function SubPageLoading({ wide = false }: { wide?: boolean }) {
  return (
    <DashboardShell>
      <div className={`mx-auto w-full space-y-8 px-6 pb-24 pt-4 ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
        <div className="space-y-4">
          <div aria-hidden="true" className="h-12 w-72 max-w-full rounded-full border border-control" />
          <div aria-hidden="true" className="h-14 w-44 max-w-full rounded-field bg-surface motion-safe:animate-pulse" />
        </div>
        <p role="status" className="flex items-center gap-3 text-sm text-muted">
          <TickLoader count={16} duration={1.4} className="text-accent" />
          Loading
        </p>
        <Block className="h-56" />
        <Block className="h-72" />
      </div>
    </DashboardShell>
  );
}
