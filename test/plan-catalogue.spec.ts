import { expect, test } from "@playwright/test";
import { buildCatalogue } from "../src/lib/plan-catalogue";
import { FEATURES, NO_FEATURES, builtFeatureKeys, planFeatures } from "../src/lib/plans";
import { priceView } from "../src/lib/pricing";

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
