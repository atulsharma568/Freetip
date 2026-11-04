import { expect, test } from "@playwright/test";
import { defaultPageDoc, ownerPageDoc } from "../src/lib/page-doc/defaults";
import { MSG_DOC, MSG_READY, MSG_SELECT, isReadyMessage, readDocMessage, readPickMessage, readSelectMessage } from "../src/lib/page-doc/preview-message";
import type { Block, PageDoc } from "../src/lib/page-doc/types";

// The editor's preview frame (page builder phase 2): who it listens to, and that it redraws the
// real tip page from a draft without a reload.

const ORIGIN = "https://freetip.test";
const parent = {};
const stranger = {};
const msg = (data: unknown, over: Partial<{ origin: string; source: unknown }> = {}) => ({ origin: ORIGIN, source: parent, data, ...over });

const withHeading = (doc: PageDoc, heading: string): PageDoc => ({
  ...doc,
  blocks: doc.blocks.map((b) => (b.type === "send" ? ({ ...b, settings: { ...b.settings, heading } } as Block) : b)),
});

test.describe("what the preview frame believes", () => {
  test("a draft from its parent, on its own site, is read through the parser", () => {
    const doc = withHeading(defaultPageDoc(), "Go");
    expect(readDocMessage(msg({ type: MSG_DOC, doc }), ORIGIN, parent)).toEqual(doc);
  });

  test("a draft that needs cleaning comes out cleaned", () => {
    const messy = withHeading(defaultPageDoc(), "x".repeat(80));
    const read = readDocMessage(msg({ type: MSG_DOC, doc: messy }), ORIGIN, parent)!;
    expect((read.blocks.find((b) => b.type === "send") as Block<"send">).settings.heading).toBe("x".repeat(30));
  });

  test("another site, another window, or no window is ignored", () => {
    const good = { type: MSG_DOC, doc: defaultPageDoc() };
    expect(readDocMessage(msg(good, { origin: "https://evil.test" }), ORIGIN, parent)).toBeNull();
    expect(readDocMessage(msg(good, { source: stranger }), ORIGIN, parent)).toBeNull();
    expect(readDocMessage(msg(good, { source: null }), ORIGIN, null)).toBeNull();
  });

  test("messages that are not a draft, or a draft that is not a page, are ignored", () => {
    for (const data of [null, undefined, "x", 5, [], {}, { type: "other" }, { type: MSG_DOC }, { type: MSG_DOC, doc: "nope" }, { type: MSG_DOC, doc: { version: 2, blocks: [] } }]) {
      expect(readDocMessage(msg(data), ORIGIN, parent)).toBeNull();
    }
  });

  test("a selection is a real block type or null, from the parent only", () => {
    expect(readSelectMessage(msg({ type: MSG_SELECT, id: "qr" }), ORIGIN, parent)).toEqual({ block: "qr" });
    expect(readSelectMessage(msg({ type: MSG_SELECT, id: null }), ORIGIN, parent)).toEqual({ block: null });
    expect(readSelectMessage(msg({ type: MSG_SELECT, id: "sparkles" }), ORIGIN, parent)).toBeNull();
    expect(readSelectMessage(msg({ type: MSG_SELECT, id: '"]{}' }), ORIGIN, parent)).toBeNull();
    expect(readSelectMessage(msg({ type: MSG_SELECT, id: "qr" }, { source: stranger }), ORIGIN, parent)).toBeNull();
  });
});

test.describe("what the editor believes", () => {
  test("ready and a picked block count only from the frame on the same site", () => {
    expect(isReadyMessage(msg({ type: MSG_READY }, { source: parent }), ORIGIN, parent)).toBe(true);
    expect(isReadyMessage(msg({ type: MSG_READY }, { source: stranger }), ORIGIN, parent)).toBe(false);
    expect(isReadyMessage(msg({ type: MSG_READY }, { origin: "https://evil.test" }), ORIGIN, parent)).toBe(false);
    expect(readPickMessage(msg({ type: MSG_SELECT, id: "note" }), ORIGIN, parent)).toBe("note");
    expect(readPickMessage(msg({ type: MSG_SELECT, id: "nonsense" }), ORIGIN, parent)).toBeNull();
    expect(readPickMessage(msg({ type: MSG_SELECT, id: "note" }, { source: stranger }), ORIGIN, parent)).toBeNull();
  });
});

