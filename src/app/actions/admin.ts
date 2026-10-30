"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/owner-auth";
import { getDb } from "@/lib/db";
import { del } from "@vercel/blob";

type CreatorStatus = "pending" | "active" | "suspended";

export async function setCreatorStatus(
  creatorId: number,
  status: CreatorStatus,
): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;
  if (!(["pending", "active", "suspended"] as const).includes(status)) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  // Sync onboarding_state when changing creator_status:
  //   active   → onboarding_state = 'active'  (completed the gate)
  //   pending  → onboarding_state = 'not_started'  (reset the gate)
  //   suspended → leave onboarding_state unchanged
  if (status === "active") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'active'
      where id = ${creatorId}
    `;
  } else if (status === "pending") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'not_started'
      where id = ${creatorId}
    `;
  } else {
    await db`
      update users set creator_status = ${status} where id = ${creatorId}
    `;
  }

  revalidatePath("/admin/creators");
}

export async function rejectCreatorOnboarding(creatorId: number): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update users set onboarding_state = 'rejected'
    where id = ${creatorId}
      and creator_status = 'pending'
  `;

  revalidatePath("/admin/creators");
}

export async function setMessageHandled(messageId: number, handled: boolean): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(messageId) || messageId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update contact_messages set status = ${handled ? "handled" : "new"} where id = ${messageId}
  `;
  revalidatePath("/admin/messages");
}

// Owner removal of any creator's sound (for example one that breaks the rules).
export async function adminDeleteSound(soundId: number): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(soundId) || soundId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  const rows = await db<{ blob_url: string }[]>`
    delete from creator_sounds where id = ${soundId} returning blob_url
  `;
  if (rows[0]) {
    try {
      await del(rows[0].blob_url);
    } catch (err) {
      console.error("Could not delete sound file", err);
    }
  }
  revalidatePath("/admin/sounds");
}

// Marks a logged word as dealt with (added to the dictionary, or fine as English) so
// it stops showing in /admin/tts-words.
export async function reviewTtsWord(word: string): Promise<void> {
  await requireOwner();

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`update tts_unknown_words set reviewed = true where word = ${word}`;
  revalidatePath("/admin/tts-words");
}

// Removes a word the voice learned by itself, and stops it being learned again.
export async function removeLearnedWord(word: string): Promise<void> {
  await requireOwner();

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`delete from tts_learned_words where word = ${word}`;
  await db`
    insert into tts_unknown_words (word, reviewed, outcome) values (${word}, true, 'removed')
    on conflict (word) do update set reviewed = true, outcome = 'removed'
  `;
  revalidatePath("/admin/tts-words");
}
