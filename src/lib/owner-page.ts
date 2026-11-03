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
