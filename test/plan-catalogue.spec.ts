import { expect, test } from "@playwright/test";
import { COMPARISON_GROUPS, CREATOR_EXTRA_KEYS, CUSTOM_KEYS, STARTER_KEYS, buildCatalogue, buildComparison, tierOf } from "../src/lib/plan-catalogue";
import { FEATURES, NO_FEATURES, builtFeatureKeys, planFeatures } from "../src/lib/plans";
import { TIER_PRICES, perMonthOfYear, priceView, yearSaving } from "../src/lib/pricing";

const items = (f = NO_FEATURES) => buildCatalogue(f).flatMap((g) => g.items);

test.describe("the paid features catalogue", () => {
  test("lists every built feature once, except pinned messages for a creator without them", () => {
    const keys = items().map((i) => i.key);
    const expected = FEATURES.filter((f) => f.built && f.key !== "highlightedMessages").map((f) => f.key);
    expect([...keys].sort()).toEqual([...expected].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("never offers a feature that is not built", () => {
    const notBuilt = FEATURES.filter((f) => !f.built).map((f) => f.key);
    for (const k of notBuilt) expect(items().map((i) => i.key)).not.toContain(k);
  });

  test("pinned messages show only once switched on", () => {
    expect(items().some((i) => i.key === "highlightedMessages")).toBe(false);
    const on = planFeatures({ paid_features: ["highlightedMessages"] });
    expect(items(on).find((i) => i.key === "highlightedMessages")?.on).toBe(true);
  });

  test("everything is off with no features, and a link appears only for what is on", () => {
    expect(items().every((i) => !i.on && i.href === null)).toBe(true);
    const all = planFeatures({ paid_features: builtFeatureKeys() });
    const shown = items(all);
    expect(shown.every((i) => i.on)).toBe(true);
    expect(shown.find((i) => i.key === "tipBanner")?.href).toBe("/dashboard/banner");
    expect(shown.find((i) => i.key === "regionalVoices")?.href).toBeNull();
  });

  test("a feature that needs another reads as off while that one is off", () => {
    const f = planFeatures({ paid_features: ["tipMarks"] });
    expect(items(f).find((i) => i.key === "tipMarks")?.on).toBe(false);
  });
});

test.describe("the plan tiers", () => {
  const offered = FEATURES.filter((f) => f.built && f.key !== "highlightedMessages");

  test("every offered feature is in exactly one tier, and pinned messages in none", () => {
    const all = [...STARTER_KEYS, ...CREATOR_EXTRA_KEYS, ...CUSTOM_KEYS];
    expect([...all].sort()).toEqual(offered.map((f) => f.key).sort());
    expect(new Set(all).size).toBe(all.length);
    expect(tierOf("highlightedMessages")).toBeNull();
  });

  test("a feature never sits in a cheaper tier than the one it needs", () => {
    const rank = { starter: 0, creator: 1, custom: 2 } as const;
    for (const f of offered) {
      for (const need of f.needs ?? []) {
        const a = tierOf(f.key);
        const b = tierOf(need);
        if (a && b && b !== "custom") expect(rank[b]).toBeLessThanOrEqual(rank[a]);
        // The Pressure meter needs the Custom page, so they are sold together.
        if (b === "custom") expect(a).toBe("custom");
      }
    }
  });

  test("the shown prices make sense", () => {
    for (const t of [TIER_PRICES.starter, TIER_PRICES.creator]) {
      expect(t.yearly).toBeLessThan(t.monthly * 12);
      expect(t.early.monthly).toBeLessThan(t.monthly);
      expect(t.early.yearly).toBeLessThan(t.yearly);
    }
    expect(TIER_PRICES.starter.monthly).toBeLessThan(TIER_PRICES.creator.monthly);
    expect(yearSaving(299, 2499)).toBe(30);
    expect(perMonthOfYear(2499)).toBe(208);
  });
});

test.describe("plan prices", () => {
  test("show nothing until both prices are set", () => {
    expect(priceView({ monthly: null, yearly: null, early: null })).toBeNull();
    expect(priceView({ monthly: 299, yearly: null, early: null })).toBeNull();
    expect(priceView({ monthly: 0, yearly: 100, early: null })).toBeNull();
  });

  test("work out what a year saves against twelve months", () => {
    expect(priceView({ monthly: 300, yearly: 2400, early: null })?.yearlySavingPercent).toBe(33);
    expect(priceView({ monthly: 100, yearly: 1200, early: null })?.yearlySavingPercent).toBe(0);
    expect(priceView({ monthly: 100, yearly: 1500, early: null })?.yearlySavingPercent).toBe(0);
  });

  test("keep the early price as given", () => {
    const early = { monthly: 149, yearly: 1299, seats: 50 };
    expect(priceView({ monthly: 299, yearly: 2499, early })?.early).toEqual(early);
  });
});

test.describe("the side-by-side table", () => {
  test("names every Starter and Creator feature exactly once, and no other", () => {
    const keys = COMPARISON_GROUPS.flatMap((g) => g.keys);
    expect([...keys].sort()).toEqual([...STARTER_KEYS, ...CREATOR_EXTRA_KEYS].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("a group is either all Starter features or all Creator-only ones", () => {
    for (const g of COMPARISON_GROUPS) {
      const want = g.creatorOnly ? "creator" : "starter";
      for (const k of g.keys) expect(tierOf(k)).toBe(want);
    }
  });

  test("marks Starter's ticks from the group, and keeps hand-ticked features in view", () => {
    const { groups, handPicked } = buildComparison(NO_FEATURES);
    for (const g of groups) for (const i of g.items) expect(i.inStarter).toBe(!g.creatorOnly);
    expect(handPicked).toEqual([]);
    const on = buildComparison(planFeatures({ paid_features: ["pageBuilder", "highlightedMessages", "alertText"] }));
    expect(on.handPicked.map((i) => i.key).sort()).toEqual(["highlightedMessages", "pageBuilder"]);
    expect(on.groups.flatMap((g) => g.items).find((i) => i.key === "alertText")?.on).toBe(true);
  });
});
