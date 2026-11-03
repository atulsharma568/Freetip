import { expect, test, type Page } from "@playwright/test";
import type { EditorFixtureControl } from "../src/app/dev-fixtures/editor/EditorFixture";

// The owner's tip page editor (page builder phase 2), through the test-only fixture
// (/dev-fixtures/editor: a made-up creator, an in-memory copy of the store's rules, and the real
// preview frame). The browser runs the editor and the preview exactly as in the owner console.

async function open(page: Page, query = "", width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/dev-fixtures/editor${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as { __editorFixture?: unknown }).__editorFixture));
}

const frame = (page: Page) => page.frameLocator('iframe[title^="Tip page preview"]');
const fixture = <T,>(page: Page, read: (f: EditorFixtureControl) => T) => page.evaluate((src) => new Function("f", `return (${src})(f)`)(window.__editorFixture), read.toString()) as Promise<T>;
const list = (page: Page) => page.getByRole("navigation", { name: "Blocks on the page" });
const block = (page: Page, name: RegExp | string) => list(page).getByRole("button", { name, exact: false }).first();
const rank = (page: Page, n: number) => page.getByRole("textbox", { name: `Rank ${n}`, exact: true });
const stepNumber = (page: Page, title: string) => frame(page).getByRole("heading", { name: title, level: 2 }).locator("xpath=preceding-sibling::span[1]");

async function ready(page: Page) {
  await expect(frame(page).getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
}

test.describe("opening the editor", () => {
  test("shows the real page in the preview, the blocks in sections and nothing unsaved", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await expect(page.getByText("Nothing changed yet")).toBeVisible();
    // The "your page isn't live yet" banner is for a creator previewing their own page, not here.
    await expect(frame(page).getByText("Preview: your page isn't live yet.")).toHaveCount(0);
    for (const section of ["Left column (on top on a phone)", "The form", "Under the form", "After a tip", "Behind the page"]) {
      await expect(list(page).getByRole("region", { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Revert to published" })).toBeDisabled();
    expect(await fixture(page, (f) => f.saves.length)).toBe(0);
  });

  test("on a narrow screen it asks for a laptop and shows no editor", async ({ page }) => {
    await open(page, "", 800);
    await expect(page.getByText("Open this page on a laptop to edit the tip page.")).toBeVisible();
    await expect(list(page)).toBeHidden();
  });
});

test.describe("changing words", () => {
  test("a word shows in the preview at once, before anything is saved", async ({ page }) => {
    await open(page);
    await ready(page);
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).fill("Go");
    await expect(frame(page).getByRole("heading", { name: "Go", level: 2 })).toBeVisible();
    await expect(frame(page).getByRole("heading", { name: "Send", level: 2 })).toHaveCount(0);
    await expect(page.getByText("Changes not saved yet")).toBeVisible();
    expect(await fixture(page, (f) => f.saves.length)).toBe(0);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });

  test("the empty field shows the standard wording as its hint, and a limit counter", async ({ page }) => {
    await open(page);
    await block(page, /^Send/).click();
    await expect(page.getByLabel(/^Heading/)).toHaveAttribute("placeholder", "Send");
    await expect(page.getByText("Left empty it says “Send”.")).toBeVisible();
    await page.getByLabel(/^Heading/).fill("Hello");
    await expect(page.getByText("5/30")).toBeVisible();
  });

  test("a handle with a slash is refused and says why", async ({ page }) => {
    await open(page, "?page=owner");
    await block(page, /^Links/).click();
    const handle = page.getByLabel(/^Instagram handle/);
    await handle.fill("acepressure.gg");
    await handle.press("/");
    await expect(page.getByText("Instagram handle can hold only letters, digits, dots and underscores.")).toBeVisible();
    await expect(handle).toHaveValue("acepressure.gg");
  });

  test("a click on a block in the preview picks it for editing", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await frame(page).getByRole("heading", { name: "Your note", level: 2 }).click();
    await expect(page.getByRole("heading", { name: /^Note/, level: 2 })).toBeVisible();
    await expect(block(page, /^Note/)).toHaveAttribute("aria-current", "true");
  });
});

test.describe("saving", () => {
  test("it saves once, a moment after typing stops, from no earlier draft", async ({ page }) => {
    await open(page);
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).pressSequentially("Go now", { delay: 80 });
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
    const saves = await fixture(page, (f) => f.saves);
    expect(saves).toHaveLength(1);
    expect(saves[0].base).toBeNull();
    await page.waitForTimeout(2200);
    expect(await fixture(page, (f) => f.saves.length)).toBe(1);
    // The next save carries the draft the first one returned.
    await page.getByLabel(/^Heading/).fill("Go later");
    await expect.poll(() => fixture(page, (f) => f.saves.length), { timeout: 6000 }).toBe(2);
    const second = (await fixture(page, (f) => f.saves))[1];
    expect(second.base).not.toBeNull();
  });

  test("a save that finds the draft changed elsewhere stops saving and says so", async ({ page }) => {
    await open(page);
    await block(page, /^Send/).click();
    await page.evaluate(() => (window.__editorFixture!.conflictNext = true));
    await page.getByLabel(/^Heading/).fill("One");
    await expect(page.getByText("Changed somewhere else", { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole("button", { name: "Reload the latest draft" })).toBeVisible();
    await expect(page.getByText(/Saving has stopped so nothing is overwritten/)).toBeVisible();
    await page.getByLabel(/^Heading/).fill("Two");
    await page.waitForTimeout(2200);
    expect(await fixture(page, (f) => f.saves.length)).toBe(1);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });

  test("a slow save keeps the editor usable and the next change is saved after it", async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window.__editorFixture!.delayMs = 800));
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).fill("A");
    await expect(page.getByText("Saving…")).toBeVisible({ timeout: 4000 });
    await page.getByLabel(/^Heading/).fill("AB");
    await expect.poll(() => fixture(page, (f) => f.saves.length), { timeout: 8000 }).toBe(2);
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
  });
});

