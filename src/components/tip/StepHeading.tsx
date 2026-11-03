// A numbered heading for one step of the tip form (shared by the real tip page and the
// landing page's sample card, so the two cannot drift apart).
export function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="numeric grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-ink"
      >
        {n}
      </span>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line/60" />
    </div>
  );
}
