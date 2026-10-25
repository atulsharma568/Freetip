import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

// The link preview shown when the site is shared. Built once at build time.
export const alt = `${SITE_NAME}: Your link. Their UPI. Your bank.`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    lines: [{ text: "Your link." }, { text: "Their UPI.", accent: true }, { text: "Your bank." }],
    pill: `${SITE_HOST}/yourname`,
    note: "Tips for Indian YouTube streamers",
  });
}
