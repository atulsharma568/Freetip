import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const alt = `Stream highlights on ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

// A generic share image: the page's own title and moment count are in its text. Kept
// free of database reads so a link preview never fails on one.
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return renderOg({
    lines: [{ text: "Stream" }, { text: "highlights", accent: true }],
    pill: `${SITE_HOST}/${/^[a-z0-9_]{3,20}$/.test(handle) ? handle : "yourname"}`,
    note: "Jump to the best moments",
    fontSize: 128,
  });
}
