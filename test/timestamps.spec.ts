import { expect, test } from "@playwright/test";
import { isDiscordWebhookUrl, momentPayload, sendToDiscord, testPayload } from "../src/lib/discord-webhook";
import { open, seal, secretBoxAvailable } from "../src/lib/secret-box";
import {
  buildChapters,
  buildComment,
  chatReply,
  cleanTitle,
  cleanUser,
  commentLines,
  COMMENT_MAX_CHARS,
  formatOffset,
  groupMoments,
  momentsCsv,
  offsetSeconds,
  parseDelay,
  rupeeLabel,
  videoIdFromChatId,
  youtubeMomentLink,
} from "../src/lib/timestamps";

// The pure rules behind stream timestamps: no database, network or clock.

const KEY = Buffer.alloc(32, 7).toString("base64");

function chatIdFor(videoId: string): string {
  const bytes = Buffer.concat([Buffer.from([0x0a, 0x0d, 0x0a, 0x0b]), Buffer.from(videoId, "latin1"), Buffer.from([0x12, 0x00])]);
  return bytes.toString("base64url");
}

test.describe("video id from the chat id", () => {
  test("reads the id out of the protobuf layout", () => {
    expect(videoIdFromChatId(chatIdFor("abcDEF12345"))).toBe("abcDEF12345");
    expect(videoIdFromChatId(chatIdFor("a-b_c123456"))).toBe("a-b_c123456");
    expect(videoIdFromChatId(chatIdFor("abc DEF1234"))).toBeNull(); // a space is not in an id
  });
  test("anything that does not look like it gives null", () => {
    expect(videoIdFromChatId("")).toBeNull();
    expect(videoIdFromChatId("short")).toBeNull();
    expect(videoIdFromChatId("$(chatid)")).toBeNull();
    expect(videoIdFromChatId("A".repeat(300))).toBeNull();
    expect(videoIdFromChatId(Buffer.from("hello world, not a chat id").toString("base64url"))).toBeNull();
  });
});

test.describe("offset and format", () => {
  const start = "2026-11-01T10:00:00Z";
  test("is the arrival time minus the delay minus the start", () => {
    expect(offsetSeconds("2026-11-01T10:12:56Z", start, 22)).toBe(12 * 60 + 34);
    expect(offsetSeconds(new Date("2026-11-01T11:02:25Z"), new Date(start), 22)).toBe(3600 + 2 * 60 + 3);
  });
  test("never goes below zero, and survives junk", () => {
    expect(offsetSeconds("2026-11-01T10:00:05Z", start, 22)).toBe(0);
    expect(offsetSeconds("2026-11-01T09:00:00Z", start, 0)).toBe(0);
    expect(offsetSeconds("not a date", start, 10)).toBe(0);
    expect(offsetSeconds("2026-11-01T10:10:00Z", start, -50)).toBe(600);
  });
  test("formats as m:ss under an hour and h:mm:ss from an hour", () => {
    expect(formatOffset(0)).toBe("0:00");
    expect(formatOffset(5)).toBe("0:05");
    expect(formatOffset(754)).toBe("12:34");
    expect(formatOffset(3599)).toBe("59:59");
    expect(formatOffset(3600)).toBe("1:00:00");
    expect(formatOffset(3723)).toBe("1:02:03");
    expect(formatOffset(-4)).toBe("0:00");
  });
  test("the link opens the stream at that second", () => {
    expect(youtubeMomentLink("abcDEF12345", 754.9)).toBe("https://youtu.be/abcDEF12345?t=754");
  });
});

test.describe("clean title and user", () => {
  test("strips links, mentions, emoji codes and control characters", () => {
    expect(cleanTitle("  Nice   shot https://evil.example/x @everyone :_smile: #tag ")).toBe("Nice shot");
    expect(cleanTitle("line\none\u0000two")).toBe("line one two");
    expect(cleanTitle(null)).toBe("");
    expect(cleanTitle("https://only.a/link")).toBe("");
  });
  test("caps at 60 characters", () => {
    const out = cleanTitle("x".repeat(100));
    expect(Array.from(out)).toHaveLength(60);
    expect(out.endsWith("…")).toBe(true);
  });
  test("drops a title with a word the creator banned, and only that", () => {
    expect(cleanTitle("what a madarchod")).toBe("what a madarchod");
    expect(cleanTitle("total noob play", ["noob"])).toBe("");
    expect(cleanTitle("class act")).toBe("class act");
  });
  test("a viewer name loses its @ and markdown characters", () => {
    expect(cleanUser("@Ravi_Kumar")).toBe("RaviKumar");
    expect(cleanUser("**bold**")).toBe("bold");
    expect(cleanUser("")).toBe("Someone");
    expect(Array.from(cleanUser("n".repeat(100)))).toHaveLength(40);
  });
});

