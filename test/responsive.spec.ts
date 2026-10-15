import { expect, test, type Page } from "@playwright/test";

const widths = [320, 390, 1440] as const;
const publicRoutes = [
  "/",
  "/signup",
  "/signin",
  "/terms",
  "/privacy",
  "/refunds",
  "/delivery",
  "/contact",
  "/pricing",
  "/about",
];

async function documentWidth(page: Page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
}

// Scrolls to the bottom in small steps and returns the widest the document
// got on the way, since some sections only overflow mid-animation.
async function slowlyScrollToBottom(page: Page) {
  return page.evaluate(async () => {
    let widest = document.documentElement.scrollWidth;
    await new Promise<void>((resolve) => {
      const step = () => {
        widest = Math.max(widest, document.documentElement.scrollWidth);
        const bottom = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollBy(0, Math.min(240, Math.max(0, bottom - window.scrollY)));
        if (window.scrollY >= bottom - 1) resolve();
        else window.requestAnimationFrame(step);
      };

      step();
    });
    return Math.max(widest, document.documentElement.scrollWidth);
  });
}

test.describe("no horizontal overflow", () => {
  for (const route of publicRoutes) {
    test(`${route} stays within 320, 390, and 1440px viewports`, async ({ page }) => {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: "domcontentloaded" });

        await expect.poll(() => documentWidth(page)).toEqual({
          viewport: width,
          document: width,
        });

        if (route === "/") {
          expect(await slowlyScrollToBottom(page)).toBe(width);
          await expect.poll(() => documentWidth(page)).toEqual({
            viewport: width,
            document: width,
          });
        }
      }
    });
  }
});

// On stream's sample briefly shows a one-line approval row with a long
// message; it must truncate rather than widen the page on small phones.
test("On stream's approval row fits a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#stream [data-screen]").evaluate((screen) =>
    screen.scrollIntoView({ block: "center" }),
  );

  await expect(page.getByText("Waiting for your approval", { exact: true })).toBeVisible();
  expect((await documentWidth(page)).document).toBe(320);
});
