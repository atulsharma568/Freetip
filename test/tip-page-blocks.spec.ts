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
          ...b.settings,
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
    await openFixture(page, docQuery("owner", editBlock(ownerPageDoc(), "amount", (b) => (b.settings = { ...b.settings, ladder: null }))), 1280);
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

  test("the longest words the parser allows, with no spaces, do not make the page scroll sideways at 320px", async ({ page }) => {
    const long = (n: number, letter = "W") => letter.repeat(n);
    const doc = ownerPageDoc();
    editBlock(doc, "creatorLinks", (b) => (b.settings = { tagline: long(60), instagram: "a".repeat(30) }));
    editBlock(doc, "strip", (b) => (b.settings = { left: long(40, "M"), right: long(40, "N") }));
    editBlock(doc, "amount", (b) => {
      b.settings = {
        ...b.settings,
        ladder: {
          topRupees: 5000,
          levels: [
            { upTo: 0.5, name: long(24, "R") },
            { upTo: 1, name: long(24, "S") },
          ],
        },
      };
    });
    await openFixture(page, docQuery("owner", doc), 320);
    await expect(page.getByText(long(60))).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
      .toEqual({ viewport: 320, document: 320 });
  });

  test("the sign-off after a tip follows the document's success style", async ({ page }) => {
    const owner = editBlock(defaultPageDoc(), "successScreen", (b) => (b.settings = { ...b.settings, style: "owner" }));
    await openFixture(page, `${docQuery("default", owner)}&view=success`, 390);
    await expect(page.getByRole("heading", { name: /^GG/ })).toBeVisible();
    await openFixture(page, `${docQuery("owner", defaultPageDoc())}&view=success`, 390);
    await expect(page.getByRole("heading", { name: /^₹100\. Sent to/ })).toBeVisible();
  });
});

// Page builder phase 2: the words a block may change, step numbers that follow the order, and the
// marks the editor preview uses to tell which block was clicked.
const stepNumber = (page: Page, title: string) =>
  page.getByRole("heading", { name: title, level: 2 }).locator("xpath=preceding-sibling::span[1]");

function withSettings(doc: PageDoc, type: Block["type"], patch: Record<string, unknown>): PageDoc {
  return editBlock(doc, type, (b) => (b.settings = { ...b.settings, ...patch } as never));
}

function moveBefore(doc: PageDoc, type: Block["type"], before: Block["type"]): PageDoc {
  const moved = doc.blocks.find((b) => b.type === type)!;
  const rest = doc.blocks.filter((b) => b !== moved);
  rest.splice(rest.findIndex((b) => b.type === before), 0, moved);
  return { ...doc, blocks: rest };
}

test.describe("the words a block may change", () => {
  test("each new word shows where the standard wording was", async ({ page }) => {
    let doc = ownerPageDoc();
    doc = withSettings(doc, "amount", { heading: "Pick a size", barLabel: "Heat" });
    doc = withSettings(doc, "note", { heading: "Say hi", namePlaceholder: "Your crew name", messagePlaceholder: "Tell us a story" });
    doc = withSettings(doc, "send", { heading: "Go", buttonLabel: "Boost" });
    doc = withSettings(doc, "alertPreview", { label: "How it looks" });
    await openFixture(page, docQuery("owner", doc), 1280);
    await expect(page.getByRole("heading", { name: "Pick a size", level: 2 })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Heat: / })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Say hi", level: 2 })).toBeVisible();
    await expect(page.getByPlaceholder("Your crew name")).toBeVisible();
    await expect(page.getByPlaceholder("Tell us a story")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Go", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Boost ₹/ })).toBeEnabled();
    await expect(page.getByText("How it looks", { exact: true }).first()).toBeVisible();
    // The standard words are gone, not shown beside the new ones.
    await expect(page.getByRole("heading", { name: "Amount", level: 2 })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Tip ₹/ })).toHaveCount(0);
  });

  test("the button always shows the amount, whatever its word", async ({ page }) => {
    await openFixture(page, docQuery("default", withSettings(defaultPageDoc(), "send", { buttonLabel: "Boost" })), 1280);
    await page.locator("label", { hasText: "₹500" }).click();
    await expect(page.getByRole("button", { name: "Boost ₹500" })).toBeEnabled();
  });

  test("the sign-off's small line follows the document", async ({ page }) => {
    const doc = withSettings(ownerPageDoc(), "successScreen", { line: "See you at the next stream." });
    await openFixture(page, `${docQuery("owner", doc)}&view=success`, 390);
    await expect(page.getByText("See you at the next stream.")).toBeVisible();
    await expect(page.getByText("Thanks for hanging out.")).toHaveCount(0);
  });

  test("a bar whose top is at or below the smallest tip is not drawn", async ({ page }) => {
    // The smallest tip here is ₹500 and the ladder tops out at ₹100.
    const doc = withSettings(ownerPageDoc(), "amount", {
      ladder: { topRupees: 100, levels: [{ upTo: 0.5, name: "Low" }, { upTo: 1, name: "High" }] },
    });
    await openFixture(page, `${docQuery("owner", doc)}&min=500`, 1280);
    await expect(page.getByRole("img", { name: /^Pressure:/ })).toHaveCount(0);
    await openFixture(page, `${docQuery("owner", doc)}&min=20`, 1280);
    await expect(page.getByRole("img", { name: /^Pressure:/ })).toBeVisible();
  });

  test("the longest words in every new field, with no spaces, do not make the page scroll sideways at 320px", async ({ page }) => {
    const w = (n: number, c: string) => c.repeat(n);
    let doc = ownerPageDoc();
    doc = withSettings(doc, "amount", { heading: w(30, "A"), barLabel: w(16, "B") });
    doc = withSettings(doc, "note", { heading: w(30, "C"), namePlaceholder: w(30, "D"), messagePlaceholder: w(60, "E") });
    doc = withSettings(doc, "send", { heading: w(30, "F"), buttonLabel: w(12, "G") });
    doc = withSettings(doc, "alertPreview", { label: w(30, "H") });
    await openFixture(page, docQuery("owner", doc), 320);
    await expect(page.getByRole("heading", { name: w(30, "A"), level: 2 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
      .toEqual({ viewport: 320, document: 320 });
    const success = withSettings(ownerPageDoc(), "successScreen", { line: w(40, "T") });
    await openFixture(page, `${docQuery("owner", success)}&view=success`, 320);
    await expect
      .poll(() => page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })))
      .toEqual({ viewport: 320, document: 320 });
  });
});

