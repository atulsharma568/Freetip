import { FEATURES, type FeatureKey, type PlanFeatures } from "@/lib/plans";
import type { PlanKey } from "@/lib/pricing";

// What a creator sees on /dashboard/plans: the paid features in plain words, grouped by what
// they are for. The wording here is for creators; `plans.ts` keeps the owner's own notes.
// A feature appears only if it is built, and `highlightedMessages` only for a creator who
// already has it (the owner has not decided to offer it).

type Entry = { key: FeatureKey; title: string; benefit: string; href?: string };

const GROUPS: readonly { title: string; blurb: string; entries: readonly Entry[] }[] = [
  {
    title: "Make your alerts yours",
    blurb: "The alert on your stream, the way you want it.",
    entries: [
      { key: "alertText", title: "Your own words and colours", benefit: "Write the alert headline and pick the card, text and amount colours.", href: "/dashboard/text" },
      { key: "alertMotion", title: "Animations and timing", benefit: "Choose how the card comes in and leaves, how long it stays and the pause between alerts.", href: "/dashboard/motion" },
      { key: "overlayThemes", title: "Card styles and fonts", benefit: "Ready-made card looks and fonts for your OBS alert.", href: "/dashboard/style" },
      { key: "alertLayout", title: "Volume and layout", benefit: "Set the alert volume and put the picture beside the card.", href: "/dashboard/layout" },
      { key: "customAlertMedia", title: "Your own GIFs, pictures and clips", benefit: "Upload GIFs, pictures and short WebM clips that play with your alerts.", href: "/dashboard/media" },
      { key: "alertVariations", title: "Bigger tips, bigger alerts", benefit: "From a tip size up, the alert automatically plays your chosen media, sound and wording.", href: "/dashboard/variations" },
      { key: "regionalVoices", title: "Voices in more Indian languages", benefit: "Messages typed in Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati or Marathi are read aloud in that language." },
    ],
  },
  {
    title: "Your tip page",
    blurb: "What fans see when they open your link.",
    entries: [
      { key: "tipBanner", title: "Banner behind your photo", benefit: "Show your YouTube banner or your own picture or animated GIF at the top of your page.", href: "/dashboard/banner" },
      { key: "alertRules", title: "Tip page picks", benefit: "Fans tap one of your GIFs, with its sound, for a fixed amount and it plays on its own.", href: "/dashboard/rules" },
      { key: "pageBuilder", title: "A custom tip page", benefit: "Freetip designs and publishes a page made for you. Nothing changes until it is ready." },
      { key: "pressureMeter", title: "Pressure meter", benefit: "Your goal as a bar with rank words, on your tip page and as an OBS overlay. Comes with a custom tip page." },
    ],
  },
  {
    title: "Know your fans",
    blurb: "Fans who type a name are remembered by that name only.",
    entries: [
      { key: "fanLevels", title: "Fan levels", benefit: "Named fans earn points and a level that shows on the alert.", href: "/dashboard/fans" },
      { key: "fanCrm", title: "Fan list", benefit: "A private list of your named supporters with totals, notes and a CSV.", href: "/dashboard/fans" },
    ],
  },
  {
    title: "More on your stream",
    blurb: "Extra overlays and alerts for OBS.",
    entries: [
      { key: "supportStreak", title: "Support streak overlay", benefit: "A streak counter with a countdown that keeps going while tips keep arriving." },
      { key: "topSupporter", title: "Top supporter overlay", benefit: "Your biggest supporter of the last 30 days." },
      { key: "recentSupporters", title: "Recent supporters overlay", benefit: "Your last 10 supporters and their latest tip." },
      { key: "streamlabs", title: "Streamlabs alerts", benefit: "Each paid tip also shows in your own Streamlabs alert box.", href: "/dashboard/streamlabs" },
      { key: "highlightedMessages", title: "Pinned messages", benefit: "A fan's message pinned on stream for a set time, always approved by you first.", href: "/dashboard/pinned" },
    ],
  },
  {
    title: "Stream moments",
    blurb: "Save the best moments while you stream.",
    entries: [
      { key: "timestamps", title: "Stream timestamps", benefit: "Type !ts in your live chat to save a moment. One comment with every time is posted after the stream.", href: "/dashboard/timestamps" },
      { key: "tipMarks", title: "Moments from big tips and goals", benefit: "A moment is saved by itself when a big tip or a goal lands.", href: "/dashboard/timestamps" },
      { key: "highlightsPage", title: "Public highlights page", benefit: "A page of your stream's moments with a tip button.", href: "/dashboard/timestamps" },
      { key: "editorLink", title: "Link for your editor", benefit: "A private link for your video editor, with CSV and chapters.", href: "/dashboard/timestamps" },
      { key: "clipHelper", title: "OBS clip helper", benefit: "Saves and trims clips from your own recording and sends them to your Discord.", href: "/dashboard/timestamps" },
    ],
  },
];

