"use server";

import { revalidatePath } from "next/cache";
import { BLOCKER_MESSAGE, CLOSED_EMAIL_DOMAIN, closeCreatorAccount } from "@/lib/account-close";
import { requireOwner } from "@/lib/owner-auth";
import { getDb } from "@/lib/db";
import type { LedgerDb, SweepResult } from "@/lib/accrual";
import { syncBooks } from "@/lib/books-sync";
import { approveHandleRequest, rejectHandleRequest } from "@/lib/handle-requests";
import { del } from "@vercel/blob";
import { builtFeatureKeys, sanitizeFeatureKeys } from "@/lib/plans";
import type { AdminActionState } from "@/lib/admin/action-state";
import { HANDLE_BLOCKED } from "@/lib/admin/messages";
import { getTtsFloorPaise, parseFloorRupees, TTS_FLOOR_KEY } from "@/lib/site-settings";

type CreatorStatus = "pending" | "active" | "suspended";

// Every owner action that goes through a form returns the new state for
// useActionState, so the page can say what happened (or why nothing did). Anything
// that changes a creator also writes one audit_events row in the same transaction,
// so the history cannot show a change that did not happen or miss one that did.
const ok = (message: string): AdminActionState => ({ status: "ok", message });
const fail = (message: string): AdminActionState => ({ status: "error", message });
const NO_DB = "The database is not set up.";
const SAVE_FAILED = "Could not save. The server log has the reason.";

const validId = (n: number) => Number.isSafeInteger(n) && n >= 1;

// The optional reason box on a confirm step (kept short; goes into audit_events.reason).
function reasonOf(formData: FormData, fallback: string | null = null): string | null {
  const r = formData.get("reason");
  return typeof r === "string" && r.trim() ? r.trim().slice(0, 300) : fallback;
}

function refreshCreator(creatorId: number) {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/creators");
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin/audit");
}

const STATUS_AUDIT: Record<CreatorStatus, { action: string; done: string }> = {
  active: { action: "creator.approved", done: "Approved." },
  suspended: { action: "creator.suspended", done: "Suspended." },
  pending: { action: "creator.reset_to_pending", done: "Reset to pending." },
};

export async function setCreatorStatus(
  creatorId: number,
  status: CreatorStatus,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();

  if (!validId(creatorId) || !(["pending", "active", "suspended"] as const).includes(status)) {
    return fail("That request is not valid.");
  }
  const db = getDb();
  if (!db) return fail(NO_DB);

  try {
    const outcome = await db.begin(async (tx) => {
      const [row] = await tx<{ email: string; creator_status: string; onboarding_state: string }[]>`
        select email, creator_status, onboarding_state from users where id = ${creatorId} for update
      `;
      if (!row) return "missing" as const;
      // A closed account stays closed: its row is empty and only kept for the records.
      if (row.email.endsWith(CLOSED_EMAIL_DOMAIN)) return "closed" as const;

      // Sync onboarding_state when changing creator_status:
      //   active    -> 'active'      (completed the gate)
      //   pending   -> 'not_started' (reset the gate)
      //   suspended -> unchanged
      const onboarding =
        status === "active" ? "active" : status === "pending" ? "not_started" : row.onboarding_state;
      await tx`
        update users set creator_status = ${status}, onboarding_state = ${onboarding} where id = ${creatorId}
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', ${STATUS_AUDIT[status].action}, 'user', ${String(creatorId)},
                ${tx.json({ creator_status: row.creator_status, onboarding_state: row.onboarding_state })},
                ${tx.json({ creator_status: status, onboarding_state: onboarding })},
                ${reasonOf(formData, "set by the owner")})
      `;
      return "done" as const;
    });
    if (outcome === "missing") return fail("That creator was not found.");
    if (outcome === "closed") return fail("That account is closed and stays closed.");
    refreshCreator(creatorId);
    return ok(STATUS_AUDIT[status].done);
  } catch (err) {
    console.error("Admin: could not change a creator's status", err);
    return fail(SAVE_FAILED);
  }
}

