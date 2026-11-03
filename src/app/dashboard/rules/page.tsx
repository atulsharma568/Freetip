import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { MAX_RULES_PER_CREATOR } from "@/lib/alert-rules";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { RulesManager, type RuleRow } from "./RulesManager";

export const metadata: Metadata = {
  title: `Tip page picks: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function RulesPage() {
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
  if (!user?.handle || !hasFeature(user, "alertRules")) redirect("/dashboard");
  const mediaOn = hasFeature(user, "customAlertMedia");

  const [rules, sounds, media] = await Promise.all([
    db<{ id: string; min_paise: number; media_id: string | null; sound_id: string | null; stay_seconds: number | null }[]>`
      select id::text, min_paise, media_id::text, sound_id::text, stay_seconds
      from alert_rules where creator_id = ${user.id} order by min_paise
    `,
    db<{ id: string; name: string; emoji: string | null }[]>`
      select id::text, name, emoji from creator_sounds where creator_id = ${user.id} order by created_at, id
    `,
    mediaOn
      ? db<{ id: string; name: string; review_state: string }[]>`
          select id::text, name, review_state from creator_media
          where creator_id = ${user.id} and review_state <> 'removed' order by created_at, id
        `
      : Promise.resolve([] as { id: string; name: string; review_state: string }[]),
  ]);

  const soundName = new Map(sounds.map((s) => [Number(s.id), `${s.emoji ? `${s.emoji} ` : ""}${s.name}`]));
  const mediaName = new Map(media.map((m) => [Number(m.id), m.name]));
  const rows: RuleRow[] = rules.map((r) => ({
    id: Number(r.id),
    minRupees: Math.ceil(r.min_paise / 100),
    mediaName: r.media_id === null ? null : (mediaName.get(Number(r.media_id)) ?? "A file that is no longer available"),
    staySeconds: r.stay_seconds,
    soundName: r.sound_id === null ? null : (soundName.get(Number(r.sound_id)) ?? "A sound that is no longer available"),
  }));

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="rules" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Tip page picks</h1>
          <p className="text-pretty text-base text-muted">
            Each rule is a pick on your tip page: a GIF, picture or video with its sound, for one fixed
            amount. A fan taps it, hears the sound, and the amount is set to yours. A pick plays on its own,
            with no message, no soundboard sound and no voice, so it never overlaps with them. Only rules of
            ₹20 or more show on the tip page. For ₹1,000 or more a rule can also keep the alert on screen for up to
            5 minutes; tips after it wait their turn, and Skip ends it early.
          </p>
        </div>

        <RulesManager
          rules={rows}
          sounds={sounds.map((s) => ({ id: Number(s.id), label: soundName.get(Number(s.id)) ?? s.name }))}
          media={media.map((m) => ({ id: Number(m.id), label: m.review_state === "new" ? `${m.name} (waiting for approval)` : m.name }))}
          mediaOn={mediaOn}
          maxRules={MAX_RULES_PER_CREATOR}
        />
      </div>
    </DashboardShell>
  );
}
