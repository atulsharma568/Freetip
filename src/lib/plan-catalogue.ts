import { FEATURES, type FeatureKey, type PlanFeatures } from "@/lib/plans";

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

export type CatalogueItem = { key: FeatureKey; title: string; benefit: string; on: boolean; href: string | null };
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
      })),
  })).filter((g) => g.items.length > 0);
}

// The keys a bought pass switches on: every built feature the page above offers, which leaves out
// pinned messages (the owner has not decided to offer them). One list, so what the page shows and
// what a pass grants cannot drift apart.
export const PASS_FEATURE_KEYS: readonly FeatureKey[] = (() => {
  const built = new Set<FeatureKey>(FEATURES.filter((f) => f.built).map((f) => f.key));
  return GROUPS.flatMap((g) => g.entries.map((e) => e.key)).filter((k) => built.has(k) && k !== "highlightedMessages");
})();
