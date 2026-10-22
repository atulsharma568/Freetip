export function MetricCard({
  label,
  value,
  sub,
  accent,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-accent/30 bg-surface"
          : "border-control bg-surface"
      }`}
    >
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
          accent ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 font-mono text-sm text-muted tabular-nums">{sub}</p>}
      {note && <p className="mt-2 text-xs text-muted/70">{note}</p>}
    </div>
  );
}

export function ExceptionCard({
  exceptions,
  disputes,
}: {
  exceptions: number;
  disputes: number;
}) {
  const total = exceptions + disputes;
  const hasIssues = total > 0;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        hasIssues ? "border-red-500/40 bg-surface" : "border-control bg-surface"
      }`}
    >
      <p className="text-sm text-muted">Exceptions</p>
      <p
        className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
          hasIssues ? "text-red-400" : "text-text"
        }`}
      >
        {total}
      </p>
      {(exceptions > 0 || disputes > 0) && (
        <p className="mt-1 text-xs text-muted">
          {exceptions > 0 && `${exceptions} unmatched`}
          {exceptions > 0 && disputes > 0 && " · "}
          {disputes > 0 && `${disputes} dispute${disputes !== 1 ? "s" : ""}`}
        </p>
      )}
      {total === 0 && (
        <p className="mt-1 text-xs text-muted/70">No open issues</p>
      )}
    </div>
  );
}
