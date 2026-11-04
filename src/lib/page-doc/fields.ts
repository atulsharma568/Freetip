import { ASSET_LIMITS } from "./assets";
import { INSTAGRAM_PATTERN, LIMITS } from "./blocks";
import { BANNER_FX_OPTIONS, FRAME_OPTIONS } from "./decor";
import type { BlockType, SettingsByType } from "./types";

// What the owner may change in each block, as data, so the settings panel is drawn from this table
// and the limits are the parser's own. `standard` is the wording the page shows when the field is
// empty (shown as the hint in the editor). Anything not listed here is not editable: the header's
// content is the creator's own account, and the words that matter to a payment are locked in code.
// The rank ladder and the page colours have their own editors.

export interface TextField {
  key: string;
  label: string;
  max: number;
  // The wording used when the field is empty.
  standard: string;
  // Only these characters may be typed (the Instagram handle).
  pattern?: RegExp;
  // Shown before the input, as part of what the owner is typing (the @ of a handle).
  prefix?: string;
  // The field applies only while this holds for the block's settings.
  when?: (settings: Record<string, unknown>) => boolean;
}

export interface ChoiceField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

// A whole number picked on a slider.
export interface RangeField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  // Only while this holds for the block's settings.
  when?: (settings: Record<string, unknown>) => boolean;
}

export const RANGE_FIELDS: { [K in BlockType]: RangeField[] } = {
  backdrop: [
    {
      key: "dim",
      label: "Darken the picture",
      min: ASSET_LIMITS.dim.min,
      max: ASSET_LIMITS.dim.max,
      step: ASSET_LIMITS.dim.step,
      unit: "%",
      when: (s) => s.style === "media",
    },
  ],
  header: [],
  creatorLinks: [],
  alertPreview: [],
  qr: [],
  amount: [],
  note: [],
  send: [],
  strip: [],
  successScreen: [],
  pressureMeter: [],
};

export const TEXT_FIELDS: { [K in BlockType]: TextField[] } = {
  backdrop: [],
  header: [],
  creatorLinks: [
    { key: "tagline", label: "Line of words", max: LIMITS.tagline, standard: "" },
    { key: "instagram", label: "Instagram handle", max: LIMITS.instagram, standard: "", prefix: "@", pattern: INSTAGRAM_PATTERN },
  ],
  alertPreview: [{ key: "label", label: "Label above the preview", max: LIMITS.previewLabel, standard: "Preview on stream" }],
  qr: [],
  amount: [
    { key: "heading", label: "Heading", max: LIMITS.heading, standard: "Amount" },
    { key: "barLabel", label: "Bar label", max: LIMITS.barLabel, standard: "Pressure" },
  ],
  note: [
    { key: "heading", label: "Heading", max: LIMITS.heading, standard: "Your note" },
    { key: "namePlaceholder", label: "Hint in the name box", max: LIMITS.namePlaceholder, standard: "Riya, Kabir…" },
    { key: "messagePlaceholder", label: "Hint in the message box", max: LIMITS.messagePlaceholder, standard: "Great stream today!" },
  ],
  send: [
    { key: "heading", label: "Heading", max: LIMITS.heading, standard: "Send" },
    { key: "buttonLabel", label: "Word on the Tip button", max: LIMITS.buttonLabel, standard: "Tip" },
  ],
  strip: [
    { key: "left", label: "Left text", max: LIMITS.strip, standard: "" },
    { key: "right", label: "Right text", max: LIMITS.strip, standard: "" },
  ],
  successScreen: [
    // The normal thank-you screen has no small line; only the sign-off style does.
    { key: "line", label: "Small line at the bottom", max: LIMITS.successLine, standard: "Thanks for hanging out.", when: (s) => s.style === "owner" },
  ],
  pressureMeter: [{ key: "heading", label: "Heading", max: LIMITS.meterHeading, standard: "Pressure" }],
};

export const CHOICE_FIELDS: { [K in BlockType]: ChoiceField[] } = {
  backdrop: [
    {
      key: "style",
      label: "Backdrop",
      options: [
        { value: "ember", label: "Smoke, slashes and embers" },
        { value: "media", label: "A picture, GIF or video" },
      ],
    },
  ],
  header: [
    { key: "frame", label: "Frame over the photo", options: FRAME_OPTIONS },
    { key: "bannerFx", label: "Effect over the banner", options: BANNER_FX_OPTIONS },
  ],
  creatorLinks: [],
  alertPreview: [],
  qr: [],
  amount: [],
  note: [],
  send: [],
  strip: [],
  successScreen: [
    {
      key: "style",
      label: "Thank-you screen",
      options: [
        { value: "default", label: "Normal" },
        { value: "owner", label: "Sign-off (GG, see you soon)" },
      ],
    },
  ],
  pressureMeter: [
    {
      key: "show",
      label: "Numbers",
      options: [
        { value: "rupees", label: "Rupees raised and the goal" },
        { value: "percent", label: "Only a percent" },
      ],
    },
    {
      key: "where",
      label: "Shown",
      options: [
        { value: "both", label: "On the tip page and in OBS" },
        { value: "page", label: "On the tip page only" },
        { value: "obs", label: "In OBS only" },
      ],
    },
  ],
};

// The text fields that apply to a block as it is now.
export function textFieldsFor<T extends BlockType>(type: T, settings: SettingsByType[T]): TextField[] {
  return TEXT_FIELDS[type].filter((f) => !f.when || f.when(settings as Record<string, unknown>));
}

export function findTextField(type: BlockType, key: string): TextField | undefined {
  return TEXT_FIELDS[type].find((f) => f.key === key);
}

export function rangeFieldsFor<T extends BlockType>(type: T, settings: SettingsByType[T]): RangeField[] {
  return RANGE_FIELDS[type].filter((f) => !f.when || f.when(settings as Record<string, unknown>));
}

export function findRangeField(type: BlockType, key: string): RangeField | undefined {
  return RANGE_FIELDS[type].find((f) => f.key === key);
}

export function findChoiceField(type: BlockType, key: string): ChoiceField | undefined {
  return CHOICE_FIELDS[type].find((f) => f.key === key);
}
