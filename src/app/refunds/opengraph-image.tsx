import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const alt = `Refunds: ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    lines: [{ text: "Refunds and" }, { text: "cancellations", accent: true }],
    pill: `${SITE_HOST}/refunds`,
    note: "Tips for Indian YouTube streamers",
    fontSize: 110,
  });
}
