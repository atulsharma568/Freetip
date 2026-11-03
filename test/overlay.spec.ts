import { expect, test } from "@playwright/test";

const TOKEN = "a".repeat(43);

// Half a second of silence as a WAV: small, and a browser can read its length.
function silentWav(): Buffer {
  const samples = 4000;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, Buffer.alloc(samples, 128)]);
}

const SPEAKING_ALERT = {
  alert: { id: 7, kind: "alert", name: "Riya", amountPaise: 25000, message: "great stream", speech: true },
};

test.describe("OBS overlay routes", () => {
  test("preview plays a sample alert and switches to the vertical layout", async ({ page }) => {
    await page.goto("/overlay/preview");
    const stage = page.getByTestId("preview-stage");
    await expect(stage.getByRole("status")).toContainText("Riya");
    await expect(stage.getByRole("status")).toContainText("₹250");

    await page.getByRole("button", { name: /Vertical/ }).click();
    await expect(stage.locator(".ov-portrait")).toHaveCount(1);
    await expect(stage.getByRole("status")).toContainText("Riya");
  });

  test("live overlay page has no site chrome and a transparent background", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("a malformed token is a 404 page and a 404 from the API", async ({ page, request }) => {
    const res = await page.goto("/overlay/not-a-real-token");
    expect(res?.status()).toBe(404);
    expect((await request.get("/api/overlay/not-a-real-token")).status()).toBe(404);
  });

  test("the API answers 503 without a database and never caches", async ({ request }) => {
    const res = await request.get(`/api/overlay/${TOKEN}`);
    expect(res.status()).toBe(503);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("overlay pages are kept out of search results", async ({ page }) => {
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the speech route rejects a bad id and stays silent while the site's voice switch is off", async ({ request }) => {
    expect((await request.get(`/api/overlay/${TOKEN}/speech/abc`)).status()).toBe(404);
    // TTS_ENABLED is not set in the test server, so a valid id gets "no content"
    // without touching the database or the speech engine.
    const res = await request.get(`/api/overlay/${TOKEN}/speech/7`);
    expect(res.status()).toBe(204);
    expect(res.headers()["cache-control"]).toBe("no-store");
  });

  test("an alert with speech downloads the audio and plays it with the card", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __plays: number }).__plays = 0;
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { __plays: number }).__plays += 1;
        return Promise.resolve();
      };
    });
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route.fulfill({ json: served ? { alert: null } : SPEAKING_ALERT }).then(() => {
        served = true;
      }),
    );
    let speechRequests = 0;
    await page.route(`**/api/overlay/${TOKEN}/speech/7`, (route) => {
      speechRequests += 1;
      return route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() });
    });

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    expect(speechRequests).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBeGreaterThan(0);
  });

  test("if the speech is unavailable the alert still shows, silently", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __plays: number }).__plays = 0;
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { __plays: number }).__plays += 1;
        return Promise.resolve();
      };
    });
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route.fulfill({ json: served ? { alert: null } : SPEAKING_ALERT }).then(() => {
        served = true;
      }),
    );
    await page.route(`**/api/overlay/${TOKEN}/speech/7`, (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBe(0);
  });
  // A 1x1 GIF: the smallest picture a browser will decode.
  const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  const MEDIA_URL = "https://media.example.test/party.gif";

  for (const placement of ["above", "behind", "fullscreen"] as const) {
    test(`alert media shows ${placement}, never makes sound, and the card keeps its text`, async ({ page }) => {
      let served = false;
      await page.route(`**/api/overlay/${TOKEN}`, (route) =>
        route
          .fulfill({
            json: served
              ? { alert: null }
              : {
                  alert: {
                    ...SPEAKING_ALERT.alert,
                    speech: false,
                    media: { url: MEDIA_URL, kind: "gif", placement, durationMs: null },
                  },
                },
          })
          .then(() => {
            served = true;
          }),
      );
      await page.route(MEDIA_URL, (route) => route.fulfill({ status: 200, contentType: "image/gif", body: PIXEL_GIF }));

      await page.goto(`/overlay/${TOKEN}`);
      await expect(page.getByRole("status")).toContainText("great stream");
      const media = page.locator(`img.ov-media-${placement}`);
      await expect(media).toHaveCount(1);
      await expect(media).toHaveAttribute("src", MEDIA_URL);
      // Behind sits inside the card; above sits in the stack with it; fullscreen is a sibling of the card.
      await expect(page.locator(".ov-card img.ov-media")).toHaveCount(placement === "behind" ? 1 : 0);
      await expect(page.locator(".ov-stack img.ov-media")).toHaveCount(placement === "above" ? 1 : 0);
    });
  }

  for (const side of ["left", "right"] as const) {
    test(`a picture placed above goes ${side} of the card with the layout, on a landscape stage`, async ({ page }) => {
      let served = false;
      await page.route(`**/api/overlay/${TOKEN}`, (route) =>
        route
          .fulfill({
            json: served
              ? { alert: null }
              : {
                  alert: {
                    ...SPEAKING_ALERT.alert,
                    speech: false,
                    media: { url: MEDIA_URL, kind: "gif", placement: "above", durationMs: null },
                    layout: { side },
                  },
                },
          })
          .then(() => {
            served = true;
          }),
      );
      await page.route(MEDIA_URL, (route) => route.fulfill({ status: 200, contentType: "image/gif", body: PIXEL_GIF }));
      // The mobile project is portrait, where the picture stays above the card by design.
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`/overlay/${TOKEN}`);
      await expect(page.getByRole("status")).toContainText("great stream");
      await expect(page.locator(`.ov-stack.ov-side-${side}`)).toHaveCount(1);
      // Wait for the entrance animations to settle before measuring.
      await page.waitForTimeout(900);
      const card = (await page.locator(".ov-card").boundingBox())!;
      const media = (await page.locator("img.ov-media-above").boundingBox())!;
      if (side === "left") expect(media.x + media.width).toBeLessThanOrEqual(card.x + 1);
      else expect(media.x).toBeGreaterThanOrEqual(card.x + card.width - 1);
      // Side by side: their vertical ranges overlap, unlike the stacked layout.
      expect(media.y).toBeLessThan(card.y + card.height);
      expect(media.y + media.height).toBeGreaterThan(card.y);
    });
  }

  test("without a layout the picture stays above the card", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({
          json: served
            ? { alert: null }
            : { alert: { ...SPEAKING_ALERT.alert, speech: false, media: { url: MEDIA_URL, kind: "gif", placement: "above", durationMs: null } } },
        })
        .then(() => {
          served = true;
        }),
    );
    await page.route(MEDIA_URL, (route) => route.fulfill({ status: 200, contentType: "image/gif", body: PIXEL_GIF }));
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    await expect(page.locator(".ov-stack.ov-side")).toHaveCount(0);
    await page.waitForTimeout(900);
    const card = (await page.locator(".ov-card").boundingBox())!;
    const media = (await page.locator("img.ov-media-above").boundingBox())!;
    expect(media.y + media.height).toBeLessThanOrEqual(card.y + 1);
  });

  test("the creator's master volume scales the voice, and a normal alert plays it at full volume", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __vols: number[] }).__vols = [];
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { __vols: number[] }).__vols.push(this.volume);
        return Promise.resolve();
      };
    });
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({ json: served ? { alert: null } : { alert: { ...SPEAKING_ALERT.alert, layout: { voiceVolume: 40 } } } })
        .then(() => {
          served = true;
        }),
    );
    await page.route(`**/api/overlay/${TOKEN}/speech/7`, (route) =>
      route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav() }),
    );
    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    const vols = await page.evaluate(() => (window as unknown as { __vols: number[] }).__vols);
    expect(vols.length).toBeGreaterThan(0);
    expect(vols[0]).toBeCloseTo(0.4, 2);
  });

  test("a media file that cannot load is dropped and the plain card still plays", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({
          json: served
            ? { alert: null }
            : {
                alert: {
                  ...SPEAKING_ALERT.alert,
                  speech: false,
                  media: { url: MEDIA_URL, kind: "gif", placement: "above", durationMs: null },
                },
              },
        })
        .then(() => {
          served = true;
        }),
    );
    await page.route(MEDIA_URL, (route) => route.fulfill({ status: 404, body: "gone" }));

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    await expect(page.locator(".ov-media")).toHaveCount(0);
  });

  test("motion from the server sets how the card comes and goes and how long it stays; none is the wipe", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({
          json: served
            ? { alert: null }
            : { alert: { ...SPEAKING_ALERT.alert, speech: false, motion: { enter: "zoom", exit: "fade", seconds: 7 } } },
        })
        .then(() => {
          served = true;
        }),
    );
    await page.goto(`/overlay/${TOKEN}`);
    const card = page.locator(".ov-card");
    await expect(card).toContainText("great stream");
    await expect(card).toHaveAttribute("data-in", "zoom");
    await expect(card).toHaveAttribute("data-out", "fade");
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("ov-zoom-in, ov-fade-out");
    expect(await card.evaluate((el) => el.style.getPropertyValue("--dur"))).toBe("7000ms");
  });

  test("without motion the card wipes in and out for the usual length", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({ json: served ? { alert: null } : { alert: { ...SPEAKING_ALERT.alert, speech: false } } })
        .then(() => {
          served = true;
        }),
    );
    await page.goto(`/overlay/${TOKEN}`);
    const card = page.locator(".ov-card");
    await expect(card).toContainText("great stream");
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("ov-wipe-in, ov-wipe-out");
    expect(await card.evaluate((el) => el.hasAttribute("data-in"))).toBe(false);
  });

  test("a theme and font from the server restyle the card; an unknown key is the plain card", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({
          json: served
            ? { alert: null }
            : { alert: { ...SPEAKING_ALERT.alert, speech: false, theme: { theme: "blocky", font: "pixel" } } },
        })
        .then(() => {
          served = true;
        }),
    );
    await page.goto(`/overlay/${TOKEN}`);
    const card = page.locator(".ov-card");
    await expect(card).toContainText("great stream");
    // Blocky: square corners, a hard shadow, a border; Pixel: the smaller type multiplier.
    await expect(card).toHaveCSS("border-top-left-radius", "0px");
    expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    expect(await card.evaluate((el) => el.style.getPropertyValue("--c-fs"))).toBe("0.7");
  });

  test("a fan's level shows on the card, and a plain alert shows none", async ({ page }) => {
    let served = 0;
    await page.route(`**/api/overlay/${TOKEN}`, (route) => {
      served += 1;
      const extra =
        served === 1 ? { level: { level: 3, up: true } } : served === 2 ? { level: { level: 4, up: false } } : {};
      return route.fulfill({ json: served > 3 ? { alert: null } : { alert: { ...SPEAKING_ALERT.alert, id: 7 + served, speech: false, ...extra } } });
    });
    await page.goto(`/overlay/${TOKEN}`);
    const card = page.locator(".ov-card");
    await expect(card.locator(".ov-level")).toHaveText("Level up! Lv 3");
    // The next alerts: a level with no level-up, then a plain one.
    await expect(card.locator(".ov-level")).toHaveText("Lv 4", { timeout: 20_000 });
    await expect(card.locator(".ov-level")).toHaveCount(0, { timeout: 20_000 });
  });

  test("an unknown theme key from the server plays as the plain card", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route
        .fulfill({
          json: served
            ? { alert: null }
            : { alert: { ...SPEAKING_ALERT.alert, speech: false, theme: { theme: "retired", font: "nope" } } },
        })
        .then(() => {
          served = true;
        }),
    );
    await page.goto(`/overlay/${TOKEN}`);
    const card = page.locator(".ov-card");
    await expect(card).toContainText("great stream");
    expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
    expect(await card.evaluate((el) => el.style.getPropertyValue("--c-bg"))).toBe("");
  });

  test("the overlay confirms an alert once its card is on screen", async ({ page }) => {
    let served = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) =>
      route.fulfill({ json: served ? { alert: null } : { alert: { ...SPEAKING_ALERT.alert, speech: false } } }).then(() => {
        served = true;
      }),
    );
    const confirmed: unknown[] = [];
    await page.route(`**/api/overlay/${TOKEN}/ack`, (route) => {
      confirmed.push(route.request().postDataJSON());
      return route.fulfill({ status: 204 });
    });

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    await expect.poll(() => confirmed).toEqual([{ id: 7, kind: "alert" }]);
  });

  test("a dashboard test alert shows a card, and an old command does not replay after a reload", async ({ page }) => {
    // The first answer carries old command times: nothing may happen. The second
    // carries a newer test time: the test card shows and is never confirmed.
    let calls = 0;
    await page.route(`**/api/overlay/${TOKEN}`, (route) => {
      calls += 1;
      return route.fulfill({ json: { alert: null, controls: { skipAt: 100, testAt: calls === 1 ? 100 : 200 } } });
    });
    let acks = 0;
    await page.route(`**/api/overlay/${TOKEN}/ack`, (route) => {
      acks += 1;
      return route.fulfill({ status: 204 });
    });

    await page.goto(`/overlay/${TOKEN}`);
    await expect.poll(() => calls).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("This is a test from your dashboard.", { timeout: 15000 });
    expect(acks).toBe(0);
  });

  test("a dashboard skip clears the card on screen", async ({ page }) => {
    let calls = 0;
    let skipServed = false;
    await page.route(`**/api/overlay/${TOKEN}`, (route) => {
      calls += 1;
      const alert = calls === 1 ? { ...SPEAKING_ALERT.alert, speech: false } : null;
      if (calls >= 2) skipServed = true;
      return route.fulfill({ json: { alert, controls: { skipAt: calls >= 2 ? 500 : 100, testAt: 0 } } });
    });
    await page.route(`**/api/overlay/${TOKEN}/ack`, (route) => route.fulfill({ status: 204 }));

    await page.goto(`/overlay/${TOKEN}`);
    await expect(page.getByRole("status")).toContainText("great stream");
    // The second poll (about 4s in) carries the skip. The card would stay up until
    // about 6.5s, so it must be gone within a second of the skip, well before that.
    await expect.poll(() => skipServed, { timeout: 8000 }).toBe(true);
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 1000 });
  });

  test("the preview never confirms anything", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/overlay/**", (route) => {
      calls += 1;
      return route.fulfill({ status: 204 });
    });
    await page.goto("/overlay/preview");
    await expect(page.getByTestId("preview-stage").getByRole("status")).toContainText("Riya");
    expect(calls).toBe(0);
  });

  test("the confirm route rejects a bad token or body and needs a database", async ({ request }) => {
    const post = (token: string, data: unknown) =>
      request.post(`/api/overlay/${token}/ack`, { data });

    expect((await post("not-a-real-token", { id: 7, kind: "alert" })).status()).toBe(404);
    expect((await post(TOKEN, { id: "7", kind: "alert" })).status()).toBe(400);
    expect((await post(TOKEN, { id: 7, kind: "other" })).status()).toBe(400);
    expect((await post(TOKEN, { id: -1, kind: "alert" })).status()).toBe(400);
    const res = await post(TOKEN, { id: 7, kind: "message" });
    expect(res.status()).toBe(503);
    expect(res.headers()["cache-control"]).toBe("no-store");
    // Only POST is accepted.
    expect((await request.get(`/api/overlay/${TOKEN}/ack`)).status()).toBe(405);
  });
});
