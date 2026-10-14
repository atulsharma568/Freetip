// A money readout drawn as odometer reels: "₹" then one reel per digit. Each
// reel is two runs of 0-9 stacked in a one-digit window; animate a reel's
// [data-reel] strip with yPercent to `reelTarget(digit)` so it spins one full
// turn and lands on its digit (see TipCard). Decorative: give the amount to
// screen readers separately.
export const reelTarget = (digit: number) => -((10 + digit) / 20) * 100;

export function Odometer({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`numeric inline-flex leading-none ${className}`}>
      <span>₹</span>
      {[...String(value)].map((char, i) => (
        <span key={i} className="inline-block h-[1em] overflow-hidden">
          <span data-reel data-digit={char} className="block">
            {Array.from({ length: 20 }, (_, k) => (
              <span key={k} className="block h-[1em]">
                {k % 10}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
