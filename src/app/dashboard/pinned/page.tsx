import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import type { Query } from "@/lib/accrual";
import { PIN_SECONDS_DEFAULT, pinOffer } from "@/lib/pinned";
import { loadPinnedPanel, type PinnedTipView } from "@/lib/pinned-db";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { PinnedManager } from "./PinnedManager";

export const metadata: Metadata = {
  title: `Pinned messages: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function PinnedPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{ id: number; handle: string | null; creator_status: string; paid_features: string[] | null }[]>`
    select id, handle, creator_status, paid_features from users where google_id = ${googleId}
  `;
  if (!user?.handle || !hasFeature(user, "highlightedMessages")) redirect("/dashboard");

  // The settings and the list come from migration 0040; before it is run the page still
  // opens, empty, and saving says so.
  let minRupees = "";
  let seconds = PIN_SECONDS_DEFAULT;
  let items: PinnedTipView[] = [];
  try {
    const [saved] = await db<{ highlight_min_paise: number | null; highlight_seconds: number | null }[]>`
      select highlight_min_paise, highlight_seconds from users where id = ${user.id}
    `;
    const offer = pinOffer(saved);
    minRupees = offer ? String(offer.minPaise / 100) : "";
    seconds = offer?.seconds ?? saved?.highlight_seconds ?? PIN_SECONDS_DEFAULT;
    items = await loadPinnedPanel(db as unknown as Query, user.id);
  } catch (err) {
    console.error("Pinned page: could not read the settings (migration 0040 run?).", err);
  }

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="pinned" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Pinned messages</h1>
          <p className="text-pretty text-base text-muted">
            A fan who tips at least your minimum can ask for their message to be pinned on your stream. You always
            approve it first (in Messages to approve on the overview), and you can take it down at any time. The tip
            stays final either way, and the fan pays exactly the tip, with no extra fee.
          </p>
        </div>

        <PinnedManager savedRupees={minRupees} savedSeconds={seconds} items={items.map((i) => ({ ...i, capturedAt: i.capturedAt.toISOString() }))} />
      </div>
    </DashboardShell>
  );
}
