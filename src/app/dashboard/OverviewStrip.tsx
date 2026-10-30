import { formatRupees } from "@/lib/earnings";
import { FEES } from "@/lib/legal";
import type { OverviewKey, OverviewRow } from "./queries";

const LABELS: Record<OverviewKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};
const ORDER: OverviewKey[] = ["today", "7d", "30d", "all"];

// Tips received per period, with an estimated creator share. The estimate is
// labelled as one on every tile. There is deliberately no balance or "paid
// out" figure: payouts are not built, so there is nothing real to show.
export function OverviewStrip({ rows }: { rows: OverviewRow[] }) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h2
        id="overview-heading"
        className="text-sm font-medium uppercase tracking-widest text-muted"
      >
        Tips received
      </h2>
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
        {ORDER.map((key) => {
          const r = byKey.get(key);
          const count = r?.count ?? 0;
          return (
            <div
              key={key}
              className="space-y-1 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
            >
              <dt className="text-sm text-muted">{LABELS[key]}</dt>
              <dd className="numeric text-2xl font-semibold text-text">
                {formatRupees(r?.grossPaise ?? 0)}
              </dd>
              <dd className="text-sm text-muted">
                {count === 1 ? "1 tip" : `${count} tips`}
              </dd>
              <dd className="numeric text-sm text-muted">
                You&apos;d keep about {formatRupees(r?.sharePaise ?? 0)}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-sm text-muted">
        The amount you&apos;d keep is an estimate: each tip less our{" "}
        {FEES.platformPercent}% and the {FEES.gatewayPercent}% processing
        charge. Payouts have not started yet, so there is no balance to show.
      </p>
    </section>
  );
}
