import { PageShell } from "@/components/PageShell";
import { TickLoader } from "@/components/ui/TickLoader";

// What a fan sees while a creator's tip page is read: the page's two columns as flat
// blocks, so nothing jumps when the real page arrives. The blocks rest under reduced motion.
function Block({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-surface bg-surface motion-safe:animate-pulse ${className}`} />;
}

export default function CreatorLoading() {
  return (
    <PageShell slim>
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 pb-24 pt-10">
        <p role="status" className="flex items-center gap-3 text-sm text-muted">
          <TickLoader count={16} duration={1.4} className="text-accent" />
          Loading the tip page
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <Block className="h-80" />
          <Block className="h-96" />
        </div>
      </div>
    </PageShell>
  );
}