test.describe("comment", () => {
  test("moments close together become one line at the earliest time", () => {
    const lines = commentLines([
      { seconds: 600, title: "clutch", user: "a" },
      { seconds: 605, title: "clutch", user: "b" },
      { seconds: 608, title: "wow", user: "c" },
      { seconds: 100, title: "", user: "d" },
      { seconds: 900, title: "fail", user: "e" },
    ]);
    expect(lines).toEqual(["1:40", "10:00 clutch / wow", "15:00 fail"]);
  });
  test("builds the comment, and is empty with no moments", () => {
    expect(buildComment(["1:40", "10:00 clutch"])).toBe("Timestamps:\n\n1:40\n10:00 clutch");
    expect(buildComment([])).toBe("");
  });
  test("is cut at a whole line under YouTube's limit", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `${i}:00 ${"y".repeat(20)}`);
    const body = buildComment(lines);
    expect(body.length).toBeLessThanOrEqual(COMMENT_MAX_CHARS);
    expect(body.split("\n").every((l) => l === "" || l === "Timestamps:" || /^\d+:00 y{20}$/.test(l))).toBe(true);
  });
  test("the chat reply is short", () => {
    expect(chatReply(754, "Nice shot")).toBe("Saved 12:34 Nice shot");
    expect(chatReply(null, "")).toBe("Saved");
    expect(Array.from(chatReply(1, "z".repeat(500))).length).toBeLessThanOrEqual(190);
  });
  test("delay parsing", () => {
    expect(parseDelay("42")).toBe(42);
    expect(parseDelay(0)).toBe(0);
    expect(parseDelay(121)).toBe(22);
    expect(parseDelay("abc")).toBe(22);
    expect(parseDelay(1.5)).toBe(22);
    expect(parseDelay(-3, 5)).toBe(5);
  });
});

test.describe("secret box", () => {
  test("round-trips, and each seal differs", () => {
    const a = seal("refresh-token-123", KEY);
    expect(a).not.toContain("refresh-token-123");
    expect(open(a, KEY)).toBe("refresh-token-123");
    expect(seal("refresh-token-123", KEY)).not.toBe(a);
  });
  test("a wrong key, a damaged value or nothing gives null", () => {
    const sealed = seal("secret", KEY);
    expect(open(sealed, Buffer.alloc(32, 9).toString("base64"))).toBeNull();
    const parts = sealed.split(".");
    const flipped = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
    expect(open([parts[0], parts[1], parts[2], flipped].join("."), KEY)).toBeNull();
    expect(open("v1.a.b", KEY)).toBeNull();
    expect(open(null, KEY)).toBeNull();
    expect(open("junk", KEY)).toBeNull();
  });
  test("refuses a missing or short key", () => {
    // Another spec file in the same worker may have set the key; test the missing case clean.
    const saved = process.env.YT_TOKEN_KEY;
    delete process.env.YT_TOKEN_KEY;
    try {
      expect(secretBoxAvailable(undefined)).toBe(false);
    } finally {
      if (saved !== undefined) process.env.YT_TOKEN_KEY = saved;
    }
    expect(secretBoxAvailable("c2hvcnQ=")).toBe(false);
    expect(secretBoxAvailable(KEY)).toBe(true);
    expect(() => seal("x", "c2hvcnQ=")).toThrow();
  });
});

