import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const alt = `Privacy: ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    lines: [{ text: "Privacy" }, { text: "policy", accent: true }],
    pill: `${SITE_HOST}/privacy`,
    note: "Tips for Indian YouTube streamers",
    fontSize: 110,
  });
}
