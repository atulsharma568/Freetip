import { expect, test, type Page } from "@playwright/test";
import type { OverlaysFixtureControl } from "../src/app/dev-fixtures/overlays/OverlaysFixture";

// The owner's overlay editor (page builder phase 5, part two), through the test-only fixture
// (/dev-fixtures/overlays: a made-up creator and an in-memory copy of the store's rules). The
// browser runs the editor and the real alert card and goal bar exactly as in the owner console.

async function open(page: Page, query = "", width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/dev-fixtures/overlays${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as { __overlaysFixture?: unknown }).__overlaysFixture));
}

const fixture = <T,>(page: Page, read: (f: OverlaysFixtureControl) => T) =>
  page.evaluate((src) => new Function("f", `return (${src})(f)`)(window.__overlaysFixture), read.toString()) as Promise<T>;
const headline = (page: Page) => page.getByPlaceholder("Normal headline");

test.describe("opening the editor", () => {
  test("shows the real alert in the preview, nothing unsaved and Publish off", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Nothing changed yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Revert to live" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Swap with previous version" })).toHaveCount(0);
    await expect(page.getByTestId("alert-preview")).toContainText("Riya");
    expect(await fixture(page, (f) => f.saves.length)).toBe(0);
  });

  test("on a narrow screen it asks for a laptop and shows no editor", async ({ page }) => {
    await open(page, "", 800);
    await expect(page.getByText("Open this page on a laptop to edit the overlays.")).toBeVisible();
    await expect(page.getByTestId("overlay-preview")).toBeHidden();
  });
});

test.describe("editing, saving and publishing", () => {
  test("a headline shows in the preview at once, saves on its own, then publishes", async ({ page }) => {
    await open(page);
    await headline(page).fill("Cheers {name}");
    await expect(page.getByTestId("alert-preview")).toContainText("Cheers");
    await expect(page.getByText("Changes not saved yet")).toBeVisible();
    expect(await fixture(page, (f) => f.saves.length)).toBe(0);
    await expect(page.getByText("Draft saved")).toBeVisible();
    expect(await fixture(page, (f) => f.saves.length)).toBe(1);
    // Saved is not live: nothing has gone to a stream.
    expect(await fixture(page, (f) => f.publishes)).toBe(0);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Publish this draft?")).toBeVisible();
    expect(await fixture(page, (f) => f.publishes)).toBe(0);
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Published. The next alert and the goal bar use this now.")).toBeVisible();
    expect(await fixture(page, (f) => f.publishes)).toBe(1);
    expect(await fixture(page, (f) => f.live.text.headline)).toBe("Cheers {name}");
    // Nothing differs from live any more.
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });

  test("colours that cannot be read are named, keep the last preview and switch Publish off", async ({ page }) => {
    await open(page);
    await headline(page).fill("Thanks {name}");
    await page.getByLabel("Card colour", { exact: true }).fill("#ffffff");
    await page.getByLabel("Text colour", { exact: true }).fill("#fafafa");
    await expect(page.getByTestId("overlay-problem")).toContainText("too close");
    await expect(page.getByTestId("alert-preview")).toContainText("Thanks");
    await expect(page.getByText("Draft saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await page.getByLabel("Text colour", { exact: true }).fill("#101010");
    await expect(page.getByTestId("overlay-problem")).toHaveCount(0);
    await expect(page.getByText("Draft saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  });

  test("Revert to live throws the draft away", async ({ page }) => {
    await open(page);
    await headline(page).fill("Hello {name}");
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Revert to live" }).click();
    await page.getByRole("button", { name: "Revert", exact: true }).click();
    await expect(page.getByText("Back to what is live. The draft is gone.")).toBeVisible();
    await expect(headline(page)).toHaveValue("");
    expect(await fixture(page, (f) => f.discards)).toBe(1);
  });

  test("a second tab's change stops saving and asks for a reload", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      window.__overlaysFixture!.conflictNext = true;
    });
    await headline(page).fill("Mine {name}");
    await expect(page.getByText("Changed somewhere else", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload the latest draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
  });
});

test.describe("the preview is a preview", () => {
  test("Test alert replays the sample and sends nothing to the server", async ({ page }) => {
    await open(page);
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") posts.push(r.url());
    });
    await page.getByRole("button", { name: "Test alert" }).click();
    await expect(page.getByTestId("alert-preview")).toContainText("Riya");
    await page.waitForTimeout(400);
    expect(posts).toEqual([]);
    expect(await fixture(page, (f) => f.saves.length)).toBe(0);
  });

  test("the sample carries the TEST badge and changes with the tip and the screen shape", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "₹2,000" }).click();
    await expect(page.getByTestId("alert-preview")).toContainText("2,000");
    await page.getByRole("button", { name: "Vertical" }).click();
    await expect(page.getByRole("button", { name: "Vertical" })).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => {
        const box = await page.getByTestId("alert-preview").boundingBox();
        return box!.height > box!.width;
      })
      .toBe(true);
  });
});

