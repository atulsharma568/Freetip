import { expect, test, type Page } from "@playwright/test";
import { openFixture } from "../helpers/fixture";

// The page builder phase 1 gate: the owner page and a normal creator page must look and behave
// as they did before they were rebuilt from blocks. See playwright.gate.config.ts for how to
// record the baseline (from the commit that is "today") and how to compare.
const PAGES = ["default", "owner"] as const;
const WIDTHS = [320, 390, 1280] as const;
const TAB_PRESSES = 60;

// Where focus lands on each Tab: the element's tag, accessible name and a bit of its text.
async function tabOrder(page: Page): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  for (let i = 0; i < TAB_PRESSES; i += 1) {
    await page.keyboard.press("Tab");
    const here = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "(body)";
      const name = el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.id ?? "";
      return `${el.tagName.toLowerCase()}|${el.getAttribute("role") ?? ""}|${name}|${(el.innerText ?? "").trim().slice(0, 30)}`;
    });
    if (here === "(body)" && seen.length > 0) break;
    seen.push(here);
  }
  return seen;
}

for (const kind of PAGES) {
  test.describe(`${kind} tip page`, () => {
    for (const width of WIDTHS) {
      test(`looks the same at ${width}px`, async ({ page }) => {
        await openFixture(page, `?page=${kind}`, width);
        await expect(page).toHaveScreenshot(`${kind}-${width}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.002,
        });
      });
    }

    test("has the same tab order at 1280px and 390px", async ({ page }) => {
      for (const width of [1280, 390]) {
        await openFixture(page, `?page=${kind}`, width);
        expect(JSON.stringify(await tabOrder(page), null, 1)).toMatchSnapshot(`${kind}-${width}.tabs.json`);
      }
    });

    test("success screen looks the same at 390px", async ({ page }) => {
      await openFixture(page, `?page=${kind}&view=success`, 390);
      await expect(page).toHaveScreenshot(`${kind}-success-390.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
      });
    });

    test("has its text in the served HTML", async ({ request }) => {
      const res = await request.get(`/dev-fixtures/tip?page=${kind}`);
      const html = await res.text();
      expect(html).toContain(kind === "owner" ? "AcePressure" : "Sample Creator");
      for (const word of ["Amount", "Your note", "Send"]) expect(html).toContain(word);
    });
  });
}
