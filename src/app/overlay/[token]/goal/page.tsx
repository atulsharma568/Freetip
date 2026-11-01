import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GoalBar } from "@/components/overlay/GoalBar";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import { getOverlayAccent } from "@/lib/overlay-accent";

// The goal bar OBS browser source: transparent, no site chrome, secret link.
export const metadata: Metadata = {
  title: "Goal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function GoalOverlayPage({ params }: Props) {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) notFound();
  const accent = await getOverlayAccent(token);

  return (
    <>
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div style={{ position: "fixed", inset: 0, "--ov-accent": accent } as React.CSSProperties}>
        <GoalBar token={token} />
      </div>
    </>
  );
}
