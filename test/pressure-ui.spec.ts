import { expect, test } from "@playwright/test";
import { openFixture } from "./helpers/fixture";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { addBlock, setChoice } from "../src/lib/page-doc/edit";
import type { PageDoc } from "../src/lib/page-doc/types";

// The Pressure meter on the tip page and in OBS (page builder phase 4), in a real browser. The tip
// page runs through the test-only fixture route (a made-up weekly goal of ₹1,000, no database); the
// OBS page is fed by a stubbed endpoint, as the goal bar's tests do.

const TOKEN = "a".repeat(43);

const encode = (doc: unknown) => Buffer.from(JSON.stringify(doc)).toString("base64url");

function meterDoc(base: PageDoc = defaultPageDoc(), choices: Record<string, string> = {}): PageDoc {
  let doc = addBlock(base, "pressureMeter").doc;
  for (const [key, value] of Object.entries(choices)) doc = setChoice(doc, "pressureMeter", key, value).doc;
  return doc;
}

const page_ = (doc: PageDoc, extra = "", kind = "default") => `?page=${kind}&doc=${encode(doc)}${extra}`;

test.describe("the meter on the tip page", () => {
  test("its first reading is in the served HTML, with no script needed", async ({ request }) => {
    const res = await request.get(`/dev-fixtures/tip${page_(meterDoc(), "&meter=30")}`);
    const html = await res.text();
    expect(html).toContain('data-testid="pressure-meter"');
    expect(html).toContain("Supernova");
    expect(html).toContain("30%");
    expect(html).toContain("New mic");
    expect(html).toContain("this week");
  });

  test("it shows the bar, the word and the rupees of the goal", async ({ page }) => {
    await openFixture(page, page_(meterDoc(), "&meter=62"), 1280);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("Pressure · this week");
    await expect(meter).toContainText("62%");
    await expect(meter).toContainText("Warlord");
    await expect(meter).toContainText("₹620 of ₹1,000");
    await expect(meter.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    await expect(meter.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "62 percent, Warlord");
  });

  test("percent only: no rupee figure on the page or in the served HTML", async ({ page, request }) => {
    const doc = meterDoc(defaultPageDoc(), { show: "percent" });
    await openFixture(page, page_(doc, "&meter=62"), 390);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("62%");
    await expect(meter).not.toContainText("₹");
    const html = await (await request.get(`/dev-fixtures/tip${page_(doc, "&meter=62")}`)).text();
    const section = html.slice(html.indexOf('data-testid="pressure-meter"'), html.indexOf("</section>", html.indexOf('data-testid="pressure-meter"')));
    expect(section).not.toMatch(/₹|620|1,000/);
  });

  test("a full goal says so, once", async ({ page }) => {
    await openFixture(page, page_(meterDoc(), "&meter=100"), 390);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("Goal reached");
    await expect(meter).toContainText("Pirate King");
    // Turned off, the same goal just says 100%.
    const quiet = meterDoc();
    (quiet.blocks.find((b) => b.type === "pressureMeter")!.settings as { celebrate: boolean }).celebrate = false;
    await openFixture(page, page_(quiet, "&meter=100"), 390);
    await expect(page.getByTestId("pressure-meter")).not.toContainText("Goal reached");
    await expect(page.getByTestId("pressure-meter")).toContainText("100%");
  });

  test("the pages that have no meter block draw none", async ({ page }) => {
    for (const kind of ["default", "owner"]) {
      await openFixture(page, `?page=${kind}&meter=50`, 1280);
      await expect(page.getByTestId("pressure-meter")).toHaveCount(0);
    }
  });

  test("a hidden meter, and one set for OBS only, draw nothing", async ({ page }) => {
    const hidden = meterDoc();
    hidden.blocks.find((b) => b.type === "pressureMeter")!.visible = false;
    await openFixture(page, page_(hidden, "&meter=50"), 1280);
    await expect(page.getByTestId("pressure-meter")).toHaveCount(0);
    await openFixture(page, page_(meterDoc(defaultPageDoc(), { where: "obs" }), "&meter=50"), 1280);
    await expect(page.getByTestId("pressure-meter")).toHaveCount(0);
    // And the page can still be paid on.
    await expect(page.getByRole("button", { name: /tip/i }).first()).toBeVisible();
  });

  test("it sits under the header and links, before the alert preview, on the owner page too", async ({ page }) => {
    await openFixture(page, page_(meterDoc(ownerPageDoc()), "&meter=40", "owner"), 1280);
    const order = await page.evaluate(() => {
      const meter = document.querySelector('[data-testid="pressure-meter"]')!;
      const h1 = document.querySelector("h1")!;
      const preview = document.querySelector('[aria-label="Alert preview"]')!;
      const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { afterHeader: before(h1, meter), beforePreview: before(meter, preview) };
    });
    expect(order).toEqual({ afterHeader: true, beforePreview: true });
  });

  for (const width of [320, 390, 1440]) {
    test(`a long goal title and a big raised amount stay within ${width}px`, async ({ page }) => {
      const doc = meterDoc();
      (doc.blocks.find((b) => b.type === "pressureMeter")!.settings as { heading: string }).heading = "W".repeat(16);
      await openFixture(page, page_(doc, `&meter=500&mtitle=${"X".repeat(60)}`), width);
      await expect(page.getByTestId("pressure-meter")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
        .toEqual({ viewport: width, document: width });
    });
  }

  test("it follows the endpoint every 30 seconds and goes away on a 404", async ({ page }) => {
    let calls = 0;
    let status = 200;
    await page.route("**/api/pressure/samplecreator", (route) => {
      calls += 1;
      return status === 404
        ? route.fulfill({ status: 404, body: "Not found" })
        : route.fulfill({ json: { meter: { title: "New mic", repeat: "weekly", period: "this week", percent: 80, word: "Yonko", reached: false, raisedPaise: 80000, targetPaise: 100000 } } });
    });
    await page.clock.install();
    await openFixture(page, page_(meterDoc(), "&meter=10"), 390);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("10%");
    // fastForward jumps the clock and fires a due timer once, so the page's own animation timers
    // do not make the test crawl.
    await page.clock.fastForward(29_000);
    expect(calls).toBe(0);
    await page.clock.fastForward(2_000);
    await expect(meter).toContainText("80%");
    await expect(meter).toContainText("Yonko");
    status = 404;
    await page.clock.fastForward(31_000);
    await expect(meter).toHaveCount(0);
    expect(calls).toBe(2);
  });

  test("the editor preview never asks the endpoint", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/pressure/**", (route) => {
      calls += 1;
      return route.fulfill({ status: 404, body: "" });
    });
    await page.clock.install();
    await openFixture(page, page_(meterDoc(), "&meter=10&editing=1"), 1280);
    await expect(page.getByTestId("pressure-meter")).toContainText("10%");
    await expect(page.getByTestId("pressure-meter")).toHaveAttribute("data-block-id", "pressureMeter");
    await page.clock.fastForward(95_000);
    expect(calls).toBe(0);
  });
});

test.describe("the meter in OBS", () => {
  const reading = (over: Record<string, unknown> = {}) => ({
    title: "New mic",
    repeat: "weekly",
    period: "this week",
    percent: 25,
    word: "Supernova",
    reached: false,
    raisedPaise: 25000,
    targetPaise: 100000,
    ...over,
  });
  const settings = { heading: "", fill: null, celebrate: true, show: "rupees" };
  const stub = (body: unknown, status = 200) => ({ status, ...(status === 200 ? { json: body } : { body: "Not found" }) });

  test("draws the bar, word and rupees from the endpoint", async ({ page }) => {
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) => route.fulfill(stub({ meter: reading(), settings })));
    await page.goto(`/overlay/${TOKEN}/pressure`);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("Pressure · this week");
    await expect(meter).toContainText("25%");
    await expect(meter).toContainText("Supernova");
    await expect(meter).toContainText("₹250 / ₹1,000");
    await expect(meter.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  test("percent only draws no rupees, and a carried amount is named only with rupees", async ({ page }) => {
    const only = { percent: 25, title: "New mic", repeat: "weekly", period: "this week", word: "Supernova", reached: false };
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) => route.fulfill(stub({ meter: only, settings: { ...settings, show: "percent" } })));
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await expect(page.getByTestId("pressure-meter")).toContainText("25%");
    await expect(page.getByTestId("pressure-meter")).not.toContainText("₹");
    await page.unroute(`**/api/overlay/${TOKEN}/pressure`);
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) => route.fulfill(stub({ meter: reading({ carryPaise: 40000 }), settings })));
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await expect(page.getByTestId("pressure-meter")).toContainText("includes ₹400 carried over");
  });

  test("no meter, a null reading, and a bad token show nothing", async ({ page, request }) => {
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) => route.fulfill(stub(null, 404)));
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await page.waitForTimeout(400);
    await expect(page.getByTestId("pressure-meter")).toHaveCount(0);
    await page.unroute(`**/api/overlay/${TOKEN}/pressure`);
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) => route.fulfill(stub({ meter: null, settings })));
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await page.waitForTimeout(400);
    await expect(page.getByTestId("pressure-meter")).toHaveCount(0);
    expect((await request.get("/api/overlay/nope/pressure")).status()).toBe(404);
    expect((await request.get(`/api/overlay/${TOKEN}/pressure`)).status()).toBe(503);
    expect((await request.get("/api/pressure/samplecreator")).status()).toBe(503);
  });

  test("flashes once when it watches the bar cross 100, not when it loads full", async ({ page }) => {
    let percent = 90;
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) =>
      route.fulfill(stub({ meter: reading({ percent, reached: percent >= 100, word: "Pirate King" }), settings })),
    );
    await page.clock.install();
    await page.goto(`/overlay/${TOKEN}/pressure`);
    const meter = page.getByTestId("pressure-meter");
    await expect(meter).toContainText("90%");
    await expect(meter).not.toContainText("GOAL REACHED");
    percent = 100;
    await page.clock.fastForward(5_100);
    await expect(meter).toContainText("GOAL REACHED");
    await page.clock.fastForward(7_000);
    await expect(meter).not.toContainText("GOAL REACHED");

    // Loaded already full: no flash.
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await expect(page.getByTestId("pressure-meter")).toContainText("100%");
    await expect(page.getByTestId("pressure-meter")).not.toContainText("GOAL REACHED");
  });

  test("with celebration off it never flashes", async ({ page }) => {
    let percent = 90;
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) =>
      route.fulfill(stub({ meter: reading({ percent, reached: percent >= 100 }), settings: { ...settings, celebrate: false } })),
    );
    await page.clock.install();
    await page.goto(`/overlay/${TOKEN}/pressure`);
    await expect(page.getByTestId("pressure-meter")).toContainText("90%");
    percent = 100;
    await page.clock.fastForward(5_100);
    await expect(page.getByTestId("pressure-meter")).toContainText("100%");
    await expect(page.getByTestId("pressure-meter")).not.toContainText("GOAL REACHED");
  });

  test("on a vertical stage the card stays inside the screen", async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.route(`**/api/overlay/${TOKEN}/pressure`, (route) =>
      route.fulfill(stub({ meter: reading({ title: "X".repeat(60), raisedPaise: 123456700, targetPaise: 999999900 }), settings: { ...settings, heading: "W".repeat(16) } })),
    );
    await page.goto(`/overlay/${TOKEN}/pressure`);
    const box = await page.getByTestId("pressure-meter").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1080);
    expect(box!.y + box!.height).toBeLessThanOrEqual(1920);
  });
});
