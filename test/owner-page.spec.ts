import { expect, test } from "@playwright/test";
import { isOwnerTipPage } from "../src/lib/owner-page";

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
