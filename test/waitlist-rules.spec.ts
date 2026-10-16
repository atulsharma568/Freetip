import { expect, test } from "@playwright/test";
import {
  EMAIL_PATTERN,
  HANDLE_PATTERN,
  parseWaitlist,
  waitlistMessage,
} from "../src/lib/waitlist";

function makeForm(fields: Record<string, string | undefined>) {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.set(name, value);
  }

  return form;
}

function parseWith(fields: Record<string, string | undefined>) {
  return parseWaitlist(makeForm({ email: "member@example.com", ...fields }));
}

test.describe("waitlist rules", () => {
  test.describe("email", () => {
    test("trims and lowercases valid email addresses", () => {
      expect(EMAIL_PATTERN.test("member@example.com")).toBe(true);
      expect(
        parseWaitlist(makeForm({ email: "  MEMBER@Example.COM  " })),
      ).toEqual({
        ok: true,
        entry: {
          email: "member@example.com",
          handle: null,
          channel: null,
          source: "home",
        },
      });
    });

    test("accepts 254-character emails but rejects 255-character emails", () => {
      const email254 = `${"a".repeat(242)}@example.com`;
      const email255 = `${"a".repeat(243)}@example.com`;

      expect(email254.length).toBe(254);
      expect(email255.length).toBe(255);
      expect(EMAIL_PATTERN.test(email254)).toBe(true);
      expect(EMAIL_PATTERN.test(email255)).toBe(true);
      expect(parseWaitlist(makeForm({ email: email254 }))).toEqual({
        ok: true,
        entry: {
          email: email254,
          handle: null,
          channel: null,
          source: "home",
        },
      });
      expect(parseWaitlist(makeForm({ email: email255 }))).toEqual({
        ok: false,
        field: "email",
      });
    });

    test("rejects clearly invalid email addresses with the email field", () => {
      const invalidEmails = [
        "plainaddress",
        "missing-at.example.com",
        "missing-domain@",
        "@example.com",
        "person@example",
        "person @example.com",
        "person@@example.com",
      ];

      for (const email of invalidEmails) {
        expect(
          parseWaitlist(makeForm({ email })),
          `invalid email: ${email}`,
        ).toEqual({
          ok: false,
          field: "email",
        });
      }
    });
  });

  test.describe("handle", () => {
    test("accepts 3- and 20-character handles and normalizes uppercase", () => {
      const twentyCharacterHandle = "A".repeat(20);

      expect(HANDLE_PATTERN.test("abc")).toBe(true);
      expect(HANDLE_PATTERN.test("a".repeat(20))).toBe(true);
      expect(HANDLE_PATTERN.test("ab")).toBe(false);
      expect(HANDLE_PATTERN.test("a".repeat(21))).toBe(false);
      expect(parseWith({ handle: "ABC" })).toEqual({
        ok: true,
        entry: {
          email: "member@example.com",
          handle: "abc",
          channel: null,
          source: "home",
        },
      });
      expect(parseWith({ handle: twentyCharacterHandle })).toEqual({
        ok: true,
        entry: {
          email: "member@example.com",
          handle: "a".repeat(20),
          channel: null,
          source: "home",
        },
      });
    });

    test("rejects 2- and 21-character handles with the handle field", () => {
      for (const handle of ["ab", "a".repeat(21)]) {
        expect(parseWith({ handle }), `invalid handle: ${handle}`).toEqual({
          ok: false,
          field: "handle",
        });
      }
    });

    test("rejects spaces and symbols in handles", () => {
      for (const handle of ["ab c", "abc def", "abc-def", "abc!", "abc@"]) {
        expect(parseWith({ handle }), `invalid handle: ${handle}`).toEqual({
          ok: false,
          field: "handle",
        });
      }
    });

    test("turns an empty or whitespace-only handle into null", () => {
      expect(parseWith({ handle: "   " })).toEqual({
        ok: true,
        entry: {
          email: "member@example.com",
          handle: null,
          channel: null,
          source: "home",
        },
      });
    });
  });

  test.describe("channel", () => {
    // parseChannel is private, so its behavior is exercised through parseWaitlist.
    test("normalizes supported YouTube channel forms", () => {
      const supportedChannels: Array<[string, string]> = [
        ["@creator", "https://www.youtube.com/@creator"],
        ["  youtube.com/@creator  ", "https://www.youtube.com/@creator"],
        ["https://youtube.com/@creator", "https://www.youtube.com/@creator"],
        ["www.youtube.com/@creator", "https://www.youtube.com/@creator"],
        [
          "https://www.youtube.com/@creator",
          "https://www.youtube.com/@creator",
        ],
        ["m.youtube.com/@creator", "https://www.youtube.com/@creator"],
        [
          "https://m.youtube.com/@creator",
          "https://www.youtube.com/@creator",
        ],
        [
          "http://m.youtube.com/@creator",
          "https://www.youtube.com/@creator",
        ],
        [
          "youtube.com/channel/UC123456",
          "https://www.youtube.com/channel/UC123456",
        ],
        [
          "https://www.youtube.com/c/creator",
          "https://www.youtube.com/c/creator",
        ],
        [
          "http://m.youtube.com/user/creator",
          "https://www.youtube.com/user/creator",
        ],
      ];

      for (const [channel, normalizedChannel] of supportedChannels) {
        expect(
          parseWith({ channel }),
          `supported channel: ${channel}`,
        ).toEqual({
          ok: true,
          entry: {
            email: "member@example.com",
            handle: null,
            channel: normalizedChannel,
            source: "home",
          },
        });
      }
    });

    const shortHandleChannels: Array<[string, string]> = [
      ["@x", "https://www.youtube.com/@x"],
      ["youtube.com/@x", "https://www.youtube.com/@x"],
      ["https://youtube.com/@x", "https://www.youtube.com/@x"],
      ["www.youtube.com/@x", "https://www.youtube.com/@x"],
      ["https://www.youtube.com/@x", "https://www.youtube.com/@x"],
      ["m.youtube.com/@x", "https://www.youtube.com/@x"],
      ["https://m.youtube.com/@x", "https://www.youtube.com/@x"],
    ];

    for (const [channel, normalizedChannel] of shortHandleChannels) {
      test(`normalizes the requested short @x channel form: ${channel}`, () => {
        // Existing source bug: parseChannel requires at least three characters after "@".
        test.fail();
        expect(parseWith({ channel })).toEqual({
          ok: true,
          entry: {
            email: "member@example.com",
            handle: null,
            channel: normalizedChannel,
            source: "home",
          },
        });
      });
    }

    test("rejects unsupported hosts, schemes, paths, and oversized channels", () => {
      const tooLongChannel = `https://www.youtube.com/@creator${"a".repeat(180)}`;
      expect(tooLongChannel.length).toBeGreaterThan(200);

      const invalidChannels = [
        "https://youtube.com.evil.example/@creator",
        "https://notyoutube.com/@creator",
        "javascript:alert(1)",
        "javascript://youtube.com/@creator",
        "https://www.youtube.com/",
        "https://www.youtube.com/watch?v=creator",
        "youtube.com/shorts/creator",
        "https://m.youtube.com/playlist?list=abc",
        "https://www.youtube.com/about",
        "https://www.youtube.com/channel/",
        "https://www.youtube.com/c/",
        "https://www.youtube.com/user/",
        tooLongChannel,
      ];

      for (const channel of invalidChannels) {
        expect(
          parseWith({ channel }),
          `invalid channel: ${channel}`,
        ).toEqual({
          ok: false,
          field: "channel",
        });
      }
    });
  });

  test("reports invalid fields in handle, email, then channel order", () => {
    expect(
      parseWaitlist(
        makeForm({
          handle: "ab",
          email: "not-an-email",
          channel: "notyoutube.com/creator",
        }),
      ),
    ).toEqual({
      ok: false,
      field: "handle",
    });

    expect(
      parseWaitlist(
        makeForm({
          handle: "creator",
          email: "not-an-email",
          channel: "notyoutube.com/creator",
        }),
      ),
    ).toEqual({
      ok: false,
      field: "email",
    });

    expect(
      parseWaitlist(
        makeForm({
          handle: "creator",
          email: "member@example.com",
          channel: "notyoutube.com/creator",
        }),
      ),
    ).toEqual({
      ok: false,
      field: "channel",
    });

    expect(parseWaitlist(makeForm({ handle: "creator" }))).toEqual({
      ok: false,
      field: "email",
    });
  });

  test("keeps source as home or signup and defaults arbitrary or missing source to home", () => {
    expect(parseWith({ source: "home" })).toEqual({
      ok: true,
      entry: {
        email: "member@example.com",
        handle: null,
        channel: null,
        source: "home",
      },
    });
    expect(parseWith({ source: "signup" })).toEqual({
      ok: true,
      entry: {
        email: "member@example.com",
        handle: null,
        channel: null,
        source: "signup",
      },
    });
    expect(parseWith({ source: "campaign" })).toEqual({
      ok: true,
      entry: {
        email: "member@example.com",
        handle: null,
        channel: null,
        source: "home",
      },
    });
    expect(parseWith({})).toEqual({
      ok: true,
      entry: {
        email: "member@example.com",
        handle: null,
        channel: null,
        source: "home",
      },
    });
  });

  test("returns the exact message for every waitlist state and invalid field", () => {
    const cases = [
      [{ status: "idle" }, ""],
      [
        { status: "ok" },
        "You're on the list. We'll email you when sign-up opens.",
      ],
      [{ status: "invalid", field: "email" }, "Enter a valid email address."],
      [
        { status: "invalid", field: "handle" },
        "Handles use 3 to 20 letters, numbers or underscores.",
      ],
      [
        { status: "invalid", field: "channel" },
        "Use your YouTube channel link, like youtube.com/@yourchannel.",
      ],
      [
        { status: "rate_limited" },
        "Too many tries from this network. Please try again in an hour.",
      ],
      [
        { status: "unavailable" },
        "The waitlist isn't working right now. Please try again later.",
      ],
    ] as const;

    for (const [state, message] of cases) {
      // An empty idle message is intentional.
      expect(waitlistMessage(state)).toBe(message);
    }
  });
});
