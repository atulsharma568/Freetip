// How long a fan's message may be, by tip size. The creator's own limit (10 to
// 500, set in dashboard settings) stays the ceiling and applies to bigger tips;
// smaller tips get a share of it, rounded to the nearest 10 and never below
// `FLOOR` (or the ceiling itself, if that is smaller). Pure, with no site
// imports, so the tip form, the server check and the tests all agree.
const FLOOR = 30;

const STEPS: { fromPaise: number; share: number }[] = [
  { fromPaise: 30000, share: 1 }, // ₹300 and up: the creator's full limit
  { fromPaise: 10000, share: 0.75 }, // ₹100 to ₹299
  { fromPaise: 0, share: 0.5 }, // under ₹100
];

const limitAt = (creatorMax: number, share: number) => {
  if (share >= 1) return creatorMax;
  const scaled = Math.round((creatorMax * share) / 10) * 10;
  return Math.min(creatorMax, Math.max(FLOOR, scaled));
};

export function messageLimitFor(creatorMax: number, amountPaise: number): number {
  const amount = Number.isFinite(amountPaise) ? amountPaise : 0;
  const step = STEPS.find((s) => amount >= s.fromPaise) ?? STEPS[STEPS.length - 1];
  return limitAt(creatorMax, step.share);
}

// The next tip size that allows a longer message, for the hint under the box.
// Null when the fan is already at the creator's full limit.
export function nextMessageStep(
  creatorMax: number,
  amountPaise: number,
): { rupees: number; limit: number } | null {
  const current = messageLimitFor(creatorMax, amountPaise);
  const bigger = [...STEPS]
    .reverse()
    .find((s) => s.fromPaise > amountPaise && limitAt(creatorMax, s.share) > current);
  return bigger ? { rupees: bigger.fromPaise / 100, limit: limitAt(creatorMax, bigger.share) } : null;
}