test.describe("order and visibility", () => {
  test("the buttons move a block and the steps follow", async ({ page }) => {
    await open(page);
    await ready(page);
    expect(await stepNumber(page, "Your note").textContent()).toBe("2");
    await page.getByRole("button", { name: "Move Note up" }).click();
    await expect(stepNumber(page, "Your note")).toHaveText("1");
    await expect(stepNumber(page, "Amount")).toHaveText("2");
    await expect(page.getByText("Moved Note up. Now 1 of 3.")).toBeAttached();
    await expect(page.getByRole("button", { name: "Move Note up" })).toBeDisabled();
  });

  test("the keyboard moves a block", async ({ page }) => {
    await open(page);
    await ready(page);
    const down = page.getByRole("button", { name: "Move Amount down" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(stepNumber(page, "Amount")).toHaveText("2");
    await expect(stepNumber(page, "Your note")).toHaveText("1");
  });

  test("dragging a row onto another in its section moves it", async ({ page }) => {
    await open(page);
    await ready(page);
    const row = (name: string) => list(page).locator("li", { has: page.getByRole("button", { name: `Move ${name} up` }) });
    await row("Send").dragTo(row("Amount"));
    await expect(stepNumber(page, "Send")).toHaveText("1");
    await expect(stepNumber(page, "Amount")).toHaveText("2");
  });

  test("hiding the QR removes it from the preview, and it can come back", async ({ page }) => {
    await open(page);
    await ready(page);
    await page.getByRole("button", { name: "Laptop" }).click();
    await expect(frame(page).getByText("Scan to tip from your phone")).toBeVisible();
    await page.getByRole("button", { name: "Hide QR code" }).click();
    await expect(frame(page).getByText("Scan to tip from your phone")).toHaveCount(0);
    await expect(list(page).getByText("Hidden")).toBeVisible();
    await page.getByRole("button", { name: "Show QR code" }).click();
    await expect(frame(page).getByText("Scan to tip from your phone")).toBeVisible();
  });

  test("the header, amount, note and send blocks are required: no eye", async ({ page }) => {
    await open(page);
    for (const name of ["Header", "Amount", "Note", "Send"]) {
      await expect(page.getByRole("button", { name: `Hide ${name}` })).toHaveCount(0);
    }
    await expect(list(page).getByText("Required")).toHaveCount(4);
  });

  test("the phone view is a phone-sized screen and the laptop view is two columns", async ({ page }) => {
    await open(page);
    await ready(page);
    const width = () => page.frames().find((f) => f.url().includes("/dev-fixtures/preview"))!.evaluate(() => window.innerWidth);
    expect(await width()).toBe(390);
    await page.getByRole("button", { name: "Laptop" }).click();
    await expect.poll(width).toBe(1280);
    await expect(frame(page).getByText("Preview on stream", { exact: true }).first()).toBeVisible();
  });
});

test.describe("colours", () => {
  test("a pair that cannot be read is refused with the ratios, and the page keeps its colour", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Page colours/).click();
    await page.getByLabel(/^Accent \(#rrggbb\)/).fill("#2a2a2a");
    await expect(page.locator('ul[role="alert"]')).toContainText("The page keeps the last good colours");
    await expect(page.getByLabel("Colour checks")).toContainText("Colour on the page");
    await expect(page.getByLabel("Colour checks")).toContainText("too low");
    const button = frame(page).getByRole("button", { name: /^Tip/ });
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(202, 27, 25)");
  });

  test("a colour that passes is applied to the preview", async ({ page }) => {
    await open(page);
    await ready(page);
    await block(page, /^Page colours/).click();
    await page.getByRole("button", { name: "Owner red #ca1b19" }).click();
    await expect(page.getByLabel("Colour checks")).toContainText("✓");
    const button = frame(page).getByRole("button", { name: /^Tip/ });
    await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(202, 27, 25)");
    await expect(page.getByText("Changes not saved yet").or(page.getByText("Draft saved"))).toBeVisible();
  });

  test("the creator's own colour takes the page colours away", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Page colours/).click();
    await page.getByRole("button", { name: "Creator's own colour" }).click();
    const button = frame(page).getByRole("button", { name: /^Tip/ });
    await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgb(202, 27, 25)");
  });
});

