// Fan levels: points (XP) a fan earns by tipping one creator, and the level they add up
// to. Pure, so the same numbers are used by the books, the alert and the fan list.

// 1 point for every whole rupee of a tip (₹99.50 is 99).
export function xpForTip(grossPaise: number): number {
  return Math.max(0, Math.floor(grossPaise / 100));
}

export const MAX_LEVEL = 50;

// XP needed to reach a level: level 2 at 100, 3 at 300, 4 at 600, 5 at 1,000 … (each level
// asks for 100 more than the step before). Level 1 starts at 0.
export function levelStartXp(level: number): number {
  const n = Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL);
  return 50 * n * (n - 1);
}

export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= levelStartXp(level + 1)) level += 1;
  return level;
}

// What the alert shows: the level after this tip, and whether this tip raised it.
export type FanLevel = { level: number; up: boolean };

export function levelAfterTip(xpNow: number, tipXp: number): FanLevel {
  const level = levelFor(xpNow);
  return { level, up: levelFor(Math.max(0, xpNow - tipXp)) < level };
}
