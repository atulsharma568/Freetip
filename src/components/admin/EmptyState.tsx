export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-control bg-surface/60 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
        No records yet
      </p>
      <h2 className="mt-3 text-xl font-semibold text-text">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {description}
      </p>
    </div>
  );
}
