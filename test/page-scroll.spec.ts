import { expect, test } from "@playwright/test";

// Only the home page has a title screen that locks scrolling. Every other page
// must scroll normally: by keyboard, and by finger on a phone.
const LONG_PAGES = ["/terms", "/privacy"];
const OTHER_PAGES = [...LONG_PAGES, "/pricing", "/contact", "/signin", "/does-not-exist"];

const scrollY = () => Math.round(window.scrollY);

test("the home page still locks scrolling while its title screen is up", async ({ page }) => {
  await page.goto("/");
  const state = await page.evaluate(() => ({
    overflow: getComputedStyle(document.body).overflow,
    scrolled: document.body.classList.contains("page-scrolled"),
    contentOpacity: getComputedStyle(document.querySelector(".page-content")!).opacity,
  }));
  expect(state).toEqual({ overflow: "hidden", scrolled: false, contentOpacity: "0" });
});

test.describe("pages without a title screen scroll normally", () => {
  for (const route of OTHER_PAGES) {
    test(`${route} is not scroll-locked`, async ({ page }) => {
      await page.goto(route);
      const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
      expect(overflow).not.toBe("hidden");
    });
  }

  for (const route of LONG_PAGES) {
    test(`${route} scrolls with the keyboard`, async ({ page }) => {
      await page.goto(route);
      await page.keyboard.press("PageDown");
      await expect.poll(() => page.evaluate(scrollY)).toBeGreaterThan(0);
    });

    test(`${route} scrolls with a finger swipe`, async ({ page, isMobile }) => {
      test.skip(!isMobile, "a finger swipe needs the touch-emulated phone project");
      await page.goto(route, { waitUntil: "load" });
      const cdp = await page.context().newCDPSession(page);
      // On a slow CI runner the first gesture can land before the page is ready to
      // scroll, so swipe again until it moves instead of swiping once.
      await expect
        .poll(
          async () => {
            // Raw touch events (start, a series of moves, end) rather than the
            // scroll-gesture shortcut, which does nothing on the CI runner.
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 700 }] });
            for (let y = 700; y >= 300; y -= 40) {
              await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] });
            }
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            return page.evaluate(scrollY);
          },
          { timeout: 15_000, intervals: [500, 1000, 1000] },
        )
        .toBeGreaterThan(0);
    });
  }
});