// In a browser: the fixture preview inside a frame of a page of the same site, as the editor
// uses it.
test.describe("the preview frame in a browser", () => {
  test("it asks for a draft, redraws from one without a reload, and ignores a stranger", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=default");
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.evaluate(
      ({ MSG_READY }) => {
        (window as unknown as { ready: boolean }).ready = false;
        window.addEventListener("message", (e) => {
          if (e.data?.type === MSG_READY) (window as unknown as { ready: boolean }).ready = true;
        });
        for (const [id, src] of [["frame", "/dev-fixtures/preview?page=default"], ["sibling", "/dev-fixtures/preview?page=owner"]]) {
          const f = document.createElement("iframe");
          f.id = id;
          f.src = src;
          f.style.cssText = "position:fixed;left:0;top:0;width:1280px;height:700px;z-index:9";
          document.body.appendChild(f);
        }
      },
      { MSG_READY },
    );
    await expect.poll(() => page.evaluate(() => (window as unknown as { ready: boolean }).ready)).toBe(true);
    const frame = page.frameLocator("#frame");
    await expect(frame.getByRole("heading", { name: "Send", level: 2 })).toBeVisible();

    // The editor (the parent) sends a draft: the page redraws in place.
    const doc = withHeading(defaultPageDoc(), "Go");
    await page.evaluate(({ doc, MSG_DOC }) => (document.getElementById("frame") as HTMLIFrameElement).contentWindow!.postMessage({ type: MSG_DOC, doc }, location.origin), { doc, MSG_DOC });
    await expect(frame.getByRole("heading", { name: "Go", level: 2 })).toBeVisible();
    await expect(frame.getByRole("heading", { name: "Send", level: 2 })).toHaveCount(0);

    // A sibling frame (not the parent) tries to change it: nothing happens.
    const evil = withHeading(defaultPageDoc(), "Hacked");
    const siblingFrame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes("page=owner"))!;
    expect(siblingFrame).toBeTruthy();
    await siblingFrame.evaluate(({ evil, MSG_DOC }) => (window.parent.frames[0] as Window).postMessage({ type: MSG_DOC, doc: evil }, location.origin), { evil, MSG_DOC });
    await page.waitForTimeout(300);
    await expect(frame.getByRole("heading", { name: "Hacked", level: 2 })).toHaveCount(0);
    await expect(frame.getByRole("heading", { name: "Go", level: 2 })).toBeVisible();
  });

  test("a click on a block tells the parent which one, and links do nothing", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=owner");
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.evaluate(() => {
      (window as unknown as { picked: string[] }).picked = [];
      window.addEventListener("message", (e) => {
        if (e.data?.type === "freetip-preview-select") (window as unknown as { picked: string[] }).picked.push(e.data.id);
      });
      const f = document.createElement("iframe");
      f.id = "frame";
      f.src = "/dev-fixtures/preview?page=owner";
      f.style.cssText = "position:fixed;left:0;top:0;width:1280px;height:800px;z-index:9";
      document.body.appendChild(f);
    });
    const frame = page.frameLocator("#frame");
    await expect(frame.getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
    await frame.getByRole("heading", { name: "Your note", level: 2 }).click();
    await frame.locator('a[href*="instagram.com"]').click();
    // The frame's messages reach the parent a moment after the click, so wait for them.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { picked: string[] }).picked))
      .toEqual(["note", "creatorLinks"]);
    // The link was not followed.
    await expect(frame.getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
  });

  test("the selected block gets an outline when the parent says so", async ({ page }) => {
    await page.goto("/dev-fixtures/tip?page=owner");
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.evaluate(() => {
      const f = document.createElement("iframe");
      f.id = "frame";
      f.src = "/dev-fixtures/preview?page=owner";
      f.style.cssText = "position:fixed;left:0;top:0;width:1280px;height:800px;z-index:9";
      document.body.appendChild(f);
    });
    const frame = page.frameLocator("#frame");
    await expect(frame.getByRole("heading", { name: "Send", level: 2 })).toBeVisible();
    await page.waitForTimeout(300);
    await page.evaluate(({ MSG_SELECT }) => (document.getElementById("frame") as HTMLIFrameElement).contentWindow!.postMessage({ type: MSG_SELECT, id: "strip" }, location.origin), { MSG_SELECT });
    await expect.poll(() => frame.locator('[data-block-id="strip"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
    expect(ownerPageDoc().blocks.some((b) => b.type === "strip")).toBe(true);
  });
});
