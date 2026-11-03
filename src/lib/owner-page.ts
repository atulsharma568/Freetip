import { isOwnerGoogleId } from "./owner-auth-core";
import { parseOwnerGoogleIds } from "./owner-auth-core";

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

// The owner's page is crimson, the channel's colour (the banner's red is darker, too dim for
// text on black; this one is bright enough for both). It does not depend on the saved accent.
export const OWNER_ACCENT = "#ec3d4e";

// Words only the owner's page uses.
export const OWNER_COPY = {
  tagline: "Valorant / Live & Highlights",
  instagram: "acepressure.gg",
  youtubeLabel: "YouTube / AcePressure",
} as const;

const PRESSURE_TOP_RUPEES = 5000;

// Where an amount sits on the pressure bar: a log scale, so ₹20 and ₹5,000 both fit.
export function pressureFraction(amountRupees: number, minRupees: number): number {
  const low = Math.max(1, minRupees);
  if (!(amountRupees > low)) return 0;
  return Math.min(1, Math.log(amountRupees / low) / Math.log(PRESSURE_TOP_RUPEES / low));
}

// The word under the bar: a bounty ladder from One Piece, from a rookie up to the Pirate King.
const PRESSURE_LEVELS = [
  { upTo: 0.25, name: "Rookie" },
  { upTo: 0.5, name: "Supernova" },
  { upTo: 0.75, name: "Warlord" },
  { upTo: 0.95, name: "Yonko" },
  { upTo: 1.01, name: "Pirate King" },
] as const;

export function pressureLevel(fraction: number): string {
  return PRESSURE_LEVELS.find((l) => fraction < l.upTo)?.name ?? "Pirate King";
}