test.describe("discord webhook", () => {
  const good = `https://discord.com/api/webhooks/123456789012345678/${"a".repeat(68)}`;
  test("accepts only Discord's own address", () => {
    expect(isDiscordWebhookUrl(good)).toBe(true);
    expect(isDiscordWebhookUrl(good.replace("discord.com", "discordapp.com"))).toBe(true);
    expect(isDiscordWebhookUrl(good.replace("https", "http"))).toBe(false);
    expect(isDiscordWebhookUrl("https://evil.example/api/webhooks/123456789012345678/" + "a".repeat(68))).toBe(false);
    expect(isDiscordWebhookUrl("https://discord.com.evil.example/api/webhooks/123456789012345678/" + "a".repeat(68))).toBe(false);
    expect(isDiscordWebhookUrl("https://user@discord.com/api/webhooks/123456789012345678/" + "a".repeat(68))).toBe(false);
    expect(isDiscordWebhookUrl(`${good}/../x`)).toBe(false);
    expect(isDiscordWebhookUrl(null)).toBe(false);
  });
  test("the message pings nobody and links to the moment", () => {
    const p = momentPayload({ videoId: "abcDEF12345", streamTitle: "Ranked @everyone", seconds: 754, title: "Nice shot", user: "Ravi" });
    expect(p.allowed_mentions).toEqual({ parse: [] });
    expect(p.embeds[0].url).toBe("https://youtu.be/abcDEF12345?t=754");
    expect(p.embeds[0].description).toContain("12:34");
    expect(p.embeds[0].description).toContain("Nice shot");
    expect(p.embeds[0].footer?.text).toBe("Saved by Ravi");
    expect(testPayload().allowed_mentions).toEqual({ parse: [] });
  });
  test("sending refuses a bad address without calling anything, and fails quietly", async () => {
    let calls = 0;
    const fake = (async () => { calls += 1; return new Response(null, { status: 204 }); }) as unknown as typeof fetch;
    expect(await sendToDiscord("https://evil.example/x", testPayload(), fake)).toBe("bad_url");
    expect(calls).toBe(0);
    expect(await sendToDiscord(good, testPayload(), fake)).toBe("sent");
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await sendToDiscord(good, testPayload(), boom)).toBe("failed");
    const limited = (async () => new Response(JSON.stringify({ retry_after: 30 }), { status: 429 })) as unknown as typeof fetch;
    expect(await sendToDiscord(good, testPayload(), limited)).toBe("failed");
  });
});

test.describe("groups, chapters and CSV", () => {
  const g = (seconds: number, titles: string[] = [], marks = 1) => ({ seconds, titles, marks, sources: ["chat" as const] });

  test("grouping counts how many people marked a moment and never carries a name", () => {
    const groups = groupMoments([
      { seconds: 600, title: "clutch", user: "a", source: "chat" },
      { seconds: 604, title: "clutch", user: "b", source: "chat" },
      { seconds: 607, title: "", user: "c", source: "tip" },
      { seconds: 900, title: "fail", user: "d" },
    ]);
    expect(groups).toEqual([
      { seconds: 600, titles: ["clutch"], marks: 3, sources: ["chat", "tip"] },
      { seconds: 900, titles: ["fail"], marks: 1, sources: ["chat"] },
    ]);
    expect(JSON.stringify(groups)).not.toMatch(/"user"/);
  });

  test("chapters start at 0:00, are at least ten seconds apart, and need three", () => {
    const ok = buildChapters([g(75, ["Boss fight"]), g(120, ["Loot"]), g(125, ["too close"]), g(600, [])]);
    expect(ok).toEqual({ ok: true, count: 4, text: "0:00 Start\n1:15 Boss fight\n2:00 Loot\n10:00 Moment 4" });
    expect(buildChapters([g(0, ["Intro"]), g(60, ["Game"]), g(3700, ["End"])])).toEqual({
      ok: true,
      count: 3,
      text: "0:00 Intro\n1:00 Game\n1:01:40 End",
    });
    const few = buildChapters([g(0, ["a"]), g(300, ["b"])]);
    expect(few.ok).toBe(false);
    expect(buildChapters([])).toMatchObject({ ok: false });
  });

  test("the CSV quotes cells and stops spreadsheet formulas", () => {
    const csv = momentsCsv("abcDEF12345", [
      { seconds: 754, titles: ['say "hi", ok'], marks: 2, sources: ["chat"] },
      { seconds: 800, titles: ["=HYPERLINK(\"http://x\")"], marks: 1, sources: ["tip", "goal"] },
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("time,seconds,label,source,marks,link");
    expect(lines[1]).toBe('12:34,754,"say ""hi"", ok",chat,2,https://youtu.be/abcDEF12345?t=754');
    expect(lines[2].startsWith("13:20,800,\"'=HYPERLINK")).toBe(true);
    expect(lines[2]).toContain("tip+goal");
  });

  test("rupee labels use Indian grouping", () => {
    expect(rupeeLabel(50000)).toBe("₹500");
    expect(rupeeLabel(125000)).toBe("₹1,250");
    expect(rupeeLabel(1000000000)).toBe("₹1,00,00,000");
  });
});
