import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertStage } from "@/components/overlay/AlertStage";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { overlayVars } from "@/components/overlay/vars";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import { getOverlayAccent } from "@/lib/overlay-accent";

// The OBS browser source. No site chrome, transparent background. The link is
// a secret, so keep it out of search results and out of Referer headers.
export const metadata: Metadata = {
  title: "Alerts",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function OverlayPage({ params }: Props) {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) notFound();
  const accent = await getOverlayAccent(token);

  return (
    <>
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div className={OVERLAY_FONT_CLASSES} style={overlayVars(accent)}>
        <AlertStage token={token} />
      </div>
    </>
  );
}
