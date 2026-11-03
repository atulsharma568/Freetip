import { expect, test, type Page } from "@playwright/test";
import type { EditorFixtureControl } from "../src/app/dev-fixtures/editor/EditorFixture";

// Cases found by the independent review of page builder phase 2: a preview that never hears the
// frame is ready, a Publish that could send an older draft than the one on screen, a Revert that
// could race a save, and a change lost when the owner leaves the editor inside the site.

async function open(page: Page, query = "") {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/dev-fixtures/editor${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as { __editorFixture?: unknown }).__editorFixture));
}

const frame = (page: Page) => page.frameLocator('iframe[title^="Tip page preview"]');
const fixture = <T,>(page: Page, read: (f: EditorFixtureControl) => T) => page.evaluate((src) => new Function("f", `return (${src})(f)`)(window.__editorFixture), read.toString()) as Promise<T>;
const list = (page: Page) => page.getByRole("navigation", { name: "Blocks on the page" });
const sendBlock = (page: Page) => list(page).getByRole("button", { name: /^Send/ }).first();
const publish = (page: Page) => page.getByRole("button", { name: "Publish", exact: true });

test("the preview follows edits even when the frame's first 'ready' message never arrives", async ({ page }) => {
  // Drop the first ready message the frame sends, as if the editor had not been listening yet.
  await page.addInitScript(() => {
    let dropped = false;
    window.addEventListener(
      "message",
      (e) => {
        if (!dropped && (e.data as { type?: string } | null)?.type === "freetip-preview-ready") {
          dropped = true;
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  });
  await open(page);
  await expect(frame(page).getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
  await sendBlock(page).click();
  await page.getByLabel(/^Heading/).fill("Go");
  await expect(frame(page).getByRole("heading", { name: "Go", level: 2 })).toBeVisible({ timeout: 6000 });
});

test("a change made while the Publish question is open closes the question", async ({ page }) => {
  await open(page);
  await sendBlock(page).click();
  await page.getByLabel(/^Heading/).fill("Go");
  await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
  await publish(page).click();
  await expect(page.getByRole("button", { name: "Publish now" })).toBeVisible();
  await page.getByLabel(/^Heading/).fill("Go on");
  await expect(page.getByRole("button", { name: "Publish now" })).toHaveCount(0);
  await expect(publish(page)).toBeDisabled();
  expect(await fixture(page, (f) => f.publishes)).toBe(0);
  await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
  await publish(page).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Published. Fans see this page now.")).toBeVisible();
  expect(await fixture(page, (f) => f.published!.blocks.find((b) => b.type === "send")!.settings)).toMatchObject({ heading: "Go on" });
});

test("Revert is not offered while a save is on its way", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window.__editorFixture!.delayMs = 1200));
  await sendBlock(page).click();
  await page.getByLabel(/^Heading/).fill("Go");
  await expect(page.getByText("Saving…")).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole("button", { name: "Revert to published" })).toBeDisabled();
  await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("button", { name: "Revert to published" })).toBeEnabled();
});

test("leaving the editor inside the site saves the change that was waiting", async ({ page }) => {
  await open(page);
  await sendBlock(page).click();
  await page.getByLabel(/^Heading/).fill("Last words");
  await page.getByRole("link", { name: "Leave the editor (test)" }).click();
  await expect(page).toHaveURL(/\/dev-fixtures\/tip/);
  await expect.poll(() => fixture(page, (f) => f.saves.length), { timeout: 6000 }).toBe(1);
  expect(await fixture(page, (f) => f.draft!.blocks.find((b) => b.type === "send")!.settings)).toMatchObject({ heading: "Last words" });
});
