import { isOwnerGoogleId } from "./owner-auth-core";
import { parseOwnerGoogleIds } from "./owner-auth-core";
import { ownerPageDoc } from "./page-doc/defaults";
import { ONE_PIECE_LADDER, ladderFraction, ladderLevel } from "./page-doc/ladder";
import type { Block } from "./page-doc/types";

// The site owner's own tip page gets its own header (OwnerHero). It is the page of an owner
// account (OWNER_GOOGLE_IDS) or of a handle listed in OWNER_TIP_HANDLES (default: acepressure),
// so it works whichever Google account the channel signs in with. Nobody else can switch it on.
export function isOwnerTipPage(
  handle: string,
  googleId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const handles = (env.OWNER_TIP_HANDLES ?? "acepressure")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (handles.includes(handle.toLowerCase())) return true;
  return isOwnerGoogleId(googleId, parseOwnerGoogleIds(env.OWNER_GOOGLE_IDS ?? env.OWNER_GOOGLE_ID));
}

// The name the owner's page shows: the brand, not the account's display name (which is a
// personal name). Set OWNER_TIP_BRAND to change it.
export function ownerBrand(env: NodeJS.ProcessEnv = process.env): string {
  return env.OWNER_TIP_BRAND?.trim() || "AcePressure";
}

// The values the owner's page uses now live in its document (`ownerPageDoc()` in
// src/lib/page-doc/defaults.ts). These names stay only until the tip page renders from that
// document, and are derived from it so there is one source of truth.
const ownerDoc = ownerPageDoc();
const ownerLinks = ownerDoc.blocks.find((b): b is Block<"creatorLinks"> => b.type === "creatorLinks")!.settings;
const ownerStrip = ownerDoc.blocks.find((b): b is Block<"strip"> => b.type === "strip")!.settings;

export const OWNER_ACCENT = ownerDoc.theme.accent as string;
export const OWNER_INK = ownerDoc.theme.ink as string;
export const ownerThemeStyle: Record<string, string> = { "--color-accent": OWNER_ACCENT, "--color-ink": OWNER_INK };

export const OWNER_COPY = {
  tagline: ownerLinks.tagline,
  instagram: ownerLinks.instagram,
  youtubeLabel: ownerStrip.left,
} as const;

export function pressureFraction(amountRupees: number, minRupees: number): number {
  return ladderFraction(amountRupees, minRupees, ONE_PIECE_LADDER.topRupees);
}

export function pressureLevel(fraction: number): string {
  return ladderLevel(fraction, ONE_PIECE_LADDER.levels);
}