test.describe("the steps follow the order of the form", () => {
  test("the standard order reads 1, 2, 3", async ({ page }) => {
    await openFixture(page, "?page=default", 1280);
    expect(await stepNumber(page, "Amount").textContent()).toBe("1");
    expect(await stepNumber(page, "Your note").textContent()).toBe("2");
    expect(await stepNumber(page, "Send").textContent()).toBe("3");
  });

  test("a reordered form is renumbered in the order it sits", async ({ page }) => {
    const doc = moveBefore(defaultPageDoc(), "note", "amount");
    await openFixture(page, docQuery("default", doc), 1280);
    expect(await stepNumber(page, "Your note").textContent()).toBe("1");
    expect(await stepNumber(page, "Amount").textContent()).toBe("2");
    expect(await stepNumber(page, "Send").textContent()).toBe("3");
    const note = await page.getByRole("heading", { name: "Your note", level: 2 }).boundingBox();
    const amount = await page.getByRole("heading", { name: "Amount", level: 2 }).boundingBox();
    expect(note!.y).toBeLessThan(amount!.y);
  });

  test("the links sit with the header only while they come straight after it", async ({ page }) => {
    const split = moveBefore(ownerPageDoc(), "creatorLinks", "qr");
    // Header, then the alert preview, then the links: the links are no longer beside the header.
    const doc = { ...split, blocks: [...split.blocks.filter((b) => b.type !== "alertPreview" && b.type !== "creatorLinks")] } as PageDoc;
    const at = doc.blocks.findIndex((b) => b.type === "header") + 1;
    doc.blocks.splice(at, 0, ownerPageDoc().blocks.find((b) => b.type === "alertPreview")!, ownerPageDoc().blocks.find((b) => b.type === "creatorLinks")!);
    await openFixture(page, docQuery("owner", doc), 1280);
    const preview = await page.getByText("Preview on stream", { exact: true }).first().boundingBox();
    const links = await page.getByText("Valorant / Live & Highlights").boundingBox();
    expect(links!.y).toBeGreaterThan(preview!.y);
  });
});

test.describe("the owner's editor preview marks the blocks", () => {
  test("the real page carries no block marks", async ({ page }) => {
    await openFixture(page, "?page=owner", 1280);
    await expect(page.locator("[data-block-id]")).toHaveCount(0);
    expect(await page.content()).not.toContain("data-block-id");
  });

  test("the preview marks every block that is on the page", async ({ page }) => {
    await openFixture(page, "?page=owner&editing=1", 1280);
    const ids = await page.locator("[data-block-id]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-block-id")))]);
    expect(ids.sort()).toEqual(["alertPreview", "amount", "creatorLinks", "header", "note", "qr", "send", "strip"]);
  });

  test("a click inside the links picks the links, and one in the photo picks the header", async ({ page }) => {
    await openFixture(page, "?page=owner&editing=1", 1280);
    const idAt = (selector: string) => page.locator(selector).first().evaluate((el) => el.closest("[data-block-id]")?.getAttribute("data-block-id"));
    expect(await idAt('a[href*="instagram.com"]')).toBe("creatorLinks");
    expect(await idAt("h1")).toBe("header");
  });
});

test.describe("the page colours reach the page", () => {
  test("the owner's red fills the Tip button", async ({ page }) => {
    await openFixture(page, "?page=owner", 1280);
    const colour = await page.getByRole("button", { name: /^Tip ₹/ }).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(colour).toBe("rgb(202, 27, 25)");
  });
});
