import { defineConfig } from "@playwright/test";

// For specs that only import pure modules or run SQL in memory: no build, no
// server, no browser. Name the files on the command line, for example
// `npx playwright test -c playwright.unit.config.ts test/money.spec.ts`.
export default defineConfig({
  testDir: "./test",
  fullyParallel: true,
  timeout: 30_000,
  outputDir: "test-results",
  reporter: [["list"]],
});
