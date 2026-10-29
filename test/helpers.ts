import { expect, type Page } from "@playwright/test";

// What a visitor does to get past the home page's title screen: press a key.
// The page's content takes no clicks until then. A press before the page has
// woken up is ignored, so it is repeated until the title screen is gone, and
// nothing is pressed if it already is (a Space then would scroll the page).
export async function skipTitleScreen(page: Page) {
  const gone = () => page.evaluate(() => document.body.classList.contains("page-scrolled"));
  await expect
    .poll(
      async () => {
        if (await gone()) return true;
        await page.keyboard.press("Space");
        return gone();
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}
