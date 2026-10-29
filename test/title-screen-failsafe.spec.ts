import { expect, test } from "@playwright/test";

// If the page's scripts fail or are blocked, nothing ever ends the title screen.
// A CSS failsafe has to reveal the page anyway. Its real delay is 15 s; here it is
// shortened to 1 s through the --title-failsafe variable.
test("if scripts fail, the page is revealed and unlocked by the CSS failsafe", async ({ page }) => {
  await page.route("**/*.js", (route) => route.abort()); // no hydration: nothing adds page-scrolled
  await page.goto("/");

  const read = () =>
    page.evaluate(() => {
      const content = document.querySelector(".page-content")!;
      const enter = document.querySelector(".page-content .enter")!;
      const overlay = document.querySelector("[data-splash-overlay]")!;
      return {
        overflow: getComputedStyle(document.body).overflow,
        contentOpacity: getComputedStyle(content).opacity,
        clicks: getComputedStyle(content).pointerEvents,
        overlay: getComputedStyle(overlay).visibility,
        // An entry-animated element (the page's headline block): paused on its first
        // frame, invisible, until something lets it finish.
        entryOpacity: getComputedStyle(enter).opacity,
        entryTransform: getComputedStyle(enter).transform,
        scrolled: document.body.classList.contains("page-scrolled"),
      };
    });

  // Before the failsafe: blank, locked, covered and paused.
  const before = await read();
  expect(before).toMatchObject({
    overflow: "hidden",
    contentOpacity: "0",
    clicks: "none",
    overlay: "visible",
    entryOpacity: "0",
    scrolled: false,
  });
  expect(before.entryTransform).not.toBe("none");

  await page.addStyleTag({ content: ":root{--title-failsafe:1s}" });
  await expect
    .poll(read, { timeout: 8_000 })
    .toMatchObject({
      overflow: "visible",
      contentOpacity: "1",
      clicks: "auto",
      overlay: "hidden",
      entryOpacity: "1",
      scrolled: false, // still no script: the failsafe did it, not the page
    });
  // Settled in place (Chrome reports an animated "none" as the identity matrix).
  expect((await read()).entryTransform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});
