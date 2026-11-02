// Which paid features a creator has. The owner decides per creator: in
// /admin/creators/<id> they tick the features that creator is paying for, and the
// keys are stored in `users.paid_features` (migration 0035). Nothing is on by default.
// No plan name or price is shown anywhere on the site; a creator whose feature is off
// simply does not see it.
//
// Every gated feature asks `planFeatures(row)`, so this file is the one place that
// knows what a feature is called and whether it exists yet.

export type FeatureKey =
  // Stream timestamps (the base switch) and what builds on it.
  | "timestamps"
  | "tipMarks"
  | "highlightsPage"
  | "editorLink"
  | "clipHelper"
  // Extra OBS overlays.
  | "supportStreak"
  | "topSupporter"
  | "recentSupporters"
  // Planned, not built yet (see docs/custom-alertbox-overview.md and docs/competitor-findings.md).
  | "customAlertMedia"
  | "alertRules"
  | "regionalVoices"
  | "voiceNotes"
  | "overlayThemes"
  | "birthdayMessage"
  | "fanLevels"
  | "fanCrm"
  | "highlightedMessages"
  | "streamlabs"
  // Streamlabs-style alert settings (docs/alert-studio-plan.md).
  | "alertText"
  | "alertMotion";

export type FeatureInfo = {
  key: FeatureKey;
  label: string;
  group: "Stream timestamps" | "OBS overlays" | "Alert box" | "Fans" | "Planned, not built yet";
  description: string;
  // false: listed in the admin page but cannot be switched on, because nothing exists yet.
  built: boolean;
  // Other switches this one only works with (it is off while any of them is off).
  needs?: readonly FeatureKey[];
};

export const FEATURES: readonly FeatureInfo[] = [
  {
    key: "timestamps",
    label: "Stream timestamps",
    group: "Stream timestamps",
    description: "!ts in YouTube live chat saves a moment; one comment with all the times is posted after the stream; optional Discord link.",
    built: true,
  },
  {
    key: "tipMarks",
    label: "Moments from big tips and goals",
    group: "Stream timestamps",
    description: "A moment is added automatically when a big tip or a goal lands.",
    built: true,
    needs: ["timestamps"],
  },
  {
    key: "highlightsPage",
    label: "Public highlights page",
    group: "Stream timestamps",
    description: "A public page of the stream's moments with a tip button.",
    built: true,
    needs: ["timestamps"],
  },
  {
    key: "editorLink",
    label: "Editor link, CSV and chapters",
    group: "Stream timestamps",
    description: "A private link for an editor, plus CSV and copy-as-chapters.",
    built: true,
    needs: ["timestamps"],
  },
  {
    key: "clipHelper",
    label: "OBS clip helper",
    group: "Stream timestamps",
    description: "Saves and trims real clips from the creator's own OBS recording and uploads them to their Discord.",
    built: true,
    needs: ["timestamps"],
  },
  {
    key: "supportStreak",
    label: "Support streak overlay",
    group: "OBS overlays",
    description: "A streak counter with a countdown that keeps going while tips keep arriving (OBS link: alert link + /streak).",
    built: true,
  },
  {
    key: "topSupporter",
    label: "Top supporter overlay",
    group: "OBS overlays",
    description: "The biggest supporter of the last 30 days (OBS link: alert link + /top).",
    built: true,
  },
  {
    key: "recentSupporters",
    label: "Recent supporters overlay",
    group: "OBS overlays",
    description: "The last 10 supporters and their latest tip (OBS link: alert link + /recent).",
    built: true,
  },
  {
    key: "customAlertMedia",
    label: "Custom alert media",
    group: "Alert box",
    description: "Upload GIFs, WebM videos and images that play in the OBS alert. Uploads go live at once; the owner can take any down (/admin/media).",
    built: true,
  },
  {
    key: "alertRules",
    label: "Alert rules by tip size",
    group: "Alert box",
    description: "Pick which media or sound plays depending on how big the tip is (/dashboard/rules). Media rules also need Custom alert media.",
    built: true,
  },
  {
    key: "regionalVoices",
    label: "Regional language voices",
    group: "Alert box",
    description: "The creator picks one of Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati or Marathi; messages typed in that script are read in it (other languages, not accents of Hindi). Needs Azure; Roman-letter messages stay with the English voice.",
    built: true,
  },
  {
    key: "voiceNotes",
    label: "Fan voice notes",
    group: "Planned, not built yet",
    description: "Fans send a short recorded voice clip as the tip, priced by length. Needs storage and moderation.",
    built: false,
  },
  {
    key: "overlayThemes",
    label: "Overlay themes and fonts",
    group: "Alert box",
    description: "Pick a ready-made card style and a font for the OBS alert (/dashboard/style).",
    built: true,
  },
  {
    key: "birthdayMessage",
    label: "Birthday message",
    group: "Fans",
    description: "A greeting on the alert when a fan who typed their birthday (day and month) tips on that day (/dashboard/fans).",
    built: true,
  },
  {
    key: "fanLevels",
    label: "Fan levels (XP)",
    group: "Fans",
    description: "Fans who type a name earn 1 point per ₹1 and a level shown on the alert. Starts counting from the day it is switched on; keeps a name-only fan profile for 12 months.",
    built: true,
  },
  {
    key: "fanCrm",
    label: "Fan list (CRM)",
    group: "Fans",
    description: "A private list of the creator's named supporters with totals, a note, CSV and delete (/dashboard/fans). Keeps a name-only fan profile for 12 months.",
    built: true,
  },
  {
    key: "highlightedMessages",
    label: "Paid highlighted messages",
    group: "Alert box",
    description: "A fan who tips the creator's minimum can have their message pinned on stream for a set time (/dashboard/pinned, OBS link: alert link + /pinned). Always creator-approved first, even in instant mode, and the creator can take it down any time; the tip stays final. Never shown on the public site.",
    built: true,
  },
  {
    key: "streamlabs",
    label: "Streamlabs alerts",
    group: "Alert box",
    description: "The creator connects their own Streamlabs account (/dashboard/streamlabs) and each paid tip also shows as an alert in their Streamlabs alert box: name, amount and, by the same rules as the OBS alert, the message. Needs STREAMLABS_CLIENT_ID and STREAMLABS_CLIENT_SECRET; the Streamlabs app is in testing mode, so only accounts whitelisted on it can connect.",
    built: true,
  },
  {
    key: "alertText",
    label: "Alert text and colours",
    group: "Alert box",
    description: "The creator edits the card's headline ({name} tipped {amount}) and picks the card, text and amount colours, text size and weight (/dashboard/text). Colours that are hard to read are refused. Works with the card style, shown on every alert.",
    built: true,
  },
  {
    key: "alertMotion",
    label: "Alert animations and timing",
    group: "Alert box",
    description: "The creator picks how the card comes in and leaves (wipe, fade, slide, zoom, bounce), how long it stays (5 to 30 seconds, never shorter than the voice, sound or video needs) and a pause between alerts (/dashboard/motion). Reduced motion always gets a plain fade.",
    built: true,
  },
];

