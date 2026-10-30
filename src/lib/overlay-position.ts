// Where the alert card sits on the OBS screen: a 3 x 3 grid, vertical first.
export const OVERLAY_POSITIONS = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
] as const;

export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export const DEFAULT_OVERLAY_POSITION: OverlayPosition = "bottom-center";

export function parseOverlayPosition(raw: unknown): OverlayPosition | null {
  return (OVERLAY_POSITIONS as readonly string[]).includes(raw as string) ? (raw as OverlayPosition) : null;
}
