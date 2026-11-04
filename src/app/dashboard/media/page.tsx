import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { MAX_MEDIA_BYTES_PER_CREATOR, MAX_MEDIA_PER_CREATOR, type MediaKind, type MediaPlacement, type ReviewState } from "@/lib/media";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { MediaManager, type MediaRow } from "./MediaManager";

export const metadata: Metadata = {
  title: `Alert media: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<
    { id: number; handle: string | null; creator_status: string; paid_features: string[] | null }[]
  >`
    select id, handle, creator_status, paid_features from users where google_id = ${googleId}
  `;
  // Files belong to a tip page, so there is nothing to manage until there is a link.
  if (!user?.handle) redirect("/dashboard");
  // Switched off: the page is for nothing but deleting stored files, so it opens only when
  // there are some (a creator can always remove what we hold, whatever the switch says).
  const switchedOff = !hasFeature(user, "customAlertMedia");

  const rows = await db<
    {
      id: string;
      kind: MediaKind;
      name: string;
      blob_url: string;
      size_bytes: number;
      duration_ms: number | null;
      placement: MediaPlacement;
      enabled: boolean;
      review_state: ReviewState;
    }[]
  >`
    select id::text, kind, name, blob_url, size_bytes, duration_ms, placement, enabled, review_state
    from creator_media
    where creator_id = ${user.id}
    order by created_at, id
  `;

  if (switchedOff && rows.length === 0) redirect("/dashboard");

  const files: MediaRow[] = rows.map((r) => ({
    // bigint columns come back as strings; the actions need real numbers.
    id: Number(r.id),
    kind: r.kind,
    name: r.name,
    url: r.blob_url,
    sizeBytes: r.size_bytes,
    durationMs: r.duration_ms,
    placement: r.placement,
    enabled: r.enabled,
    state: r.review_state,
  }));
  const counted = rows.filter((r) => r.review_state !== "removed");
  const usedBytes = counted.reduce((sum, r) => sum + r.size_bytes, 0);

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="media" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Alert media</h1>
          <p className="text-pretty text-base text-muted">
            {switchedOff
              ? "Alert media is switched off for your account, so none of these files play. They are still stored until you delete them below."
              : "Upload a GIF, picture or short WebM clip to play with your OBS alert. Choose where it shows: above the card, behind its text or across the whole screen. With several files switched on, they take turns. Files never play sound, so a tip's own sound or voice stays clear."}
          </p>
        </div>

        <MediaManager
          creatorId={user.id}
          files={files}
          usedBytes={usedBytes}
          maxBytes={MAX_MEDIA_BYTES_PER_CREATOR}
          maxFiles={MAX_MEDIA_PER_CREATOR}
          fileCount={counted.length}
          uploadsReady={!!process.env.BLOB_READ_WRITE_TOKEN}
          readOnly={switchedOff}
        />
      </div>
    </DashboardShell>
  );
}
