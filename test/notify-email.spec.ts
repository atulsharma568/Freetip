import { expect, test } from "@playwright/test";
import { getNotifyEmail, getSavedNotifyEmail, maskEmail, parseNotifyEmail } from "../src/lib/site-settings";
import { asLedgerDb, freshDatabase } from "./helpers/pg";

// The address the owner's emails go to (contact messages and the morning payout list): saved in
// /admin/settings, else CONTACT_NOTIFY_EMAIL from Vercel, else off.

test("only one plain address is accepted", () => {
  expect(parseNotifyEmail(" Owner.Name+pay@Gmail.com ")).toBe("owner.name+pay@gmail.com");
  for (const bad of ["", "abc", "a@b", "a@b.c", "two@x.com, three@y.com", "a b@x.com", "a@x.com;b@y.com", "a@x.com\nbcc: b@y.com", "@x.com", "a@@x.com", `${"a".repeat(250)}@x.com`]) {
    expect(parseNotifyEmail(bad), bad).toBeNull();
  }
});

test("the history keeps a masked address", () => {
  expect(maskEmail("owner@gmail.com")).toBe("o***@gmail.com");
  expect(maskEmail(null)).toBeNull();
});

test("the saved address wins, a bad saved value is ignored, and Vercel's is the fallback", async () => {
  const pg = await freshDatabase();
  const db = asLedgerDb(pg) as never;
  const before = process.env.CONTACT_NOTIFY_EMAIL;
  try {
    delete process.env.CONTACT_NOTIFY_EMAIL;
    expect(await getNotifyEmail(db)).toBeNull();
    process.env.CONTACT_NOTIFY_EMAIL = "vercel@example.com";
    expect(await getNotifyEmail(db)).toBe("vercel@example.com");
    expect(await getSavedNotifyEmail(db)).toBeNull();

    await pg.query(`insert into site_settings (key, value) values ('notify_email', 'mine@example.com')`);
    expect(await getSavedNotifyEmail(db)).toBe("mine@example.com");
    expect(await getNotifyEmail(db)).toBe("mine@example.com");

    await pg.query(`update site_settings set value = 'not an email' where key = 'notify_email'`);
    expect(await getNotifyEmail(db)).toBe("vercel@example.com");

    await pg.query(`delete from site_settings where key = 'notify_email'`);
    expect(await getNotifyEmail(db)).toBe("vercel@example.com");
    expect(await getNotifyEmail(null)).toBe("vercel@example.com");
  } finally {
    if (before === undefined) delete process.env.CONTACT_NOTIFY_EMAIL;
    else process.env.CONTACT_NOTIFY_EMAIL = before;
  }
});
