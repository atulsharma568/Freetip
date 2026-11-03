import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PressureBar } from "@/components/overlay/PressureBar";
import { overlayVars } from "@/components/overlay/vars";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import { getOverlayAccent } from "@/lib/overlay-accent";

// The Pressure meter OBS browser source: transparent, no site chrome, secret link.
export const metadata: Metadata = {
  title: "Pressure meter",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function PressureOverlayPage({ params }: Props) {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) notFound();
  const accent = await getOverlayAccent(token);

  return (
    <>
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div style={overlayVars(accent)}>
        <PressureBar token={token} />
      </div>
    </>
  );
}