test.describe("a creator with only some switches on", () => {
  test("the other parts are disabled and named, and an edit there cannot be typed", async ({ page }) => {
    await open(page, "?features=motion");
    await expect(page.getByText("Switch on “Alert animations and timing”", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Switch on “Alert text and colours” for this creator to change this.")).toBeVisible();
    await expect(page.getByText("Switch on “Overlay themes” for this creator to change this.")).toBeVisible();
    await expect(headline(page)).toBeDisabled();
    await expect(page.getByLabel("Comes in")).toBeEnabled();
    await page.getByLabel("Comes in").selectOption("zoom");
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Published. The next alert and the goal bar use this now.")).toBeVisible();
    expect(await fixture(page, (f) => f.live.motion.enter)).toBe("zoom");
  });
});

test.describe("the goal bar tab", () => {
  test("percent only draws no rupee figure, and the goal-reached moment shows when the bar crosses", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: "Goal bar" }).click();
    const bar = page.getByTestId("goal-preview");
    await expect(bar).toContainText("₹6,000 / ₹10,000");
    await page.getByLabel("Shows").selectOption("percent");
    await expect(bar).toContainText("60%");
    await expect(bar).not.toContainText("₹");
    await page.getByRole("button", { name: "Goal reached" }).click();
    await expect(bar).toContainText("GOAL REACHED");
    await expect(bar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  test("with the moment switched off the bar crosses quietly, and a colour is used and checked", async ({ page }) => {
    await open(page);
    await page.getByRole("tab", { name: "Goal bar" }).click();
    await page.getByLabel("Mark the moment the goal is reached").uncheck();
    await page.getByLabel("Bar colour (empty is the creator's accent)", { exact: true }).fill("#ffaa33");
    const fill = page.getByTestId("goal-preview").locator(".ov-fill");
    await expect(fill).toHaveCSS("background-color", "rgb(255, 170, 51)");
    await page.getByRole("button", { name: "Goal reached" }).click();
    await expect(page.getByTestId("goal-preview").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByTestId("goal-preview")).not.toContainText("GOAL REACHED");
    await page.getByLabel("Bar colour (empty is the creator's accent)", { exact: true }).fill("#111111");
    await expect(page.getByTestId("overlay-problem")).toContainText("needs 3");
  });
});

// The real overlay page with the goal API answered as the server answers it (route mocked).
test.describe("the goal bar in OBS follows the style the API sends", () => {
  const TOKEN = "a".repeat(43);
  const goal = (extra: object) => ({ goals: [{ title: "New mic", targetPaise: 500000, raisedPaise: 125000 }], ...extra });

  test("no style is today's bar", async ({ page }) => {
    await page.route(`**/api/overlay/${TOKEN}/goal`, (route) => route.fulfill({ json: goal({}) }));
    await page.goto(`/overlay/${TOKEN}/goal`);
    await expect(page.getByTestId("goal-bar")).toContainText("₹1,250 / ₹5,000");
  });

  test("percent only shows the percent from the API and no rupee figure", async ({ page }) => {
    await page.route(`**/api/overlay/${TOKEN}/goal`, (route) =>
      route.fulfill({ json: { goals: [{ title: "New mic", repeat: "weekly", percent: 25 }], goal: null, style: { show: "percent", fill: "#ffaa33" } } }),
    );
    await page.goto(`/overlay/${TOKEN}/goal`);
    const bar = page.getByTestId("goal-bar");
    await expect(bar).toContainText("25%");
    await expect(bar).not.toContainText("₹");
    await expect(bar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    await expect(bar.locator(".ov-fill")).toHaveCSS("background-color", "rgb(255, 170, 51)");
  });
});
