import { inkFor } from "@/lib/accent";

// The parent style for an overlay page (a server component, so this file is not a
// client module): the creator's accent and the ink that stays readable on it.
export function overlayVars(accent: string): React.CSSProperties {
  return { position: "fixed", inset: 0, "--ov-accent": accent, "--ov-ink": inkFor(accent) } as React.CSSProperties;
}
