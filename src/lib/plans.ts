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
  | "highlightedMessages";

export type FeatureInfo = {
  key: FeatureKey;
  label: string;
  group: "Stream timestamps" | "OBS overlays" | "Planned, not built yet";
  description: string;
  // false: listed in the admin page but cannot be switched on, because nothing exists yet.
  built: boolean;
  // Needs the base timestamps switch too.
  needsTimestamps?: boolean;
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
    needsTimestamps: true,
  },
  {
    key: "highlightsPage",
    label: "Public highlights page",
    group: "Stream timestamps",
    description: "A public page of the stream's moments with a tip button.",
    built: true,
    needsTimestamps: true,
  },
  {
    key: "editorLink",
    label: "Editor link, CSV and chapters",
    group: "Stream timestamps",
    description: "A private link for an editor, plus CSV and copy-as-chapters.",
    built: true,
    needsTimestamps: true,
  },
  {
    key: "clipHelper",
    label: "OBS clip helper",
    group: "Stream timestamps",
    description: "Saves and trims real clips from the creator's own OBS recording and uploads them to their Discord.",
    built: true,
    needsTimestamps: true,
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
    group: "Planned, not built yet",
    description: "Upload GIFs, WebM videos and images that play in the OBS alert. Costs storage and needs moderation.",
    built: false,
  },
  {
    key: "alertRules",
    label: "Alert rules by tip size",
    group: "Planned, not built yet",
    description: "Pick which media or sound plays depending on how big the tip is.",
    built: false,
  },
  {
    key: "regionalVoices",
    label: "Regional language voices",
    group: "Planned, not built yet",
    description: "Voices for more Indian languages (other languages, not accents of Hindi).",
    built: false,
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
    group: "Planned, not built yet",
    description: "Ready-made alert styles, fonts and GIF placement.",
    built: false,
  },
  {
    key: "birthdayMessage",
    label: "Birthday message",
    group: "Planned, not built yet",
    description: "A creator-set message for a fan's birthday.",
    built: false,
  },
  {
    key: "fanLevels",
    label: "Fan levels (XP)",
    group: "Planned, not built yet",
    description: "Levels that fans earn by tipping.",
    built: false,
  },
  {
    key: "fanCrm",
    label: "Fan list (CRM)",
    group: "Planned, not built yet",
    description: "A list of a creator's supporters with their totals.",
    built: false,
  },
  {
    key: "highlightedMessages",
    label: "Paid highlighted messages",
    group: "Planned, not built yet",
    description: "A fan pays extra to pin their message. Undecided, and must not appear on the site until the owner decides.",
    built: false,
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
  // The timestamp extras are part of the same product: off with the base switch.
  if (!out.timestamps) {
    for (const f of FEATURES) if (f.needsTimestamps) out[f.key] = false;
  }
  return out;
}

export const NO_FEATURES: PlanFeatures = planFeatures(null);
