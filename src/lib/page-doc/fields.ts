import { INSTAGRAM_PATTERN, LIMITS } from "./blocks";
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
};

export const CHOICE_FIELDS: { [K in BlockType]: ChoiceField[] } = {
  backdrop: [],
  header: [],
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
};

// The text fields that apply to a block as it is now.
export function textFieldsFor<T extends BlockType>(type: T, settings: SettingsByType[T]): TextField[] {
  return TEXT_FIELDS[type].filter((f) => !f.when || f.when(settings as Record<string, unknown>));
}

export function findTextField(type: BlockType, key: string): TextField | undefined {
  return TEXT_FIELDS[type].find((f) => f.key === key);
}

export function findChoiceField(type: BlockType, key: string): ChoiceField | undefined {
  return CHOICE_FIELDS[type].find((f) => f.key === key);
}
