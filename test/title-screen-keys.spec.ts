import { expect, test, type Page } from "@playwright/test";

// The title screen (after the splash, before the first scroll) swallows the
// first scroll gesture so it only dismisses the title. These pin down what it
// must NOT swallow, and that it lets go once it is gone.

// The title screen only lasts a few seconds before a timer ends it, so the page
// runs on Playwright's fake clock: time stands still until the test moves it.
// That keeps these tests independent of how busy the machine is.
const titleScreenUp = () =>
  document.body.dataset.splash === "true" &&
  !document.body.classList.contains("page-scrolled") &&
  !document.querySelector(".fixed.inset-0.z-\\[100\\]");

async function openTitleScreen(page: Page) {
  await page.clock.install();
  await page.goto("/");
  // The fake clock runs on after install until paused; pause it a little ahead of
  // the page's own time (a slow load can overtake the first try, so try again).
  for (let margin = 2_000; ; margin *= 2) {
    const now = await page.evaluate(() => Date.now());
    try {
      await page.clock.pauseAt(new Date(now + margin));
      break;
    } catch (error) {
      if (margin > 16_000) throw error;
    }
  }
  // Run the splash forward until it hands over to the title screen.
  for (let i = 0; i < 300 && !(await page.evaluate(titleScreenUp)); i++) {
    await page.clock.runFor(100);
  }
  expect(await page.evaluate(titleScreenUp)).toBe(true);
}

// Fire a bare event at the window and say whether the page called preventDefault on it.
const fire = (page: Page, type: string) =>
  page.evaluate((t) => {
    const event = new Event(t, { bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, type);

const pageScrolled = (page: Page) =>
  page.evaluate(() => document.body.classList.contains("page-scrolled"));

test.describe("title screen keys", () => {
  test.beforeEach(async ({ page }) => {
    await openTitleScreen(page);
  });

  test("a space typed into a field is kept and does not dismiss the title screen", async ({ page }) => {
    const field = page.locator("input[type=text], input:not([type])").first();
    await field.evaluate((el) => (el as HTMLInputElement).focus());
    await page.keyboard.type(" b"); // the first key is the space
    await expect(field).toHaveValue(" b");
    expect(await pageScrolled(page)).toBe(false);
  });

  test("Space on a focused button activates it", async ({ page }) => {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.addEventListener("click", () => ((window as unknown as { clicked: boolean }).clicked = true));
      document.body.appendChild(button);
      button.focus();
    });
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => (window as unknown as { clicked?: boolean }).clicked)).toBe(true);
  });

  test("the first Space only dismisses the title screen and does not scroll", async ({ page }) => {
    await page.keyboard.press("Space");
    expect(await pageScrolled(page)).toBe(true);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  });

  test("a Tab first does not stop Space from dismissing the title screen", async ({ page }) => {
    await page.keyboard.press("Tab");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Space");
    expect(await pageScrolled(page)).toBe(true);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  });

  test("a custom focusable widget keeps its Space too", async ({ page }) => {
    await page.evaluate(() => {
      const widget = document.createElement("div"); // no role: only the tab stop marks it
      widget.tabIndex = 0;
      document.body.appendChild(widget);
      widget.focus();
      // Added last, so it runs after the title screen's own key handler.
      window.addEventListener("keydown", (e) => ((window as unknown as { blocked: boolean }).blocked = e.defaultPrevented));
    });
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => (window as unknown as { blocked?: boolean }).blocked)).toBe(false);
    expect(await pageScrolled(page)).toBe(false);
  });

  test("the first touch only dismisses the title screen, then touch is left alone", async ({ page }) => {
    expect(await fire(page, "touchmove")).toBe(true); // swallowed: it only dismisses the title
    expect(await pageScrolled(page)).toBe(true);
    expect(await fire(page, "touchmove")).toBe(false);
  });

  test("once the title screen has timed out, touch is left alone", async ({ page }) => {
    await page.clock.fastForward(6_000);
    expect(await pageScrolled(page)).toBe(true);
    expect(await fire(page, "touchmove")).toBe(false);
  });

  // Not checked through preventDefault: the smooth-scroll library calls it on every
  // wheel event itself once the page is live. What matters is that the page moves.
  test("once the title screen has timed out, the first mouse wheel scrolls the page", async ({ page }) => {
    await page.clock.fastForward(6_000);
    expect(await pageScrolled(page)).toBe(true);
    await page.clock.runFor(1_000); // the smooth scroller wakes up and animates on the clock
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 600);
    await page.clock.runFor(1_500);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
  });

  test("once the title screen has timed out, the first Space scrolls the page", async ({ page }) => {
    // Jump past the 5.2 s hold in one step (no need to animate the frames in between):
    // the timer fires and dismisses the title screen.
    await page.clock.fastForward(6_000);
    expect(await pageScrolled(page)).toBe(true);
    await page.keyboard.press("Space");
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);
  });
});
