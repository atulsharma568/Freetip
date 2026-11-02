import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import { getTtsFloorPaise } from "@/lib/site-settings";
import { PageHeader } from "../_components/PageHeader";
import { TtsFloorForm } from "./TtsFloorForm";

export const dynamic = "force-dynamic";

// Settings that apply to the whole site, not to one creator.
export default async function AdminSettingsPage() {
  await requireOwner();
  const floor = await getTtsFloorPaise(getDb());
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Site settings"
        note="Rules for everyone. A creator can set a higher amount of their own, never a lower one."
      />
      <section className="space-y-3" aria-labelledby="voice-heading">
        <h2 id="voice-heading" className="text-base font-semibold text-text">
          Voice (text-to-speech) minimum
        </h2>
        <p className="max-w-prose text-sm text-muted">
          A tip below this amount is never read aloud, whatever the creator chose, and the tip page does not offer the voice
          for it. It starts at ₹50. Use 0 for no site-wide minimum.
        </p>
        <TtsFloorForm rupees={Math.round(floor / 100)} />
      </section>
    </div>
  );
}
