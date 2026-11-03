import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openFixture } from "./helpers/fixture";

// The tip page through the test-only fixture route (/dev-fixtures/tip, a made-up creator, no
// database). The ARIA snapshots in test/snapshots were taken from the page as it was BEFORE it
// was rebuilt from blocks (page builder phase 1), so they are the record of "today": the
// structure, words, order and roles a screen reader gets. Regenerate them only on purpose, with
// WRITE_SNAPSHOTS=1, and say why in the commit.
const WRITE = process.env.WRITE_SNAPSHOTS === "1";
const SNAP_DIR = join(__dirname, "snapshots");

async function expectAriaSnapshot(page: Page, file: string) {
  const actual = `${(await page.locator("body").ariaSnapshot()).trimEnd()}\n`;
  const path = join(SNAP_DIR, file);
  if (WRITE) {
    writeFileSync(path, actual);
    return;
  }
  expect(actual).toBe(readFileSync(path, "utf8"));
}

const PAGES = ["default", "owner"] as const;

test.describe("the tip page keeps its structure", () => {
  for (const kind of PAGES) {
    for (const width of [1280, 390]) {
      test(`${kind} page at ${width}px matches the recorded structure`, async ({ page }) => {
        await openFixture(page, `?page=${kind}`, width);
        await expectAriaSnapshot(page, `tip-page-${kind}-${width}.aria.yml`);
      });
    }
    test(`${kind} success screen matches the recorded structure`, async ({ page }) => {
      await openFixture(page, `?page=${kind}&view=success`, 390);
      await expectAriaSnapshot(page, `tip-success-${kind}.aria.yml`);
    });
  }
});

test.describe("no horizontal overflow on the tip page", () => {
  for (const kind of PAGES) {
    for (const width of [320, 390, 1440]) {
      test(`${kind} page stays within ${width}px`, async ({ page }) => {
        await openFixture(page, `?page=${kind}`, width);
        await expect
          .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
          .toEqual({ viewport: width, document: width });
      });
    }
  }
});
