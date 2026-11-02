// Alert rules by tip size: "from this tip up, play this media and/or sound". Pure, so
// the choice can be tested without a database. The creator sets the rules in
// /dashboard/rules; the overlay applies them at play time (src/lib/alert-extras.ts).

export const MAX_RULES_PER_CREATOR = 10;
export const RULE_MAX_RUPEES = 100_000;

// A rule can keep the alert on screen for longer, but only for a big tip, so a small
// tip never holds the stage. Seconds, 10 to 5 minutes, from this tip size up.
export const STAY_MIN_RUPEES = 1_000;
export const STAY_MIN_SECONDS = 10;
export const STAY_MAX_SECONDS = 300;
// The choices the rules page offers (seconds).
export const STAY_CHOICES: readonly number[] = [30, 60, 120, 180, 300];

// One rule as the overlay needs it. `sound` is already looked up (null when the rule
// has no sound, or the sound was deleted).
export type AlertRule = {
  id: number;
  minPaise: number;
  mediaId: number | null;
  sound: { url: string; volume: number; ms: number } | null;
  // How long the alert stays on screen, in milliseconds; null or missing is the normal length.
  stayMs?: number | null;
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

// The stay for a rule: null (normal length) or whole seconds within range. A stay on a
// rule below the big-tip size is refused. Returns undefined when the input is not valid.
export function parseStaySeconds(raw: unknown, minRupees: number): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < STAY_MIN_SECONDS || n > STAY_MAX_SECONDS) return undefined;
  if (minRupees < STAY_MIN_RUPEES) return undefined;
  return n;
}

// A rule with neither media nor sound would do nothing.
export function ruleHasEffect(mediaId: number | null, soundId: number | null): boolean {
  return mediaId !== null || soundId !== null;
}
