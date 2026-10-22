const STATUS_STYLES: Record<string, string> = {
  captured:   "bg-accent/15 text-accent",
  completed:  "bg-accent/15 text-accent",
  matched:    "bg-accent/15 text-accent",
  processed:  "bg-accent/15 text-accent",
  won:        "bg-accent/15 text-accent",
  failed:     "bg-red-500/15 text-red-400",
  lost:       "bg-red-500/15 text-red-400",
  exception:  "bg-red-500/15 text-red-400",
  disputed:   "bg-red-500/15 text-red-400",
  open:       "bg-amber-500/15 text-amber-400",
  unmatched:  "bg-amber-500/15 text-amber-400",
  partial:    "bg-amber-500/15 text-amber-400",
  pending:    "bg-amber-500/15 text-amber-400",
  processing: "bg-amber-500/15 text-amber-400",
  in_transit: "bg-amber-500/15 text-amber-400",
  refunded:   "bg-muted/15 text-muted",
  cancelled:  "bg-muted/15 text-muted",
  closed:     "bg-muted/15 text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-muted/10 text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
