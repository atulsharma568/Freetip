import { accentStyle, inkFor, safeAccent } from "../accent";
import type { PageDoc } from "./types";

// The page's colours: a document that names an accent wins (the owner's red); otherwise the
// colour the creator saved on the dashboard, as before. `style` re-points the page's two colour
// tokens on its wrapper (undefined for the site's own lime); `accent` is the same colour for the
// payment window.
export function themeFor(doc: PageDoc, storedAccent: string | null): { style: Record<string, string> | undefined; accent: string } {
  const accent = doc.theme.accent;
  if (accent) return { style: { "--color-accent": accent, "--color-ink": doc.theme.ink ?? inkFor(accent) }, accent };
  return { style: accentStyle(storedAccent), accent: safeAccent(storedAccent) };
}