test.describe("the rank bar", () => {
  test("a valid change shows at once, an invalid one says why and keeps the last good bar", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Amount/).click();
    await expect(frame(page).getByRole("img", { name: /^Pressure: Rookie/ })).toBeVisible();
    await rank(page, 1).fill("Cadet");
    await expect(frame(page).getByRole("img", { name: /^Pressure: Cadet/ })).toBeVisible();
    await rank(page, 1).fill("");
    await expect(page.getByText("Rank 1 needs a word.")).toBeVisible();
    await expect(frame(page).getByRole("img", { name: /^Pressure: Cadet/ })).toBeVisible();
    await rank(page, 1).fill("Cadet again");
    await expect(page.getByText("Rank 1 needs a word.")).toHaveCount(0);
    await page.getByLabel("The bar is full at (₹)").fill("50");
    await expect(page.getByText(/top of the bar must be between/)).toBeVisible();
  });

  test("a rank can be added and removed, and the bar can be turned off", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Amount/).click();
    await expect(page.getByRole("textbox", { name: /^Rank \d$/ })).toHaveCount(5);
    await page.getByRole("button", { name: "Add a rank" }).click();
    await expect(page.getByRole("textbox", { name: /^Rank \d$/ })).toHaveCount(6);
    await page.getByRole("button", { name: "Remove rank 2" }).click();
    await expect(page.getByRole("textbox", { name: /^Rank \d$/ })).toHaveCount(5);
    await page.getByLabel("Show the rank bar under the amount").uncheck();
    await expect(frame(page).getByRole("img", { name: /^Pressure:/ })).toHaveCount(0);
    await page.getByLabel("Show the rank bar under the amount").check();
    await expect(frame(page).getByRole("img", { name: /^Pressure:/ })).toBeVisible();
  });

  test("the standard words come back", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Amount/).click();
    await rank(page, 1).fill("Zed");
    await page.getByRole("button", { name: "Use the standard words" }).click();
    await expect(rank(page, 1)).toHaveValue("Rookie");
    await expect(frame(page).getByRole("img", { name: /^Pressure: Rookie/ })).toBeVisible();
  });
});

