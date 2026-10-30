import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { PageShell } from "@/components/PageShell";
import { SITE_NAME } from "@/lib/site";
import {
  MAX_SOUNDS_PER_CREATOR,
  MAX_SOUND_BYTES_PER_CREATOR,
} from "@/lib/sounds";
import { DashboardNav } from "../DashboardNav";
import { SoundsManager, type SoundRow } from "./SoundsManager";

export const metadata: Metadata = {
  title: `Sounds: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function SoundsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{ id: number; handle: string | null; default_sound_id: number | null }[]>`
    select id, handle, default_sound_id from users where google_id = ${googleId}
  `;
  // Sounds belong to a tip page, so there is nothing to manage until there is a link.
  if (!user?.handle) redirect("/dashboard");

  const rows = await db<
    {
      id: number;
      name: string;
      emoji: string | null;
      min_paise: number;
      volume: number;
      enabled: boolean;
      blob_url: string;
      duration_ms: number;
      size_bytes: number;
    }[]
  >`
    select id, name, emoji, min_paise, volume, enabled, blob_url, duration_ms, size_bytes
    from creator_sounds
    where creator_id = ${user.id}
    order by created_at, id
  `;

  const sounds: SoundRow[] = rows.map((r) => ({
    // bigint columns come back as strings; the actions need real numbers.
    id: Number(r.id),
    name: r.name,
    emoji: r.emoji ?? "",
    minRupees: Math.ceil(r.min_paise / 100),
    volume: r.volume,
    enabled: r.enabled,
    url: r.blob_url,
    durationMs: r.duration_ms,
  }));
  const usedBytes = rows.reduce((sum, r) => sum + r.size_bytes, 0);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-16">
        <div className="space-y-4">
          <DashboardNav current="sounds" />
          <h1 className="display text-[clamp(2rem,8vw,3rem)]">Sounds</h1>
          <p className="text-pretty text-base text-muted">
            Upload short clips for your stream. Fans can pick one on your tip page, and it plays
            with their alert. Set a minimum tip for each, and choose one that plays when a fan
            picks nothing. A tip uses either a sound or a spoken message, never both.
          </p>
        </div>

        <SoundsManager
          creatorId={user.id}
          sounds={sounds}
          defaultSoundId={user.default_sound_id === null ? null : Number(user.default_sound_id)}
          usedBytes={usedBytes}
          maxBytes={MAX_SOUND_BYTES_PER_CREATOR}
          maxSounds={MAX_SOUNDS_PER_CREATOR}
          uploadsReady={!!process.env.BLOB_READ_WRITE_TOKEN}
        />
      </div>
    </PageShell>
  );
}
