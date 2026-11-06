import { MIN_TIP_PAISE } from "@/lib/money";
import { ownerBrand } from "@/lib/owner-page";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import type { GoalProgress } from "@/lib/goal-progress";
import { meterReading, pickGoal } from "@/lib/page-doc/meter-reading";
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

// The made-up creator's goals for the editor preview: a weekly one 62% full and a daily one 25% full.
export const FIXTURE_GOALS: GoalProgress[] = [
  { id: 1, title: "New mic", repeat: "weekly", timezone: "Asia/Kolkata", carryOver: false, targetPaise: 100000, carryPaise: 0, effectiveTargetPaise: 100000, raisedPaise: 62000, since: "2026-11-02T00:00:00.000Z" },
  { id: 2, title: "Daily push", repeat: "daily", timezone: "Asia/Kolkata", carryOver: false, targetPaise: 50000, carryPaise: 0, effectiveTargetPaise: 50000, raisedPaise: 12500, since: "2026-11-05T00:00:00.000Z" },
];

// The made-up goal behind the fixture's Pressure meter: a weekly goal of ₹1,000, `percent` full.
function fixtureMeter(doc: PageDoc, percent: string | undefined, title: string | undefined): Pick<TipPageData, "meterOn" | "meter"> {
  const block = doc.blocks.find((b) => b.type === "pressureMeter");
  if (!block || block.type !== "pressureMeter" || !block.visible || block.settings.where === "obs") return { meterOn: false, meter: null };
  const pct = Math.min(500, Math.max(0, Math.round(Number(percent) || 0)));
  const goal = pickGoal(
    [
      {
        id: 1,
        title: (title ?? "").slice(0, 60) || "New mic",
        repeat: "weekly",
        timezone: "Asia/Kolkata",
        carryOver: false,
        targetPaise: 100000,
        carryPaise: 0,
        effectiveTargetPaise: 100000,
        raisedPaise: pct * 1000,
        since: "2026-11-02T00:00:00.000Z",
      },
    ],
    block.settings.goal,
  );
  return { meterOn: true, meter: goal ? meterReading(goal, block.settings) : null };
}

export function fixtureData(owner: boolean, doc: PageDoc, options: { editing?: boolean; min?: string; meter?: string; mtitle?: string } = {}): TipPageData {
  return {
    ...fixtureMeter(doc, options.meter, options.mtitle),
    handle: "samplecreator",
    displayName: owner ? ownerBrand() : "Sample Creator",
    signature: owner,
    doc,
    assets: FIXTURE_ASSETS,
    ...(options.editing ? { meterGoals: FIXTURE_GOALS } : {}),
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
