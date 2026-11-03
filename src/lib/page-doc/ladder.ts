import type { Ladder, Level } from "./types";

// The words under the bar in the amount box: a bounty ladder from One Piece, from a rookie up to
// the Pirate King. The bar reaches full at ₹5,000.
export const ONE_PIECE_LADDER: Ladder = {
  topRupees: 5000,
  levels: [
    { upTo: 0.25, name: "Rookie" },
    { upTo: 0.5, name: "Supernova" },
    { upTo: 0.75, name: "Warlord" },
    { upTo: 0.95, name: "Yonko" },
    { upTo: 1, name: "Pirate King" },
  ],
};

// Where an amount sits on the bar: a log scale, so ₹20 and ₹5,000 both fit. 0 at or below the
// minimum tip, 1 at or above the top, and always a real number (a top at or below the minimum, or
// a value that is not a number, never gives NaN).
export function ladderFraction(amountRupees: number, minRupees: number, topRupees: number): number {
  if (![amountRupees, minRupees, topRupees].every(Number.isFinite)) return 0;
  const low = Math.max(1, minRupees);
  if (!(amountRupees > low)) return 0;
  if (topRupees <= low) return amountRupees >= topRupees ? 1 : 0;
  return Math.min(1, Math.log(amountRupees / low) / Math.log(topRupees / low));
}

// The word for a fraction: the first level it is still below, or the last one.
export function ladderLevel(fraction: number, levels: readonly Level[]): string {
  return levels.find((l) => fraction < l.upTo)?.name ?? levels[levels.length - 1]?.name ?? "";
}
