// The one place the operator pages define their status colours. Operators get a
// status hue (good, warn, bad) so a queue can be scanned; everything else stays on
// the site's tonal steps. A bad or warn state is never carried by colour alone: it
// always has a mark and the word next to it (see StatusBadge, ActionStatus).

export type Tone = "good" | "warn" | "bad" | "neutral";

export const TONE_BADGE: Record<Tone, string> = {
  good: "bg-accent/15 text-accent",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  neutral: "bg-raised text-muted",
};

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-accent",
  warn: "text-warn",
  bad: "text-bad",
  neutral: "text-muted",
};

export const TONE_BORDER: Record<Tone, string> = {
  good: "border-accent/40",
  warn: "border-warn/40",
  bad: "border-bad/50",
  neutral: "border-control",
};

// A short mark that says the same thing as the colour.
export const TONE_MARK: Record<Tone, string> = {
  good: "✓",
  warn: "●",
  bad: "▲",
  neutral: "",
};

const STATUS_TONE: Record<string, Tone> = {
  // money
  captured: "good",
  completed: "good",
  matched: "good",
  processed: "good",
  won: "good",
  failed: "bad",
  lost: "bad",
  exception: "bad",
  disputed: "bad",
  open: "warn",
  unmatched: "warn",
  partial: "warn",
  pending: "warn",
  processing: "warn",
  in_transit: "warn",
  refunded: "neutral",
  cancelled: "neutral",
  closed: "neutral",
  // creators, requests, messages
  active: "good",
  approved: "good",
  suspended: "bad",
  rejected: "bad",
  submitted: "warn",
  new: "warn",
  not_started: "neutral",
  handled: "neutral",
};

export function toneOf(status: string): Tone {
  return STATUS_TONE[status] ?? "neutral";
}

// The pill actions. Primary is the site's lime pill; danger is an outline in the
// bad hue; quiet is the neutral outline.
export type ButtonTone = "primary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md";

const BUTTON_TONE: Record<ButtonTone, string> = {
  primary: "bg-accent text-ink hover:bg-accent/90",
  quiet: "border border-control text-muted hover:border-text/40 hover:text-text",
  danger: "border border-bad/50 text-bad hover:bg-bad/10",
};
const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-5 text-sm",
};

export function buttonClass(tone: ButtonTone = "quiet", size: ButtonSize = "sm"): string {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_TONE[tone]} ${BUTTON_SIZE[size]}`;
}

export const FIELD_CLASS =
  "min-h-10 rounded-field border border-control bg-ground px-3 text-sm text-text placeholder:text-muted";
