import { MIN_TIP_PAISE } from "@/lib/money";
import { ownerBrand } from "@/lib/owner-page";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import type { PageDoc } from "@/lib/page-doc/types";
import type { TipPageData } from "../../[handle]/TipPageView";

// The made-up creator the test-only fixture routes draw: no database, fixed sounds and picks.
// Made-up pictures the fixture page can use by id, so the browser tests can draw a picture
// backdrop without a database or a Blob store: 1 a picture, 2 a GIF with its still, 3 a video with
// its still (the video file does not exist; the tests only look at whether a video is mounted).
export const FIXTURE_ASSETS: Record<number, ResolvedAsset> = {
  1: { id: 1, kind: "image", url: "/owner/kitsune.svg", posterUrl: null },
  2: { id: 2, kind: "gif", url: "/example-alert.gif", posterUrl: "/owner/kitsune.svg" },
  3: { id: 3, kind: "webm", url: "/fixture/loop.webm", posterUrl: "/owner/kitsune.svg" },
};

export function fixtureData(owner: boolean, doc: PageDoc, options: { editing?: boolean; min?: string } = {}): TipPageData {
  return {
    handle: "samplecreator",
    displayName: owner ? ownerBrand() : "Sample Creator",
    doc,
    assets: FIXTURE_ASSETS,
    storedAccent: null,
    pictureUrl: "/owner/kitsune.svg",
    bannerUrl: null,
    ytChannelName: "Sample Channel",
    ytChannelUrl: "https://www.youtube.com/@samplechannel",
    minTipPaise: Number.isInteger(Number(options.min)) && Number(options.min) >= 1 ? Number(options.min) * 100 : MIN_TIP_PAISE,
    messageMaxChars: 100,
    bio: "Streams games and chats with the crew most evenings.",
    alertMode: "split",
    sounds: [
      { id: 1, name: "Airhorn", emoji: "📣", minPaise: 2000, url: "/fixture/airhorn.mp3" },
      { id: 2, name: "Applause", emoji: "👏", minPaise: 5000, url: "/fixture/applause.mp3" },
      { id: 3, name: "Fanfare", emoji: "🎺", minPaise: 20000, url: "/fixture/fanfare.mp3" },
    ],
    rules: [
      { id: 1, minPaise: 10000, media: null, sound: { url: "/fixture/pick-one.mp3", name: "Pick one" }, staySeconds: null },
      { id: 2, minPaise: 50000, media: null, sound: { url: "/fixture/pick-two.mp3", name: "Pick two" }, staySeconds: 12 },
    ],
    voiceMinPaise: 5000,
    pinOffer: { minPaise: 20000, seconds: 30 },
    previewMode: false,
    editing: options.editing,
  };
}
