import { expect, test, type Page } from "@playwright/test";
import { addBlock, setAsset, setNumber } from "../src/lib/page-doc/edit";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import type { PageDoc } from "../src/lib/page-doc/types";

// The tip page with a picture backdrop and a banner picture (page builder phase 3), through the
// test-only fixture route. The fixture's made-up library: 1 a picture, 2 a GIF with its still,
// 3 a video with its still. The fixture's video file does not exist: the tests only look at
// whether a video element is put on the page, which is what the motion rules decide.

const encode = (doc: PageDoc) => Buffer.from(JSON.stringify(doc)).toString("base64url");
const backdropDoc = (asset: number | null, dim?: number) => {
  let doc = addBlock(defaultPageDoc(), "backdrop").doc;
  if (asset !== null) doc = setAsset(doc, "backdrop", asset).doc;
  if (dim !== undefined) doc = setNumber(doc, "backdrop", "dim", dim).doc;
  return doc;
};
const bannerDoc = (asset: number) => setAsset(defaultPageDoc(), "header", asset).doc;

async function open(page: Page, doc: PageDoc, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/dev-fixtures/tip?page=default&doc=${encode(doc)}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
}

const backdrop = (page: Page) => page.locator("div.fixed.-z-10");

test.describe("a picture behind the page", () => {
  test("is drawn under a layer of the page colour as thick as the setting", async ({ page }) => {
    await open(page, backdropDoc(1, 60));
    await expect(backdrop(page).locator('img[src="/owner/kitsune.svg"]')).toHaveCount(1);
    await expect(backdrop(page)).toHaveAttribute("aria-hidden", "true");
    const layer = backdrop(page).locator("div.absolute.inset-0");
    expect(Number(await layer.evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.6, 2);
    // It is the picture kind: the owner's smoke is not drawn.
    await expect(page.locator(".ap-backdrop")).toHaveCount(0);
  });

  test("sits behind the words and takes no click", async ({ page }) => {
    await open(page, backdropDoc(1));
    const style = await backdrop(page).evaluate((el) => ({ pointer: getComputedStyle(el).pointerEvents, z: getComputedStyle(el).zIndex, position: getComputedStyle(el).position }));
    expect(style).toEqual({ pointer: "none", z: "-10", position: "fixed" });
    await expect(page.getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
  });

  test("a file the page cannot find draws nothing, and the page is still payable", async ({ page }) => {
    await open(page, backdropDoc(99));
    await expect(backdrop(page)).toHaveCount(0);
    await expect(page.locator(".ap-backdrop")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Tip/ })).toBeVisible();
  });

  test("a media backdrop with no picture chosen yet draws nothing", async ({ page }) => {
    await open(page, backdropDoc(null));
    await expect(backdrop(page)).toHaveCount(0);
  });

  test("the served page carries only the still: no video until the page has loaded", async ({ request }) => {
    const res = await request.get(`/dev-fixtures/tip?page=default&doc=${encode(backdropDoc(3))}`);
    const html = await res.text();
    expect(html).toContain("/owner/kitsune.svg");
    // The video's address is in the page's data (the client blocks need it), but no video element
    // is in the page, so nothing is fetched or played before the rules in motion.ts have run.
    expect(html).not.toContain("<video");
  });

  test("the two normal pages have no picture, no video and no new element", async ({ page }) => {
    for (const query of ["?page=default", "?page=owner"]) {
      await page.goto(`/dev-fixtures/tip${query}`, { waitUntil: "load" });
      await expect(page.locator("video")).toHaveCount(0);
      await expect(page.locator("div.fixed.-z-10 img")).toHaveCount(0);
    }
    await page.goto("/dev-fixtures/tip?page=owner", { waitUntil: "load" });
    await expect(page.locator(".ap-backdrop")).toHaveCount(1);
  });
});

test.describe("motion on a device that allows it", () => {
  // Chrome works out the connection type from live timings, so a busy test machine can look like
  // "3g" and rightly keep the still. These tests say what the device is.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", { value: { saveData: false, effectiveType: "4g" }, configurable: true });
      Object.defineProperty(navigator, "deviceMemory", { value: 8, configurable: true });
    });
  });

  test("a video is put over its still once the page has loaded, muted and looping", async ({ page }) => {
    await open(page, backdropDoc(3));
    const video = page.locator("div.fixed.-z-10 video");
    await expect(video).toHaveCount(1);
    expect(await video.evaluate((el: HTMLVideoElement) => ({ muted: el.muted, loop: el.loop, inline: el.playsInline }))).toEqual({ muted: true, loop: true, inline: true });
    await expect(backdrop(page).locator('img[src="/owner/kitsune.svg"]')).toHaveCount(1);
  });

  test("a GIF replaces its still", async ({ page }) => {
    await open(page, backdropDoc(2));
    await expect(backdrop(page).locator('img[src="/example-alert.gif"]')).toHaveCount(1);
    await expect(backdrop(page).locator('img[src="/owner/kitsune.svg"]')).toHaveCount(0);
  });
});

test.describe("motion when the fan asked for less", () => {
  test.use({ reducedMotion: "reduce" });

  test("the video is never put on the page, only its still", async ({ page }) => {
    await open(page, backdropDoc(3));
    await expect(backdrop(page).locator('img[src="/owner/kitsune.svg"]')).toHaveCount(1);
    await page.waitForTimeout(500);
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("a GIF stays on its still", async ({ page }) => {
    await open(page, backdropDoc(2));
    await expect(backdrop(page).locator('img[src="/owner/kitsune.svg"]')).toHaveCount(1);
    await page.waitForTimeout(500);
    await expect(backdrop(page).locator('img[src="/example-alert.gif"]')).toHaveCount(0);
  });
});

test.describe("motion in data-saver mode and on a small device", () => {
  test("data saver keeps the still", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" }, configurable: true }));
    await open(page, backdropDoc(3));
    await page.waitForTimeout(500);
    await expect(page.locator("video")).toHaveCount(0);
    await expect(backdrop(page).locator("img")).toHaveCount(1);
  });

  test("a 3G connection keeps the still", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: false, effectiveType: "3g" }, configurable: true }));
    await open(page, backdropDoc(3));
    await page.waitForTimeout(500);
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("a device with 2 GB or less keeps the still", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "deviceMemory", { value: 2, configurable: true }));
    await open(page, backdropDoc(3));
    await page.waitForTimeout(500);
    await expect(page.locator("video")).toHaveCount(0);
  });
});

test.describe("a banner picture", () => {
  const banner = (page: Page) => page.locator('section[aria-label="Creator"] div.aspect-\\[16\\/5\\]');

  test("replaces the creator's own banner, picture or GIF", async ({ page }) => {
    await open(page, bannerDoc(1));
    await expect(banner(page)).toHaveCount(1);
    await expect(banner(page).locator("img")).toHaveCount(1);
  });

  test("a video is not a banner: the header stays as it was", async ({ page }) => {
    await open(page, bannerDoc(3));
    await expect(banner(page)).toHaveCount(0);
  });

  test("no banner chosen shows no banner box", async ({ page }) => {
    await open(page, defaultPageDoc());
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe("narrow screens", () => {
  test("a picture backdrop does not make the page scroll sideways at 320 px", async ({ page }) => {
    await open(page, backdropDoc(1, 40), 320);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("owner page keeps its own look", () => {
  test("the owner document with the smoke style still draws the smoke", async ({ page }) => {
    await page.goto(`/dev-fixtures/tip?page=owner&doc=${encode(ownerPageDoc())}`, { waitUntil: "load" });
    await expect(page.locator(".ap-backdrop")).toHaveCount(1);
  });
});
