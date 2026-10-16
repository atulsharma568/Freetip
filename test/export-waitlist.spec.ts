import { expect, test } from "@playwright/test";
import { buildWaitlistCsv } from "../scripts/export-waitlist.mjs";

test.describe("waitlist CSV export", () => {
  test("quotes special fields, keeps optional fields empty, and formats dates", () => {
    const csv = buildWaitlistCsv([
      {
        email: "creator@example.com",
        handle: 'my,handle"with-quotes',
        channel_url: "https://youtube.com/@creator\nline-two",
        source: "signup",
        consent_version: "privacy-2026-10",
        created_at: new Date("2026-10-16T12:34:56.000Z"),
      },
      {
        email: "empty@example.com",
        handle: null,
        channel_url: undefined,
        source: "home",
        consent_version: "privacy-2026-10",
        created_at: new Date("2026-10-17T00:00:00.000Z"),
      },
    ]);

    expect(csv).toBe(
      [
        "email,handle,channel_url,source,consent_version,created_at",
        'creator@example.com,"my,handle""with-quotes","https://youtube.com/@creator\nline-two",signup,privacy-2026-10,2026-10-16T12:34:56.000Z',
        "empty@example.com,,,home,privacy-2026-10,2026-10-17T00:00:00.000Z",
      ].join("\n"),
    );
  });

  test("prefixes every spreadsheet formula-injection prefix before quoting", () => {
    const csv = buildWaitlistCsv([
      {
        email: "=email",
        handle: "+handle",
        channel_url: "-channel",
        source: "@source",
        consent_version: "\tconsent",
        created_at: "\rcreated",
      },
    ]);

    expect(csv).toBe(
      [
        "email,handle,channel_url,source,consent_version,created_at",
        "'=email,'+handle,'-channel,'@source,'\tconsent,\"'\rcreated\"",
      ].join("\n"),
    );
  });
});
