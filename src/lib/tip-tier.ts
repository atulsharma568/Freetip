// A short, friendly line under the tip amount. It only describes the size of the
// tip, so it works for any creator, and it never promises anything extra.
const TIERS: { fromRupees: number; label: string }[] = [
  { fromRupees: 2000, label: "Stream-changing" },
  { fromRupees: 500, label: "Big support" },
  { fromRupees: 100, label: "A solid boost" },
  { fromRupees: 0, label: "A quick thank-you" },
];

export function tipTier(rupees: number): string {
  const amount = Number.isFinite(rupees) ? rupees : 0;
  return (TIERS.find((t) => amount >= t.fromRupees) ?? TIERS[TIERS.length - 1]).label;
}
