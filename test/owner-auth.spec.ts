import { expect, test } from "@playwright/test";
import { isOwnerGoogleId, parseOwnerGoogleIds } from "@/lib/owner-auth-core";

test.describe("owner authorization helpers", () => {
  test("parses comma-separated Google IDs and ignores blank entries", () => {
    expect(parseOwnerGoogleIds(" owner-a, ,owner-b ")).toEqual([
      "owner-a",
      "owner-b",
    ]);
  });

  test("authorizes only an exact configured Google ID", () => {
    expect(isOwnerGoogleId("owner-a", ["owner-a", "owner-b"])).toBe(true);
    expect(isOwnerGoogleId("owner", ["owner-a", "owner-b"])).toBe(false);
    expect(isOwnerGoogleId(undefined, ["owner-a"])).toBe(false);
  });
});
