"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

// Dashboard buttons for the OBS overlay: test, skip and replay. Only the signed-in
// creator's own overlay is touched. Test and skip just write a timestamp that the
// overlay's next poll picks up (migration 0017); replay makes the last alert
// available again.

export type ControlResult = { status: "ok"; message: string } | { status: "error"; message: string };

const BUSY: ControlResult = { status: "error", message: "Wait a few seconds and try again." };
const FAILED: ControlResult = { status: "error", message: "Could not do that. Try again shortly." };

async function creatorId(): Promise<{ db: NonNullable<ReturnType<typeof getDb>>; id: number } | ControlResult> {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable. Try again shortly." };
  const [row] = await db<{ id: number; has_link: boolean }[]>`
    select id, overlay_token_hash is not null as has_link from users where google_id = ${googleId}
  `;
  if (!row?.has_link) return { status: "error", message: "Create your alert link first." };
  return { db, id: row.id };
}

export async function sendTestAlert(): Promise<ControlResult> {
  const who = await creatorId();
  if ("status" in who) return who;
  try {
    const done = await who.db`
      update users set overlay_test_at = now()
      where id = ${who.id} and (overlay_test_at is null or overlay_test_at < now() - interval '3 seconds')
      returning id
    `;
    if (!done.length) return BUSY;
  } catch (err) {
    console.error("Overlay controls: test failed.", err);
    return FAILED;
  }
  return { status: "ok", message: "Test alert sent. It shows in OBS within a few seconds." };
}

export async function skipAlert(): Promise<ControlResult> {
  const who = await creatorId();
  if ("status" in who) return who;
  try {
    await who.db`update users set overlay_skip_at = now() where id = ${who.id}`;
  } catch (err) {
    console.error("Overlay controls: skip failed.", err);
    return FAILED;
  }
  return { status: "ok", message: "Skipping. The card clears in OBS within a few seconds." };
}

// Plays the most recent alert again. Only tips from the last hour qualify (the
// overlay drops anything older), and a cooldown stops a double click replaying two.
export async function replayLastAlert(): Promise<ControlResult> {
  const who = await creatorId();
  if ("status" in who) return who;
  try {
    return await who.db.begin(async (tx): Promise<ControlResult> => {
      const cooled = await tx`
        update users set overlay_replay_at = now()
        where id = ${who.id} and (overlay_replay_at is null or overlay_replay_at < now() - interval '10 seconds')
        returning id
      `;
      if (!cooled.length) return BUSY;
      const replayed = await tx`
        update tip_orders set alert_shown_at = null, message_shown_at = null,
                              alert_lease_until = null, message_lease_until = null
        where id = (
          select id from tip_orders
          where creator_id = ${who.id} and status = 'captured' and alert_shown_at is not null
            and captured_at > now() - interval '1 hour'
          order by alert_shown_at desc limit 1
        )
        returning id
      `;
      if (!replayed.length) {
        // Nothing replayed, so don't hold the cooldown.
        await tx`update users set overlay_replay_at = null where id = ${who.id}`;
        return { status: "error", message: "Nothing to replay from the last hour." };
      }
      return { status: "ok", message: "Replaying the last alert. It shows in OBS within a few seconds." };
    });
  } catch (err) {
    console.error("Overlay controls: replay failed.", err);
    return FAILED;
  }
}
