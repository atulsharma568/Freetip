import { expect, test } from "@playwright/test";
import { cleanMusicTitle, musicFileName, musicPathPrefix, parsePageMusic } from "../src/lib/page-music";

const own = (id: number, file = "track-abc.mp3") => `https://abc123.public.blob.vercel-storage.com/${musicPathPrefix(id)}${file}`;

test("keeps a track under the creator's own folder", () => {
  expect(parsePageMusic({ url: own(7), title: "Song" }, 7)).toEqual({ url: own(7), title: "Song" });
});
test("refuses another creator's folder, another host, http and path tricks", () => {
  expect(parsePageMusic({ url: own(8), title: "x" }, 7)).toBeNull();
  expect(parsePageMusic({ url: "https://evil.example.com/page-music/7/a.mp3", title: "x" }, 7)).toBeNull();
  expect(parsePageMusic({ url: own(7).replace("https", "http"), title: "x" }, 7)).toBeNull();
  expect(parsePageMusic({ url: own(7, "../6/a.mp3"), title: "x" }, 7)).toBeNull();
});
test("returns null for junk", () => {
  expect(parsePageMusic(null, 7)).toBeNull();
  expect(parsePageMusic("a string", 7)).toBeNull();
  expect(parsePageMusic({ title: "x" }, 7)).toBeNull();
});
test("cleans titles", () => {
  expect(cleanMusicTitle("  a   b \n c ")).toBe("a b c");
  expect(cleanMusicTitle(5)).toBe("");
  expect([...cleanMusicTitle("x".repeat(200))].length).toBe(60);
  expect(parsePageMusic({ url: own(7), title: "   " }, 7)?.title).toBe("Now playing");
});
test("names files by type", () => {
  expect(musicFileName("audio/mpeg")).toBe("track.mp3");
  expect(musicFileName("audio/mp4")).toBe("track.m4a");
  expect(musicFileName("audio/wav")).toBe("track.wav");
});
