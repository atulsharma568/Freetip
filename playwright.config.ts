import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:3300",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "webkit-iphone",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3300",
    url: "http://localhost:3300",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: "",
      WAITLIST_SALT: "",
      CRON_SECRET: "",
    } as Record<string, string>,
  },
});
