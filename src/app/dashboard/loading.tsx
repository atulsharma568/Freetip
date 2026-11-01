import { DashboardShell } from "./parts/DashboardShell";
import { TickLoader } from "@/components/ui/TickLoader";

// What shows while a dashboard page is read: the same frame and tile geometry as
// the overview (tab row, greeting, four numbers, two columns of tiles) as flat
// Card Dusk blocks, and a strip of stepped ticks with words saying what is
// happening. The blocks rest under reduced motion.
function Block({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-surface bg-surface motion-safe:animate-pulse ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-7xl space-y-8 px-6 pb-24 pt-4">
        <p role="status" className="flex items-center gap-3 text-sm text-muted">
          <TickLoader count={16} duration={1.4} className="text-accent" />
          Loading your dashboard
        </p>
        <div aria-hidden="true" className="h-12 w-72 max-w-full rounded-full border border-control" />
        <div aria-hidden="true" className="h-14 w-64 max-w-full rounded-field bg-surface motion-safe:animate-pulse" />
        <Block className="h-56 md:h-64" />
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-36" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Block className="h-72" />
          <Block className="h-72" />
        </div>
      </div>
    </DashboardShell>
  );
}