// Puts a creator's tip-page colour back to the default lime (the owner's takedown
// for a colour that clashes with the site or looks like someone else's brand).
export async function resetCreatorAccent(
  creatorId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const outcome = await db.begin(async (tx) => {
      const [row] = await tx<{ accent: string | null }[]>`select accent from users where id = ${creatorId} for update`;
      if (!row) return "missing" as const;
      await tx`update users set accent = null where id = ${creatorId}`;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', 'creator.accent_reset', 'user', ${String(creatorId)},
                ${tx.json({ accent: row.accent })}, ${tx.json({ accent: null })}, ${reasonOf(formData, "reset by the owner")})
      `;
      return "done" as const;
    });
    if (outcome === "missing") return fail("That creator was not found.");
    refreshCreator(creatorId);
    return ok("Colour reset.");
  } catch (err) {
    console.error("Admin: could not reset a creator's colour", err);
    return fail(SAVE_FAILED);
  }
}

// Turns paid features on or off for one creator (the owner's per-creator switches,
// stored in users.paid_features). `intent` is "save" (the ticked boxes), "all" (every
// feature that exists) or "none". Each change is written to the audit trail.
export async function setCreatorFeatures(
  creatorId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  const intent = formData.get("intent");
  const keys =
    intent === "all"
      ? builtFeatureKeys()
      : intent === "none"
        ? []
        : sanitizeFeatureKeys(formData.getAll("feature").filter((v): v is string => typeof v === "string"));

  try {
    const found = await db.begin(async (tx) => {
      const [before] = await tx<{ paid_features: string[] }[]>`
        select paid_features from users where id = ${creatorId} for update
      `;
      if (!before) return false;
      await tx`update users set paid_features = ${keys}::text[] where id = ${creatorId}`;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', 'creator.features_changed', 'user', ${String(creatorId)},
                ${tx.json({ features: before.paid_features })}, ${tx.json({ features: keys })},
                ${reasonOf(formData, "set by the owner")})
      `;
      return true;
    });
    if (!found) return fail("That creator was not found.");
  } catch (err) {
    console.error("Admin: could not save paid features (migration 0035 run?)", err);
    return fail("Could not save. Has migration 0035 been run?");
  }
  refreshCreator(creatorId);
  revalidatePath("/admin/features");
  revalidatePath("/dashboard", "layout");
  return ok(keys.length === 0 ? "Saved. Everything is off." : `Saved. ${keys.length} feature${keys.length === 1 ? "" : "s"} on.`);
}

export async function rejectCreatorOnboarding(
  creatorId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  try {
    const changed = await db.begin(async (tx) => {
      const [row] = await tx<{ onboarding_state: string }[]>`
        select onboarding_state from users where id = ${creatorId} and creator_status = 'pending' for update
      `;
      if (!row) return false;
      await tx`update users set onboarding_state = 'rejected' where id = ${creatorId}`;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', 'creator.onboarding_rejected', 'user', ${String(creatorId)},
                ${tx.json({ onboarding_state: row.onboarding_state })}, ${tx.json({ onboarding_state: "rejected" })},
                ${reasonOf(formData, "rejected by the owner")})
      `;
      return true;
    });
    if (!changed) return fail("Only a pending creator can be rejected.");
    refreshCreator(creatorId);
    return ok("Payout setup rejected.");
  } catch (err) {
    console.error("Admin: could not reject a payout setup", err);
    return fail(SAVE_FAILED);
  }
}

export async function setMessageHandled(
  messageId: number,
  handled: boolean,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(messageId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  try {
    await db`
      update contact_messages set status = ${handled ? "handled" : "new"} where id = ${messageId}
    `;
  } catch (err) {
    console.error("Admin: could not update a message", err);
    return fail(SAVE_FAILED);
  }
  revalidatePath("/admin/messages");
  revalidatePath("/admin", "layout");
  return ok(handled ? "Marked handled." : "Marked as new.");
}

// Owner review of a creator's alert media (migration 0036). Uploads now go live
// at once; this approves a file still held as 'new' from the earlier first-upload rule.
// Both choices are written to the audit history against the creator.
export async function adminApproveMedia(
  mediaId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(mediaId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  try {
    const approved = await db.begin(async (tx) => {
      const rows = await tx<{ creator_id: string; name: string }[]>`
        update creator_media set review_state = 'approved'
        where id = ${mediaId} and review_state = 'new'
        returning creator_id::text, name
      `;
      if (!rows[0]) return false;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
        values (null, 'owner', 'media.approved', 'user', ${rows[0].creator_id},
                ${tx.json({ media_id: mediaId, name: rows[0].name })},
                ${reasonOf(formData, "approved by the owner")})
      `;
      return true;
    });
    if (!approved) return fail("That file is no longer waiting for approval.");
  } catch (err) {
    console.error("Admin: could not approve media", err);
    return fail(SAVE_FAILED);
  }
  revalidatePath("/admin/media");
  revalidatePath("/admin/audit");
  return ok("Approved. It plays on the creator's alerts now.");
}

