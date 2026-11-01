// Alert rules by tip size: "from this tip up, play this media and/or sound". Pure, so
// the choice can be tested without a database. The creator sets the rules in
// /dashboard/rules; the overlay applies them at play time (src/lib/alert-extras.ts).

export const MAX_RULES_PER_CREATOR = 10;
export const RULE_MAX_RUPEES = 100_000;

// One rule as the overlay needs it. `sound` is already looked up (null when the rule
// has no sound, or the sound was deleted).
export type AlertRule = {
  id: number;
  minPaise: number;
  mediaId: number | null;
  sound: { url: string; volume: number; ms: number } | null;
};

// The rule for a tip: the one with the highest minimum at or below the amount.
// Null when no rule reaches the tip, so it plays as a normal alert.
export function resolveRule<T extends { minPaise: number }>(rules: readonly T[], amountPaise: number): T | null {
  let best: T | null = null;
  for (const r of rules) {
    if (r.minPaise <= amountPaise && (!best || r.minPaise > best.minPaise)) best = r;
  }
  return best;
}

// The creator types rupees; whole rupees from 0 (every tip) up to the cap.
export function parseRuleRupees(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 0 || n > RULE_MAX_RUPEES) return null;
  return n;
}

// A rule with neither media nor sound would do nothing.
export function ruleHasEffect(mediaId: number | null, soundId: number | null): boolean {
  return mediaId !== null || soundId !== null;
}
