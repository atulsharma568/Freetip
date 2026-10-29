import { expect, test } from "@playwright/test";
import {
  BLOB_HOST_SUFFIX,
  SOUND_MAX_BYTES,
  checkPick,
  cleanSoundEmoji,
  cleanSoundName,
  encodeWav,
  isOwnSoundUrl,
  parseMinRupees,
  parseVolume,
  parseWav,
  soundFileName,
  soundPathPrefix,
} from "../src/lib/sounds";

const tone = (seconds: number, rate = 44_100) => {
  const data = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < data.length; i++) data[i] = Math.sin((i / rate) * 440 * 2 * Math.PI) * 0.5;
  return data;
};

test.describe("sound files", () => {
  test("a repaired WAV reads back with its channels, rate and length", () => {
    const bytes = encodeWav([tone(2), tone(2)], 44_100);
    const parsed = parseWav(bytes);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.info).toEqual({ channels: 2, sampleRate: 44_100, durationMs: 2000 });
    }
  });

  test("mono works too", () => {
    const parsed = parseWav(encodeWav([tone(1, 22_050)], 22_050));
    expect(parsed.ok && parsed.info.channels).toBe(1);
  });

  test("30 seconds is allowed, 31 is not", () => {
    expect(parseWav(encodeWav([tone(30, 22_050)], 22_050)).ok).toBe(true);
    const long = parseWav(encodeWav([tone(31, 22_050)], 22_050));
    expect(long).toEqual({ ok: false, reason: "The sound is longer than 30 seconds." });
  });

  test("a clip under a tenth of a second is too short", () => {
    const parsed = parseWav(encodeWav([tone(0.05, 22_050)], 22_050));
    expect(parsed.ok).toBe(false);
  });

  test("a stereo WAV of the longest allowed length stays under the 8 MB cap", () => {
    const bytes = encodeWav([tone(30), tone(30)], 44_100);
    expect(bytes.length).toBeLessThan(SOUND_MAX_BYTES);
  });

  test("anything that is not the standard WAV is refused", () => {
    const good = encodeWav([tone(1)], 44_100);

    const notRiff = good.slice();
    notRiff[0] = 0x58;
    expect(parseWav(notRiff).ok).toBe(false);

    // A header whose data size does not match the file (truncated upload).
    expect(parseWav(good.slice(0, good.length - 10)).ok).toBe(false);

    // An MP3 renamed to .wav.
    expect(parseWav(new TextEncoder().encode("ID3".padEnd(200, "x"))).ok).toBe(false);

    expect(parseWav(new Uint8Array(10)).ok).toBe(false);
  });

  test("an oversized file is refused before its header is read", () => {
    const parsed = parseWav(new Uint8Array(SOUND_MAX_BYTES + 1));
    expect(parsed).toEqual({ ok: false, reason: "The file is over 8 MB." });
  });

  test("encoding clips samples outside -1 to 1 instead of wrapping them", () => {
    const bytes = encodeWav([new Float32Array([2, -2, 0.5, 0])], 44_100);
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});

test.describe("sound upload address", () => {
  const own = `https://abc123${BLOB_HOST_SUFFIX}/${soundPathPrefix(7)}boom-x1.wav`;

  test("accepts a file in the creator's own folder", () => {
    expect(isOwnSoundUrl(own, 7)).toBe(true);
  });

  test("refuses another creator's folder, other hosts, plain http and odd paths", () => {
    expect(isOwnSoundUrl(own, 8)).toBe(false);
    expect(isOwnSoundUrl(`https://evil.example.com/${soundPathPrefix(7)}a.wav`, 7)).toBe(false);
    expect(isOwnSoundUrl(`https://x${BLOB_HOST_SUFFIX}.evil.com/${soundPathPrefix(7)}a.wav`, 7)).toBe(false);
    expect(isOwnSoundUrl(own.replace("https:", "http:"), 7)).toBe(false);
    expect(isOwnSoundUrl(`https://x${BLOB_HOST_SUFFIX}/sounds/70/a.wav`, 7)).toBe(false);
    expect(isOwnSoundUrl("not a url", 7)).toBe(false);
  });
});

test.describe("sound details", () => {
  test("names are trimmed, tidied and capped at 40", () => {
    expect(cleanSoundName("  Vine   Boom <b> ")).toBe("Vine Boom b");
    expect(cleanSoundName("x".repeat(60))).toHaveLength(40);
    expect(cleanSoundName(null)).toBe("");
  });

  test("an emoji is optional and cut by character, not by byte", () => {
    expect(cleanSoundEmoji("")).toBeNull();
    expect(cleanSoundEmoji("🔊")).toBe("🔊");
    expect(Array.from(cleanSoundEmoji("😀😀😀😀😀😀😀😀😀😀")!)).toHaveLength(8);
  });

  test("minimum tip is a whole number of rupees from 0 to 10,000", () => {
    expect(parseMinRupees("0")).toBe(0);
    expect(parseMinRupees(49)).toBe(49);
    expect(parseMinRupees("10000")).toBe(10_000);
    expect(parseMinRupees("10001")).toBeNull();
    expect(parseMinRupees("-1")).toBeNull();
    expect(parseMinRupees("abc")).toBeNull();
  });

  test("volume is 10 to 100", () => {
    expect(parseVolume(100)).toBe(100);
    expect(parseVolume("10")).toBe(10);
    expect(parseVolume(9)).toBeNull();
    expect(parseVolume(101)).toBeNull();
  });

  test("a file name comes from the sound's name", () => {
    expect(soundFileName("Vine Boom!")).toBe("vine-boom.wav");
    expect(soundFileName("🔊")).toBe("sound.wav");
  });
});

test.describe("a fan's sound pick", () => {
  test("is refused when the sound is gone, switched off or the tip is too small", () => {
    expect(checkPick(undefined, 10_000)).toMatch(/no longer available/);
    expect(checkPick({ enabled: false, min_paise: 0 }, 10_000)).toMatch(/switched off/);
    expect(checkPick({ enabled: true, min_paise: 5000 }, 4900)).toBe("Tip at least ₹50 to play this sound.");
  });

  test("is allowed at exactly the minimum", () => {
    expect(checkPick({ enabled: true, min_paise: 5000 }, 5000)).toBeNull();
    expect(checkPick({ enabled: true, min_paise: 0 }, 100)).toBeNull();
  });
});
