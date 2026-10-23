import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { OverlayPreview } from "@/components/overlay/OverlayPreview";

export const metadata: Metadata = {
  title: "Alert preview",
  robots: { index: false },
};

export default function OverlayPreviewPage() {
  return (
    <PageShell>
      <OverlayPreview />
    </PageShell>
  );
}
