import { dailyBars, formatRupees, shortDay } from "@/lib/earnings";
import type { DayRow } from "./queries";
import { Tile } from "./parts/Tile";
import { EmptyState } from "./parts/EmptyState";
import { CopyButton } from "./parts/CopyButton";
import { pillOutline } from "./parts/styles";

const W = 300;
const H = 100;

// Heights of the sample bars shown before any tip has landed.
const SAMPLE_BARS = [18, 34, 26, 52, 40, 72, 58];

// Gross tips per India day, one series, so no legend or second axis. The bars
// are drawn on the server; each has a native tooltip, and the table below the
// chart carries the same numbers as text.
export function DailyChart({ days, shareUrl }: { days: DayRow[]; shareUrl: string }) {
  const total = days.reduce((n, d) => n + d.count, 0);
  const peak = Math.max(...days.map((d) => d.grossPaise), 0);
  const bars = dailyBars(days, W, H);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const active = days.filter((d) => d.count > 0).reverse();

  return (
    <Tile id="daily" title={`Tips per day, last ${days.length} days`}>
      {total === 0 ? (
        <EmptyState
          sample={
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-28 w-full rounded-field bg-ground">
              {SAMPLE_BARS.map((h, i) => (
                <rect key={i} x={12 + i * 41} y={H - h} width={26} height={h} rx="2" className="fill-control" />
              ))}
            </svg>
          }
          title={`No tips in the last ${days.length} days.`}
          body="The chart fills in once fans have paid. The bars above are a sample."
          cta={<CopyButton value={shareUrl} label="Share your link" className={pillOutline} />}
        />
      ) : (
        <div className="space-y-2">
          <p className="numeric text-sm text-muted">Busiest day {formatRupees(peak)}</p>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Bar chart of tips per day over the last ${days.length} days. ${total} tips, busiest day ${formatRupees(peak)}. The same numbers are in the table below.`}
            className="block h-28 w-full"
          >
            <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {bars.map((b) => {
              const d = byDay.get(b.day)!;
              return (
                <g key={b.day}>
                  <title>{`${shortDay(b.day)}: ${formatRupees(d.grossPaise)}, ${d.count === 1 ? "1 tip" : `${d.count} tips`}`}</title>
                  <rect x={b.slotX} y={0} width={b.slotWidth} height={H} fill="transparent" />
                  {b.height > 0 && (
                    <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="2" className="fill-accent" />
                  )}
                </g>
              );
            })}
          </svg>
          <p className="flex justify-between text-xs text-muted">
            <span>{shortDay(days[0].day)}</span>
            <span>Today</span>
          </p>
        </div>
      )}

      {total > 0 && (
        <details className="rounded-field border border-line/60 p-4">
          <summary className="cursor-pointer text-sm text-text">Show as a table</summary>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Tips per day, newest first, days with tips only</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="pb-2 font-normal">Day</th>
                <th scope="col" className="pb-2 text-right font-normal">Tips</th>
                <th scope="col" className="pb-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {active.map((d) => (
                <tr key={d.day} className="border-t border-line/40">
                  <th scope="row" className="py-2 font-normal text-text">{shortDay(d.day)}</th>
                  <td className="numeric py-2 text-right text-muted">{d.count}</td>
                  <td className="numeric py-2 text-right text-text">{formatRupees(d.grossPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </Tile>
  );
}