// Takes a file down: its file is erased and the row stays as a "taken down" note the
// creator can see and delete (it cannot be switched back on).
export async function adminRemoveMedia(
  mediaId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(mediaId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  let blobUrl: string | null = null;
  try {
    const removed = await db.begin(async (tx) => {
      const rows = await tx<{ blob_url: string; creator_id: string; name: string; handle: string | null }[]>`
        with gone as (
          update creator_media set review_state = 'removed', enabled = false
          where id = ${mediaId} and review_state <> 'removed'
          returning blob_url, creator_id, name
        )
        select g.blob_url, g.creator_id::text, g.name, u.handle
          from gone g join users u on u.id = g.creator_id
      `;
      if (!rows[0]) return false;
      blobUrl = rows[0].blob_url;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, reason)
        values (null, 'owner', 'media.removed', 'user', ${rows[0].creator_id},
                ${tx.json({ media_id: mediaId, name: rows[0].name, handle: rows[0].handle })},
                ${reasonOf(formData, "removed by the owner")})
      `;
      return true;
    });
    if (!removed) return fail("That file is already taken down.");
  } catch (err) {
    console.error("Admin: could not remove media", err);
    return fail(SAVE_FAILED);
  }
  if (blobUrl) {
    try {
      await del(blobUrl);
    } catch (err) {
      console.error("Could not delete media file", err);
    }
  }
  revalidatePath("/admin/media");
  revalidatePath("/admin/audit");
  return ok("File taken down.");
}

// Owner removal of any creator's sound (for example one that breaks the rules).
// Recorded against the creator, so it shows in their audit history.
export async function adminDeleteSound(
  soundId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(soundId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  let blobUrl: string | null = null;
  try {
    const removed = await db.begin(async (tx) => {
      const rows = await tx<{ blob_url: string; creator_id: string; name: string; handle: string | null }[]>`
        with gone as (
          delete from creator_sounds where id = ${soundId} returning blob_url, creator_id, name
        )
        select g.blob_url, g.creator_id::text, g.name, u.handle
          from gone g join users u on u.id = g.creator_id
      `;
      if (!rows[0]) return false;
      blobUrl = rows[0].blob_url;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, reason)
        values (null, 'owner', 'sound.removed', 'user', ${rows[0].creator_id},
                ${tx.json({ sound_id: soundId, name: rows[0].name, handle: rows[0].handle })},
                ${reasonOf(formData, "removed by the owner")})
      `;
      return true;
    });
    if (!removed) return fail("That sound is already gone.");
  } catch (err) {
    console.error("Admin: could not remove a sound", err);
    return fail(SAVE_FAILED);
  }
  if (blobUrl) {
    try {
      await del(blobUrl);
    } catch (err) {
      console.error("Could not delete sound file", err);
    }
  }
  revalidatePath("/admin/sounds");
  revalidatePath("/admin/audit");
  return ok("Sound removed.");
}

// Marks a logged word as dealt with (added to the dictionary, or fine as English) so
// it stops showing in /admin/tts-words.
export async function reviewTtsWord(
  word: string,
): Promise<AdminActionState> {
  await requireOwner();
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    await db`update tts_unknown_words set reviewed = true where word = ${word}`;
  } catch (err) {
    console.error("Admin: could not mark a word reviewed", err);
    return fail(SAVE_FAILED);
  }
  revalidatePath("/admin/tts-words");
  return ok("Marked reviewed.");
}

// Removes a word the voice learned by itself, and stops it being learned again.
export async function removeLearnedWord(
  word: string,
): Promise<AdminActionState> {
  await requireOwner();
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    await db`delete from tts_learned_words where word = ${word}`;
    await db`
      insert into tts_unknown_words (word, reviewed, outcome) values (${word}, true, 'removed')
      on conflict (word) do update set reviewed = true, outcome = 'removed'
    `;
  } catch (err) {
    console.error("Admin: could not remove a learned word", err);
    return fail(SAVE_FAILED);
  }
  revalidatePath("/admin/tts-words");
  return ok("Removed.");
}

// What the page shows after the owner presses Sync. Plain data only (it crosses
// from the server to the browser), so dates are ISO strings.
export interface SyncProblem {
  paymentId: string;
  orderId: string | null;
  amountPaise: number;
  method: string | null;
  createdAt: string;
  kind: "unknown_order" | "not_marked_captured";
}

export type SyncReport = {
  check:
    | { ran: true; checked: number; truncated: boolean; problems: SyncProblem[]; backfillable: number }
    | { ran: false; reason: string; detail?: string };
  backfilled: number;
  sweep: SweepResult | null;
};

export type SyncState =
  | { status: "idle" }
  | { status: "done"; report: SyncReport }
  | { status: "error"; message: string };

