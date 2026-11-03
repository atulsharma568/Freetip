import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openFixture } from "./helpers/fixture";
import { findBlock } from "../src/lib/page-doc/blocks";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The tip page through the test-only fixture route (/dev-fixtures/tip, a made-up creator, no
// database). The ARIA snapshots in test/snapshots were taken from the page as it was BEFORE it
// was rebuilt from blocks (page builder phase 1), so they are the record of "today": the
// structure, words, order and roles a screen reader gets. Regenerate them only on purpose, with
// WRITE_SNAPSHOTS=1, and say why in the commit.
const WRITE = process.env.WRITE_SNAPSHOTS === "1";
const SNAP_DIR = join(__dirname, "snapshots");

async function expectAriaSnapshot(page: Page, file: string) {
  const actual = `${(await page.locator("body").ariaSnapshot()).trimEnd()}\n`;
  const path = join(SNAP_DIR, file);
  if (WRITE) {
    writeFileSync(path, actual);
    return;
  }
  expect(actual).toBe(readFileSync(path, "utf8"));
}

const PAGES = ["default", "owner"] as const;

test.describe("the tip page keeps its structure", () => {
  for (const kind of PAGES) {
    for (const width of [1280, 390]) {
      test(`${kind} page at ${width}px matches the recorded structure`, async ({ page }) => {
        await openFixture(page, `?page=${kind}`, width);
        await expectAriaSnapshot(page, `tip-page-${kind}-${width}.aria.yml`);
      });
    }
    test(`${kind} success screen matches the recorded structure`, async ({ page }) => {
      await openFixture(page, `?page=${kind}&view=success`, 390);
      await expectAriaSnapshot(page, `tip-success-${kind}.aria.yml`);
    });
  }
});

test.describe("no horizontal overflow on the tip page", () => {
  for (const kind of PAGES) {
    for (const width of [320, 390, 1440]) {
      test(`${kind} page stays within ${width}px`, async ({ page }) => {
        await openFixture(page, `?page=${kind}`, width);
        await expect
          .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
          .toEqual({ viewport: width, document: width });
      });
    }
  }
});

// The page is drawn from a document, so a document decides what is on it. The fixture route takes
// one as `doc` (base64url text, anything the parser will take); an unreadable one gives the page's
// own default.
const docQuery = (kind: (typeof PAGES)[number], doc: unknown) =>
  `?page=${kind}&doc=${Buffer.from(typeof doc === "string" ? doc : JSON.stringify(doc)).toString("base64url")}`;

function editBlock<T extends Block["type"]>(doc: PageDoc, type: T, change: (block: Block<T>) => void): PageDoc {
  const block = findBlock(doc, type);
  if (!block) throw new Error(`the test document has no ${type} block`);
  change(block);
  return doc;
}

test.describe("the tip page is drawn from its document", () => {
  test("the default document draws exactly the recorded default page", async ({ page }) => {
    await openFixture(page, docQuery("default", defaultPageDoc()), 1280);
    await expectAriaSnapshot(page, "tip-page-default-1280.aria.yml");
  });

  test("the owner document draws exactly the recorded owner page", async ({ page }) => {
    await openFixture(page, docQuery("owner", ownerPageDoc()), 1280);
    await expectAriaSnapshot(page, "tip-page-owner-1280.aria.yml");
  });

  test("a document that is not a page gives the page's own default", async ({ page }) => {
    await openFixture(page, docQuery("owner", "this is not json"), 1280);
    await expectAriaSnapshot(page, "tip-page-owner-1280.aria.yml");
    await openFixture(page, docQuery("default", { version: 2, blocks: [] }), 1280);
    await expectAriaSnapshot(page, "tip-page-default-1280.aria.yml");
    await openFixture(page, docQuery("default", { hello: "world" }), 1280);
    await expectAriaSnapshot(page, "tip-page-default-1280.aria.yml");
  });

  test("a document with no blocks still gives a page that can take a tip", async ({ page }) => {
    await openFixture(page, docQuery("default", { version: 1, blocks: [] }), 1280);
    await expect(page.getByRole("radio", { name: "Custom" })).toBeAttached();
    await expect(page.getByLabel(/^Message/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tip ₹/ })).toBeEnabled();
    await expect(page.getByText("Scan to tip from your phone")).toHaveCount(0);
  });

  test("hiding the QR block removes the QR tile", async ({ page }) => {
    await openFixture(page, `?page=default`, 1280);
    await expect(page.getByText("Scan to tip from your phone")).toBeVisible();
    const doc = editBlock(defaultPageDoc(), "qr", (b) => (b.visible = false));
    await openFixture(page, docQuery("default", doc), 1280);
    await expect(page.getByText("Scan to tip from your phone")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Tip ₹/ })).toBeVisible();
  });

  test("a strip block puts its own words under the card, on any page", async ({ page }) => {
    const doc = defaultPageDoc();
    doc.blocks.push({
      id: "strip",
      type: "strip",
      visible: true,
      slot: "bottom",
      settings: { left: "Streams nightly", right: "@mychannel" },
    });
    await openFixture(page, docQuery("default", doc), 1280);
    await expect(page.getByText("Streams nightly")).toBeVisible();
    await expect(page.getByText("@mychannel")).toBeVisible();
  });

  test("the owner page shows the strip words from its document", async ({ page }) => {
    const doc = editBlock(ownerPageDoc(), "strip", (b) => (b.settings = { left: "Twitch / Someone", right: "@someone" }));
    await openFixture(page, docQuery("owner", doc), 1280);
    await expect(page.getByText("Twitch / Someone")).toBeVisible();
    await expect(page.getByText("YouTube / AcePressure")).toHaveCount(0);
  });

  test("the amount bar uses the ladder from the document", async ({ page }) => {
    const doc = editBlock(
      ownerPageDoc(),
      "amount",
      (b) =>
        (b.settings = {
          ladder: {
            topRupees: 1000,
            levels: [
              { upTo: 0.5, name: "Alpha" },
              { upTo: 1, name: "Omega" },
            ],
          },
        }),
    );
    await openFixture(page, docQuery("owner", doc), 1280);
    await expect(page.getByRole("img", { name: /^Pressure: Alpha/ })).toBeVisible();
    await page.locator("label", { hasText: "₹500" }).click();
    await expect(page.getByRole("img", { name: /^Pressure: Omega/ })).toBeVisible();
  });

  test("a document without an amount ladder has no bar", async ({ page }) => {
    await openFixture(page, docQuery("owner", editBlock(ownerPageDoc(), "amount", (b) => (b.settings = { ladder: null }))), 1280);
    await expect(page.getByRole("img", { name: /^Pressure:/ })).toHaveCount(0);
  });

  test("a document that hides the send block still has a working Tip button", async ({ page }) => {
    const doc = editBlock(defaultPageDoc(), "send", (b) => (b.visible = false));
    await openFixture(page, docQuery("default", doc), 1280);
    await expect(page.getByRole("button", { name: /^Tip ₹/ })).toBeEnabled();
  });

  test("the Instagram link is built from the handle alone", async ({ page }) => {
    const links = (instagram: string) =>
      editBlock(ownerPageDoc(), "creatorLinks", (b) => (b.settings = { tagline: "Hello", instagram }));
    await openFixture(page, docQuery("owner", links("acepressure.gg")), 1280);
    await expect(page.locator('a[href*="instagram.com"]')).toHaveAttribute("href", "https://www.instagram.com/acepressure.gg");
    await openFixture(page, docQuery("owner", links("a/b")), 1280);
    await expect(page.locator('a[href*="instagram.com"]')).toHaveCount(0);
    await expect(page.getByText("Hello")).toBeVisible();
  });

  test("the sign-off after a tip follows the document's success style", async ({ page }) => {
    const owner = editBlock(defaultPageDoc(), "successScreen", (b) => (b.settings = { style: "owner" }));
    await openFixture(page, `${docQuery("default", owner)}&view=success`, 390);
    await expect(page.getByRole("heading", { name: /^GG/ })).toBeVisible();
    await openFixture(page, `${docQuery("owner", defaultPageDoc())}&view=success`, 390);
    await expect(page.getByRole("heading", { name: /^₹100\. Sent to/ })).toBeVisible();
  });
});
