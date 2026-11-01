// A short, friendly line under the tip amount. It only describes the size of the
// tip, so it works for any creator, and it never promises anything extra.
const TIERS: { fromRupees: number; label: string }[] = [
  { fromRupees: 2000, label: "Stream-changing" },
  { fromRupees: 500, label: "Big support" },
  { fromRupees: 100, label: "A solid boost" },
  { fromRupees: 0, label: "A quick thank-you" },
];

function tierIndex(rupees: number): number {
  const amount = Number.isFinite(rupees) ? rupees : 0;
  const i = TIERS.findIndex((t) => amount >= t.fromRupees);
  return i === -1 ? TIERS.length - 1 : i;
}

export function tipTier(rupees: number): string {
  return TIERS[tierIndex(rupees)].label;
}

// 0 (a quick thank-you) up to 3 (stream-changing), from the same thresholds as the
// label. The OBS alert scales its card with it.
export function tipTierLevel(rupees: number): 0 | 1 | 2 | 3 {
  return (TIERS.length - 1 - tierIndex(rupees)) as 0 | 1 | 2 | 3;
}
