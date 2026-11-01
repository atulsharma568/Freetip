import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SupporterOverlay } from "@/components/overlay/SupporterOverlay";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import { getOverlayAccent } from "@/lib/overlay-accent";

// The recent supporters OBS browser source: transparent, no site chrome, secret link. It draws
// nothing unless the owner has switched this feature on for the creator.
export const metadata: Metadata = {
  title: "Recent supporters",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function Page({ params }: Props) {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) notFound();
  const accent = await getOverlayAccent(token);

  return (
    <>
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div style={{ position: "fixed", inset: 0, "--ov-accent": accent } as React.CSSProperties}>
        <SupporterOverlay token={token} kind="recent" />
      </div>
    </>
  );
}