// The two plans and the by-request offer. Each built feature sits in exactly one list; the plan
// cards and the comparison table read these. Starter's features are in Creator too, the Custom
// page is sold apart. Order matters: the cards show the first few of each list.
export type TierKey = "starter" | "creator" | "custom";

export const STARTER_KEYS: readonly FeatureKey[] = [
  "alertText", "alertMotion", "overlayThemes", "alertLayout",
  "supportStreak", "topSupporter", "recentSupporters", "timestamps", "tipMarks",
];
// Tip page picks sit here, not in Starter: a pick is a GIF with its sound, and GIFs need the
// custom alert media feature, which is Creator's.
export const CREATOR_EXTRA_KEYS: readonly FeatureKey[] = [
  "customAlertMedia", "alertRules", "regionalVoices", "alertVariations", "tipBanner", "fanLevels",
  "fanCrm", "highlightsPage", "editorLink", "clipHelper", "streamlabs",
];
export const CUSTOM_KEYS: readonly FeatureKey[] = ["pageBuilder", "pressureMeter"];

// Not finished enough to promise: the clip helper is run from source, Streamlabs lets in only
// accounts the Streamlabs app has whitelisted.
export const BETA_KEYS: ReadonlySet<FeatureKey> = new Set<FeatureKey>(["clipHelper", "streamlabs"]);

export function tierOf(key: FeatureKey): TierKey | null {
  if (STARTER_KEYS.includes(key)) return "starter";
  if (CREATOR_EXTRA_KEYS.includes(key)) return "creator";
  if (CUSTOM_KEYS.includes(key)) return "custom";
  return null;
}

const TITLES = new Map<FeatureKey, string>(GROUPS.flatMap((g) => g.entries.map((e) => [e.key, e.title] as const)));
export const featureTitle = (key: FeatureKey): string => TITLES.get(key) ?? key;

export type CatalogueItem = {
  key: FeatureKey;
  title: string;
  benefit: string;
  on: boolean;
  href: string | null;
  tier: TierKey | null;
  beta: boolean;
};
export type CatalogueGroup = { title: string; blurb: string; items: CatalogueItem[] };

export function buildCatalogue(features: PlanFeatures): CatalogueGroup[] {
  const built = new Set<FeatureKey>(FEATURES.filter((f) => f.built).map((f) => f.key));
  return GROUPS.map((g) => ({
    title: g.title,
    blurb: g.blurb,
    items: g.entries
      .filter((e) => built.has(e.key) && (e.key !== "highlightedMessages" || features[e.key]))
      .map((e) => ({
        key: e.key,
        title: e.title,
        benefit: e.benefit,
        on: features[e.key],
        // A link only for a feature that is on: a page that is off redirects.
        href: features[e.key] && e.href ? e.href : null,
        tier: tierOf(e.key),
        beta: BETA_KEYS.has(e.key),
      })),
  })).filter((g) => g.items.length > 0);
}

// The side-by-side table on /dashboard/plans. The groups are split by plan: the first three hold
// only Starter's features (Creator has them too), the rest hold only Creator's, so a group is either
// "in both" or "only in Creator" and the table never mixes the two. Each built feature appears once.
export type ComparisonGroup = { title: string; blurb: string; creatorOnly: boolean; keys: readonly FeatureKey[] };

