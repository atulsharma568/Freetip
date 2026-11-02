import { formatRupees } from "@/lib/earnings";
import { FEES } from "@/lib/legal";
import type { OverviewKey, OverviewRow } from "./queries";
import { CopyButton } from "./parts/CopyButton";
import { MoneyReels } from "./parts/MoneyReels";
import { pillOutline } from "./parts/styles";

const LABELS: Record<OverviewKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};
const ORDER: OverviewKey[] = ["today", "7d", "30d", "all"];

// Tips received per period, with an estimated creator share. The estimate is
// labelled as one on every tile. There is deliberately no balance or "paid
// out" figure: payouts are not built, so there is nothing real to show. The
// amounts roll in on odometer reels (the zeros too, before the first tip).
export function OverviewStrip({ rows, shareUrl }: { rows: OverviewRow[]; shareUrl: string }) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const noTips = (byKey.get("all")?.count ?? 0) === 0;
  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h3 id="overview-heading" className="text-sm font-medium uppercase tracking-widest text-muted">
        Tips received
      </h3>
      <dl className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((key) => {
          const r = byKey.get(key);
          const count = r?.count ?? 0;
          const gross = formatRupees(r?.grossPaise ?? 0);
          return (
            <div
              key={key}
              data-tile
              className="min-w-0 space-y-2 rounded-surface border border-line/60 bg-surface p-5 md:p-6"
            >
              <dt className="text-sm font-medium text-text">{LABELS[key]}</dt>
              <dd className="pt-2 text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold leading-none text-text">
                <span className="sr-only">{gross}</span>
                <MoneyReels text={gross} />
              </dd>
              <dd className="text-sm text-muted">{count === 1 ? "1 tip" : `${count} tips`}</dd>
              <dd className="numeric border-t border-line/60 pt-3 text-sm text-muted">
                You&apos;d keep about {formatRupees(r?.sharePaise ?? 0)}
              </dd>
            </div>
          );
        })}
      </dl>
      {noTips && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <CopyButton value={shareUrl} label="Share your link" className={pillOutline} />
          <p className="text-sm text-muted">No tips yet. Put your link where your viewers will see it.</p>
        </div>
      )}
      <p className="text-sm text-muted">
        The amount you&apos;d keep is an estimate: each tip less our {FEES.platformPercent}% and the{" "}
        {FEES.gatewayPercent}% processing charge. Payouts have not started yet, so there is no balance to show.
      </p>
    </section>
  );
}
