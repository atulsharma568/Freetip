import { TONE_BORDER, TONE_MARK, TONE_TEXT } from "./tones";

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
      className={`rounded-surface border p-5 ${
        accent ? "border-accent/30 bg-surface" : "border-control bg-surface"
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
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
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
  const tone = total > 0 ? "bad" : "neutral";

  return (
    <div className={`rounded-surface border bg-surface p-5 ${TONE_BORDER[tone]}`}>
      <p className="text-sm text-muted">Exceptions</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${total > 0 ? TONE_TEXT.bad : "text-text"}`}>
        {total > 0 && <span aria-hidden="true">{TONE_MARK.bad} </span>}
        {total}
      </p>
      {(exceptions > 0 || disputes > 0) && (
        <p className="mt-1 text-xs text-muted">
          {exceptions > 0 && `${exceptions} unmatched`}
          {exceptions > 0 && disputes > 0 && " · "}
          {disputes > 0 && `${disputes} dispute${disputes !== 1 ? "s" : ""}`}
        </p>
      )}
      {total === 0 && <p className="mt-1 text-xs text-muted">No open issues</p>}
    </div>
  );
}
