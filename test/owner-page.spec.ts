import { expect, test } from "@playwright/test";
import { isOwnerTipPage, OWNER_ACCENT, OWNER_INK, ownerThemeStyle, pressureFraction, pressureLevel } from "../src/lib/owner-page";
import { contrast } from "../src/lib/accent";

// Only the owner's own tip page gets the custom header.
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

test.describe("which tip page is the owner's", () => {
  test("the handle acepressure is, in any case", () => {
    expect(isOwnerTipPage("acepressure", "g1", env({}))).toBe(true);
    expect(isOwnerTipPage("AcePressure", "g1", env({}))).toBe(true);
  });

  test("another creator is not", () => {
    expect(isOwnerTipPage("someoneelse", "g1", env({}))).toBe(false);
  });

  test("an owner account is, whatever its handle", () => {
    expect(isOwnerTipPage("other", "g9", env({ OWNER_GOOGLE_IDS: "g8,g9" }))).toBe(true);
    expect(isOwnerTipPage("other", "g7", env({ OWNER_GOOGLE_IDS: "g8,g9" }))).toBe(false);
  });

  test("OWNER_TIP_HANDLES replaces the default handle", () => {
    expect(isOwnerTipPage("acepressure", "g1", env({ OWNER_TIP_HANDLES: "ace2" }))).toBe(false);
    expect(isOwnerTipPage("ace2", "g1", env({ OWNER_TIP_HANDLES: "ace2" }))).toBe(true);
  });
});

test("the owner's page shows the brand, which can be changed", async () => {
  const { ownerBrand } = await import("../src/lib/owner-page");
  expect(ownerBrand(env({}))).toBe("AcePressure");
  expect(ownerBrand(env({ OWNER_TIP_BRAND: " Ace " }))).toBe("Ace");
});

test("light ink on the owner's red reads well, and the red is the avatar collar's", () => {
  expect(OWNER_ACCENT).toBe("#ca1b19");
  expect(contrast(OWNER_ACCENT, OWNER_INK)).toBeGreaterThanOrEqual(4.5);
  expect(ownerThemeStyle["--color-accent"]).toBe(OWNER_ACCENT);
});

test.describe("the pressure bar", () => {
  test("is empty at the minimum and full at ₹5,000, rising in between", () => {
    expect(pressureFraction(20, 20)).toBe(0);
    expect(pressureFraction(5000, 20)).toBe(1);
    expect(pressureFraction(100, 20)).toBeGreaterThan(pressureFraction(50, 20));
    expect(pressureFraction(99999, 20)).toBe(1);
    expect(pressureFraction(0, 20)).toBe(0);
  });

  test("climbs the One Piece ladder", () => {
    const names = [0, 0.3, 0.6, 0.9, 1].map(pressureLevel);
    expect(names).toEqual(["Rookie", "Supernova", "Warlord", "Yonko", "Pirate King"]);
  });
});