export const COMPARISON_GROUPS: readonly ComparisonGroup[] = [
  {
    title: "Alert looks",
    blurb: "The alert on your stream, in your own style.",
    creatorOnly: false,
    keys: ["alertText", "alertMotion", "overlayThemes", "alertLayout"],
  },
  {
    title: "Stream overlays",
    blurb: "Extra boxes for OBS beside your alert.",
    creatorOnly: false,
    keys: ["supportStreak", "topSupporter", "recentSupporters"],
  },
  {
    title: "Stream moments",
    blurb: "Save the best moments while you stream.",
    creatorOnly: false,
    keys: ["timestamps", "tipMarks"],
  },
  {
    title: "Your own media",
    blurb: "Your pictures, GIFs and clips on the alert and on your page.",
    creatorOnly: true,
    keys: ["customAlertMedia", "alertVariations", "alertRules", "tipBanner"],
  },
  {
    title: "Your voice",
    blurb: "Messages read aloud in the fan's language.",
    creatorOnly: true,
    keys: ["regionalVoices"],
  },
  {
    title: "Your fans",
    blurb: "Know who supports you. Fans are remembered by the name they type, nothing else.",
    creatorOnly: true,
    keys: ["fanLevels", "fanCrm"],
  },
  {
    title: "Your workflow",
    blurb: "Tools for editing, sharing and your other apps.",
    creatorOnly: true,
    keys: ["highlightsPage", "editorLink", "clipHelper", "streamlabs"],
  },
];

export type ComparisonItem = CatalogueItem & { inStarter: boolean };
export type ComparisonGroupView = { title: string; blurb: string; creatorOnly: boolean; items: ComparisonItem[] };

const ENTRIES = new Map<FeatureKey, Entry>(GROUPS.flatMap((g) => g.entries.map((e) => [e.key, e] as const)));

export function buildComparison(features: PlanFeatures): {
  groups: ComparisonGroupView[];
  // Features this creator has on that no plan sells: the custom page, the meter and pinned messages
  // (ticked by hand). Shown apart so a creator never loses sight of something that is on for them.
  handPicked: CatalogueItem[];
} {
  const built = new Set<FeatureKey>(FEATURES.filter((f) => f.built).map((f) => f.key));
  const item = (e: Entry): CatalogueItem => ({
    key: e.key,
    title: e.title,
    benefit: e.benefit,
    on: features[e.key],
    // A link only for a feature that is on: a page that is off redirects.
    href: features[e.key] && e.href ? e.href : null,
    tier: tierOf(e.key),
    beta: BETA_KEYS.has(e.key),
  });
  const shown = new Set<FeatureKey>();
  const groups = COMPARISON_GROUPS.map((g) => ({
    title: g.title,
    blurb: g.blurb,
    creatorOnly: g.creatorOnly,
    items: g.keys.filter((k) => built.has(k) && ENTRIES.has(k)).map((k) => {
      shown.add(k);
      return { ...item(ENTRIES.get(k)!), inStarter: !g.creatorOnly };
    }),
  })).filter((g) => g.items.length > 0);
  const handPicked = [...ENTRIES.values()]
    .filter((e) => built.has(e.key) && !shown.has(e.key) && features[e.key])
    .map(item);
  return { groups, handPicked };
}

// The keys a bought plan switches on, from the same lists the plan cards read, so what the page
// shows and what a pass grants cannot drift apart. Creator includes everything in Starter. The Custom
// page's two features are never granted by a pass (the owner ticks them by hand for each creator),
// and neither are pinned messages (the owner has not decided to offer them).
const BUILT = new Set<FeatureKey>(FEATURES.filter((f) => f.built).map((f) => f.key));
const PLAN_KEYS_BY_PLAN: Record<PlanKey, readonly FeatureKey[]> = {
  starter: STARTER_KEYS.filter((k) => BUILT.has(k)),
  creator: [...STARTER_KEYS, ...CREATOR_EXTRA_KEYS].filter((k) => BUILT.has(k)),
};
export const planFeatureKeys = (plan: PlanKey): readonly FeatureKey[] => PLAN_KEYS_BY_PLAN[plan];
