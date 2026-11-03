import { expect, test } from "@playwright/test";
import { isOwnerTipPage } from "../src/lib/owner-page";
import { ownerPageDoc } from "../src/lib/page-doc/defaults";
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
  const { accent, ink } = ownerPageDoc().theme;
  expect(accent).toBe("#ca1b19");
  expect(contrast(accent!, ink!)).toBeGreaterThanOrEqual(4.5);
});
