import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertStage } from "@/components/overlay/AlertStage";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";

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

  return (
    <>
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div style={{ position: "fixed", inset: 0 }}>
        <AlertStage token={token} />
      </div>
    </>
  );
}