export type PlanFeatures = Record<FeatureKey, boolean>;

const BUILT_KEYS = new Set<string>(FEATURES.filter((f) => f.built).map((f) => f.key));

// Only built features can be stored; anything else is dropped (a typo, a stale form).
export function sanitizeFeatureKeys(keys: readonly string[]): FeatureKey[] {
  return FEATURES.filter((f) => f.built && keys.includes(f.key)).map((f) => f.key);
}

export function builtFeatureKeys(): FeatureKey[] {
  return FEATURES.filter((f) => f.built).map((f) => f.key);
}

export type FeatureSource = { paid_features?: readonly string[] | null } | null | undefined;

export function planFeatures(source: FeatureSource): PlanFeatures {
  const granted = new Set<string>((source?.paid_features ?? []).filter((k) => BUILT_KEYS.has(k)));
  const out = {} as PlanFeatures;
  for (const f of FEATURES) {
    out[f.key] = granted.has(f.key);
  }
  // A feature that needs another is off while that one is off (the timestamp extras
  // with the base switch). Resolved to a fixed point so a chain of needs also holds.
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of FEATURES) {
      if (out[f.key] && f.needs?.some((k) => !out[k])) {
        out[f.key] = false;
        changed = true;
      }
    }
  }
  return out;
}

export const NO_FEATURES: PlanFeatures = planFeatures(null);

// The server-side gate for a paid feature. Call it where the feature is used (an
// action, an upload route, createTipOrder, an overlay route), never only in the UI:
// a hidden button is not a lock. `row` is anything with the creator's `paid_features`.
// Returns true when the feature (and everything it needs) is on.
export function hasFeature(row: FeatureSource, key: FeatureKey): boolean {
  return planFeatures(row)[key];
}

// Throws when the feature is off, for actions and routes that want to stop there.
export class FeatureOffError extends Error {
  constructor(public readonly key: FeatureKey) {
    super(`The ${key} feature is not switched on for this creator.`);
    this.name = "FeatureOffError";
  }
}

export function requireFeature(row: FeatureSource, key: FeatureKey): void {
  if (!hasFeature(row, key)) throw new FeatureOffError(key);
}