// The same three steps the daily job runs, on demand: ask Razorpay what it captured
// recently, fill in what the site failed to save for payments it did capture, then
// post every captured live tip that is not on the books yet. Safe to press as often
// as wanted: a tip is posted once, keyed by its Razorpay payment id. It is a
// button (a POST), not a link, because it calls Razorpay and changes the books.
export async function syncBooksNow(): Promise<SyncState> {
  await requireOwner();

  const db = getDb();
  if (!db) return { status: "error", message: "The database is not set up." };

  try {
    const r = await syncBooks(db as unknown as LedgerDb, {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/finance");
    revalidatePath("/admin/finance/creators");
    revalidatePath("/admin/finance/payments");
    revalidatePath("/admin/reconciliation");
    const check: SyncReport["check"] = r.check.ok
      ? {
          ran: true,
          checked: r.check.checked,
          truncated: r.check.truncated,
          backfillable: r.check.backfill.length,
          problems: r.check.problems.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
        }
      : { ran: false, reason: r.check.reason, detail: r.check.detail };
    return { status: "done", report: { check, backfilled: r.backfilled, sweep: r.sweep } };
  } catch (err) {
    console.error("Admin: syncing the books failed", err);
    return { status: "error", message: "Could not sync. Has migration 0023 been run?" };
  }
}

// Closes a creator's account at their request (the privacy policy tells them to ask
// through the contact form). The same rules as their own button: money owed or a
// payout in progress stops it, and the page says why.
export async function adminCloseCreator(
  creatorId: number,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(creatorId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  let result;
  try {
    result = await closeCreatorAccount(db as unknown as LedgerDb, creatorId, { role: "owner", userId: null });
  } catch (err) {
    console.error("Admin: could not close an account", err);
    return fail(SAVE_FAILED);
  }
  if (result.status === "closed") {
    for (const url of result.blobUrls) {
      try {
        await del(url);
      } catch (err) {
        console.error("Could not delete sound file", err);
      }
    }
  }
  refreshCreator(creatorId);
  if (result.status === "blocked") return fail(`Not closed: ${BLOCKER_MESSAGE[result.reason]}`);
  if (result.status === "not_found") return fail("That creator was not found.");
  if (result.status === "already_closed") return ok("Already closed.");
  return ok("Account closed.");
}

// Handle change requests (migration 0031). Approving renames at once; if the rename
// cannot happen the request stays open and the page says why.
export async function approveHandleChange(
  requestId: number,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(requestId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  let result;
  try {
    result = await approveHandleRequest(db as unknown as LedgerDb, requestId);
  } catch (err) {
    console.error("Admin: could not approve a handle change", err);
    return fail(SAVE_FAILED);
  }
  revalidatePath("/admin/handle-requests");
  revalidatePath("/admin/creators");
  revalidatePath("/admin/audit");
  revalidatePath("/admin", "layout");
  if (result.status === "blocked") return fail(`Not approved: ${HANDLE_BLOCKED[result.reason] ?? result.reason}`);
  if (result.status === "gone") return fail("That request was already decided.");
  return ok("Approved. The handle was changed.");
}

export async function rejectHandleChange(
  requestId: number,
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(requestId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);

  try {
    const result = await rejectHandleRequest(db as unknown as LedgerDb, requestId, String(form.get("note") ?? ""));
    revalidatePath("/admin/handle-requests");
    revalidatePath("/admin/audit");
    revalidatePath("/admin", "layout");
    if (result.status === "gone") return fail("That request was already decided.");
    return ok("Rejected.");
  } catch (err) {
    console.error("Admin: could not reject a handle change", err);
    return fail(SAVE_FAILED);
  }
}

// The smallest tip that may have its message read aloud, for every creator (the voice
// floor in /admin/settings). A creator's own amount can be higher, never lower.
export async function setTtsFloor(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireOwner();
  const rupees = parseFloorRupees(formData.get("floor"));
  if (rupees === null) return fail("Enter a whole number of rupees, from 0 to 10,000.");
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const before = await getTtsFloorPaise(db);
    await db.begin(async (tx) => {
      await tx`
        insert into site_settings (key, value, updated_at) values (${TTS_FLOOR_KEY}, ${String(rupees * 100)}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', 'site.tts_floor_changed', 'site_setting', ${TTS_FLOOR_KEY},
                ${tx.json({ paise: before })}, ${tx.json({ paise: rupees * 100 })}, 'set by the owner')
      `;
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/audit");
    return ok(rupees === 0 ? "Saved. There is no site-wide minimum now." : `Saved. Voice starts at ₹${rupees} for everyone.`);
  } catch (err) {
    console.error("Admin: could not save the voice minimum (migration 0043 run?)", err);
    return fail("Could not save. Has migration 0043 been run in Neon?");
  }
}