test.describe("publishing and reverting", () => {
  test("publish waits for a saved draft, asks once, and then there is nothing left to publish", async ({ page }) => {
    await open(page);
    await ready(page);
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).fill("Go");
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
    expect(await fixture(page, (f) => f.publishes)).toBe(0);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Publish this draft\?/)).toBeVisible();
    expect(await fixture(page, (f) => f.publishes)).toBe(0);
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Published. Fans see this page now.")).toBeVisible();
    expect(await fixture(page, (f) => f.publishes)).toBe(1);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    expect(await fixture(page, (f) => f.published!.blocks.find((b) => b.type === "send")!.settings)).toMatchObject({ heading: "Go" });
  });

  test("reverting throws the draft away after asking, and the page goes back", async ({ page }) => {
    await open(page);
    await ready(page);
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).fill("Go");
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
    await page.getByRole("button", { name: "Revert to published" }).click();
    await expect(page.getByText(/Throw the draft away/)).toBeVisible();
    await page.getByRole("button", { name: "Revert", exact: true }).click();
    await expect(page.getByText("Back to the published page. The draft is gone.")).toBeVisible();
    await expect(frame(page).getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
    expect(await fixture(page, (f) => f.discards)).toBe(1);
    await expect(page.getByText("Nothing changed yet")).toBeVisible();
  });

  test("cancelling the question changes nothing", async ({ page }) => {
    await open(page);
    await block(page, /^Send/).click();
    await page.getByLabel(/^Heading/).fill("Go");
    await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 6000 });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(await fixture(page, (f) => f.publishes)).toBe(0);
    await expect(page.getByText(/Publish this draft\?/)).toHaveCount(0);
  });
});

test.describe("the editor's own accessibility", () => {
  test("every button, field and choice has a name", async ({ page }) => {
    await open(page, "?page=owner");
    await ready(page);
    await block(page, /^Amount/).click();
    const main = page.locator("main, body").first();
    const snapshot = await main.ariaSnapshot();
    const unnamed = snapshot.split("\n").filter((line) => /^\s*- (button|textbox|combobox|checkbox|radio|spinbutton)(\s+\[[^\]]*\])*:?\s*$/.test(line));
    expect(unnamed).toEqual([]);
  });

  test("the moves are announced in a polite live region", async ({ page }) => {
    await open(page);
    await ready(page);
    await page.getByRole("button", { name: "Move Send up" }).click();
    const live = page.locator('p[aria-live="polite"]');
    await expect(live).toHaveText("Moved Send up. Now 2 of 3.");
  });
});

