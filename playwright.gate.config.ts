import { defineConfig, devices } from "@playwright/test";

// The "identical to today" gate for the tip page (page builder phase 1). It compares the page
// against screenshots and a tab-order record kept in test-baseline/ (git-ignored: pictures
// depend on the machine, so each machine records its own from the commit it wants to compare
// against). Record, from the commit that is "today":
//   npx playwright test -c playwright.gate.config.ts --update-snapshots
// Compare, from the commit being checked:
//   npx playwright test -c playwright.gate.config.ts
// Set GATE_CHANNEL=chrome to use an installed Chrome when Playwright's Chromium is missing.
// A running server on port 3300 started with PAGE_FIXTURES=1 is reused.
export default defineConfig({
  testDir: "./test/gate",
  testMatch: "*.gate.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/gate",
  snapshotPathTemplate: "test-baseline/{arg}{ext}",
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3300", trace: "retain-on-failure" },
  projects: [
    {
      name: "gate-desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.GATE_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3300",
    url: "http://localhost:3300",
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      DATABASE_URL: "",
      WAITLIST_SALT: "",
      CRON_SECRET: "",
      PAGE_FIXTURES: "1",
    } as Record<string, string>,
  },
});
