import type { Page } from "@playwright/test";

// Opens the test-only tip page (/dev-fixtures/tip, a made-up creator, no database) in a settled
// state: no motion, fonts and pictures loaded, and no share sheet (the success screen's words
// differ between browsers that have one and browsers that do not).
export async function openFixture(page: Page, query: string, width: number, height = 900) {
  await page.addInitScript(() => {
    try {
      delete (Navigator.prototype as unknown as Record<string, unknown>).share;
      delete (Navigator.prototype as unknown as Record<string, unknown>).canShare;
    } catch {
      // Nothing to remove.
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await page.goto(`/dev-fixtures/tip${query}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
}