test.describe("pictures", () => {
  const add = (page: Page) => list(page).getByRole("button", { name: "Add a picture or video behind the page" });
  const file = (page: Page, name: RegExp | string) => page.getByRole("button", { name, exact: false }).first();
  const status = (page: Page) => page.getByRole("status").filter({ hasText: /Draft saved|Changes not saved|Saving|Nothing changed/ }).first();

  test("a page without a backdrop can be given one, which is a picture backdrop with no picture yet", async ({ page }) => {
    await open(page);
    await ready(page);
    await expect(list(page).getByRole("button", { name: /^Backdrop/ })).toHaveCount(0);
    await add(page).click();
    await expect(add(page)).toHaveCount(0);
    await expect(list(page).getByRole("region", { name: "Behind the page", exact: true }).getByRole("button", { name: /^Backdrop/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Backdrop" })).toHaveValue("media");
    // The library's files are offered, the video too.
    for (const name of ["Kitsune", "Embers", "Loop"]) await expect(file(page, new RegExp(`^${name},`))).toBeVisible();
    await expect(page.getByText("0/10 files").or(page.getByText("3/10 files"))).toBeVisible();
  });

  test("picking a file draws it in the preview at once, and the darkening slider appears", async ({ page }) => {
    await open(page);
    await ready(page);
    await add(page).click();
    await expect(page.getByLabel(/^Darken the picture/)).toHaveValue("40");
    await file(page, /^Kitsune,/).click();
    await expect(frame(page).locator('div.fixed.-z-10 img[src="/owner/kitsune.svg"]')).toHaveCount(1);
    await expect(file(page, /^Kitsune,/)).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel(/^Darken the picture/).fill("70");
    await expect(page.getByText("70%")).toBeVisible();
    const layer = frame(page).locator("div.fixed.-z-10 div.absolute.inset-0");
    await expect.poll(async () => Number(await layer.evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.7, 1);
    await expect(page.getByText("Changes not saved yet").or(page.getByText("Saving…")).or(page.getByText("Draft saved"))).toBeVisible();
  });

  test("choosing the smoke style hides the picture controls, and None takes the picture off", async ({ page }) => {
    await open(page);
    await ready(page);
    await add(page).click();
    await file(page, /^Embers,/).click();
    await page.getByRole("button", { name: "None", exact: true }).click();
    await expect(file(page, /^Embers,/)).toHaveAttribute("aria-pressed", "false");
    await expect(frame(page).locator("div.fixed.-z-10 img")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Backdrop" }).selectOption("ember");
    await expect(page.getByLabel(/^Darken the picture/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Picture", level: 3 })).toHaveCount(0);
  });

  test("the header takes a picture or GIF as its banner, never a video", async ({ page }) => {
    await open(page);
    await ready(page);
    await block(page, /^Header/).click();
    await expect(page.getByRole("heading", { name: "Banner picture", level: 3 })).toBeVisible();
    await expect(file(page, /^Kitsune,/)).toBeVisible();
    await expect(file(page, /^Embers,/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Loop,/ })).toHaveCount(0);
    await file(page, /^Kitsune,/).click();
    await expect(frame(page).locator('section[aria-label="Creator"] div.aspect-\\[16\\/5\\] img')).toHaveCount(1);
  });

  test("Replace is offered only once a picture is chosen", async ({ page }) => {
    await open(page);
    await ready(page);
    await add(page).click();
    await expect(page.getByRole("button", { name: /^Replace/ })).toHaveCount(0);
    await file(page, /^Embers,/).click();
    await expect(page.getByRole("button", { name: "Replace “Embers”" })).toBeVisible();
    await expect(page.getByText("Replace changes the draft only", { exact: false })).toBeVisible();
  });

  test("a file no page uses can be removed after asking, and one the draft uses cannot be", async ({ page }) => {
    await open(page);
    await ready(page);
    await add(page).click();
    await file(page, /^Embers,/).click();
    await expect(page.getByText("Draft saved")).toBeVisible();

    // The unused file goes after "Delete".
    await page.getByRole("button", { name: "Remove Kitsune" }).click();
    await expect(page.getByRole("button", { name: "Keep" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Removed. The file is deleted.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kitsune,/ })).toHaveCount(0);
    expect(await fixture(page, (f) => f.removed)).toEqual([1]);

    // The one the draft uses cannot be removed at all: the button is off until it is taken off the page.
    await expect(page.getByRole("button", { name: "Remove Embers" })).toBeDisabled();
    await expect(file(page, /^Embers,/)).toBeVisible();
    expect(await fixture(page, (f) => f.removed)).toEqual([1]);
    // Taking it off the page turns the button back on.
    await page.getByRole("button", { name: "None", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Embers" })).toBeEnabled();
  });

  test("Keep cancels a removal", async ({ page }) => {
    await open(page);
    await ready(page);
    await add(page).click();
    await page.getByRole("button", { name: "Remove Loop" }).click();
    await page.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    expect(await fixture(page, (f) => f.removed)).toEqual([]);
    void status;
  });
});
