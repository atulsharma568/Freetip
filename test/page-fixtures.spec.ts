import { expect, test } from "@playwright/test";
import { fixturesEnabled } from "../src/lib/page-fixtures";

// The test-only tip page route (/dev-fixtures/tip) answers 404 unless PAGE_FIXTURES is exactly "1".
test.describe("the test-only fixture route switch", () => {
  test("is on only for PAGE_FIXTURES=1", () => {
    expect(fixturesEnabled({ PAGE_FIXTURES: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    for (const v of [undefined, "", "0", "true", "yes", " 1"]) {
      expect(fixturesEnabled({ PAGE_FIXTURES: v } as unknown as NodeJS.ProcessEnv)).toBe(false);
    }
    expect(fixturesEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  test("reads process.env when given nothing", () => {
    const before = process.env.PAGE_FIXTURES;
    try {
      process.env.PAGE_FIXTURES = "1";
      expect(fixturesEnabled()).toBe(true);
      delete process.env.PAGE_FIXTURES;
      expect(fixturesEnabled()).toBe(false);
    } finally {
      if (before === undefined) delete process.env.PAGE_FIXTURES;
      else process.env.PAGE_FIXTURES = before;
    }
  });
});
