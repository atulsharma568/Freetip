import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";
import { safeAccent } from "@/lib/accent";
import { getCreator, getCreatorAccent } from "./creator";

export const alt = `Tip a creator on ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

// The preview for a creator's tip link. Only active creators get their name on
// it; anyone else gets the generic site image text.
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // A database error must not break the preview; fall back to the generic one.
  const creator = HANDLE_PATTERN.test(handle)
    ? await getCreator(handle).catch(() => null)
    : null;
  if (!creator || creator.creator_status !== "active") {
    return renderOg({
      lines: [{ text: "Your link." }, { text: "Their UPI.", accent: true }, { text: "Your bank." }],
      pill: `${SITE_HOST}/yourname`,
      note: "Tips for Indian YouTube streamers",
    });
  }

  const name = (creator.display_name ?? creator.name ?? handle).slice(0, 40);
  const accent = safeAccent(await getCreatorAccent(handle));
  return renderOg({
    accent,
    lines: [{ text: "Tip" }, { text: name, accent: true }],
    pill: `${SITE_HOST}/${handle}`,
    note: "UPI or card · no account needed",
    fontSize: name.length > 18 ? 84 : 128,
  });
}
