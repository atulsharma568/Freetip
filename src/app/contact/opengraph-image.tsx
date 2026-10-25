import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const alt = `Contact: ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    lines: [{ text: "Contact" }, { text: "and grievances", accent: true }],
    pill: `${SITE_HOST}/contact`,
    note: "Tips for Indian YouTube streamers",
    fontSize: 110,
  });
}
