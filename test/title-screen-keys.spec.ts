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
  // The CSS failsafe runs on real time, not the fake clock: switch it off here so a
  // slow test run can't have it reveal the page part-way through.
  await page.addStyleTag({ content: ":root{--title-failsafe:1000s}" });
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
  for (let i = 0; i < 120 && !(await page.evaluate(titleScreenUp)); i++) {
    await page.clock.runFor(250);
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
  // Running the splash forward draws every frame of it, which takes a while when the
  // machine is busy; the default 30 s was not always enough.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await openTitleScreen(page);
  });

  test("a space typed into a field is kept and does not dismiss the title screen", async ({ page }) => {
    // A field of our own, outside the hidden page: focusing one inside it ends the title screen.
    const field = page.locator("#probe-field");
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "probe-field";
      document.body.appendChild(input);
      input.focus();
    });
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

  test("Tabbing into the hidden page ends the title screen instead of stranding focus", async ({ page }) => {
    await page.keyboard.press("Tab"); // the skip link is visible, so this is fine
    expect(await pageScrolled(page)).toBe(false);
    await page.keyboard.press("Tab"); // the first control in the hidden page
    expect(await pageScrolled(page)).toBe(true);
  });

  test("the hidden page takes no clicks, and a click on the title screen continues", async ({ page }) => {
    const hidden = page.locator(".page-content");
    await expect(hidden).toHaveCSS("pointer-events", "none");
    const link = page.locator(".page-content a[href]").first();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    expect(new URL(page.url()).pathname).toBe("/"); // the invisible link was not followed
    expect(await pageScrolled(page)).toBe(true);
  });

  test("a 'scroll' cue appears after a moment and goes when the title screen does", async ({ page }) => {
    const cue = page.locator("[data-title-cue]");
    await expect(cue).toHaveCSS("opacity", "0");
    await page.clock.runFor(1_500);
    await expect(cue).toHaveCSS("opacity", "1");
    await page.keyboard.press("Space");
    await expect(cue).toHaveCSS("opacity", "0");
  });

  test("the entry animations wait through the title screen, then still play", async ({ page }) => {
    const enter = page.locator(".page-content .enter").first();
    // Paused on the first frame while the title screen is up (CSS animations run on
    // real time, not the fake clock, so give them time to show they really are held).
    await page.waitForTimeout(1_500);
    await expect(enter).toHaveCSS("opacity", "0");
    await page.keyboard.press("Space"); // ends the title screen
    // Once it ends they play out as before and finish visible.
    await expect(enter).toHaveCSS("opacity", "1", { timeout: 8_000 });
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
