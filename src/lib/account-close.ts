import type { LedgerDb } from "./accrual";
import { eraseFans } from "./fan-profiles";
import { eraseStreamlabs } from "./streamlabs-outbox";
import { open } from "./secret-box";
import { createYouTubeClient } from "./youtube";

// Closing a creator account. The users row cannot be deleted: tips, the ledger,
// payouts and the audit log all point at it, and the law makes us keep those. So
// the row is emptied in place. What identifies the person goes (name, email,
// picture, YouTube channel, bio, sounds, alert media, saved stream timestamps and the YouTube and Discord connections, contact-form messages sent from the sign-in email, OBS link, UPI and legal name unless money
// was ever posted for them, which makes those part of a payout record). The id,
// the money records and the handle stay: the handle stays reserved so a stranger
// cannot take over an old QR code or link.
//
// A closed account is marked by its google_id ("closed:<id>"), so signing in with
// the same Google account later makes a brand new account.

export type CloseBlocker = "balance" | "payout_in_progress" | "unposted_tips";

export type CloseResult =
  | { status: "closed"; blobUrls: string[] }
  | { status: "blocked"; reason: CloseBlocker }
  | { status: "already_closed" }
  | { status: "not_found" };

export const CLOSED_PREFIX = "closed:";
export const CLOSED_EMAIL_DOMAIN = "@closed.invalid";

export const isClosedGoogleId = (googleId: string): boolean => googleId.startsWith(CLOSED_PREFIX);

export const BLOCKER_MESSAGE: Record<CloseBlocker, string> = {
  balance:
    "There is still money on your balance. Send us a message through the contact form and we will settle it before closing your account.",
  payout_in_progress:
    "A payout to you is still in progress. Send us a message through the contact form and we will finish it before closing your account.",
  unposted_tips:
    "Some recent tips are still being recorded. Try again in a few hours, or send us a message through the contact form.",
};

export async function closeCreatorAccount(
  db: LedgerDb,
  userId: number,
  actor: { role: "creator" | "owner"; userId: number | null },
): Promise<CloseResult> {
  const result = await db.begin(async (tx): Promise<CloseResult> => {
    const users = await tx<{ google_id: string; email: string | null }[]>`
      select google_id, email from users where id = ${userId} for update
    `;
    if (!users.length) return { status: "not_found" };
    if (isClosedGoogleId(users[0].google_id)) return { status: "already_closed" };

    // Money we still owe (or are owed) must be settled by a person first.
    const [bal] = await tx<{ balance: string }[]>`
      select coalesce(sum(e.credit_minor - e.debit_minor), 0)::text as balance
        from ledger_entries e
        join ledger_accounts a on a.id = e.account_id and a.code = 'creator_payable'
       where e.creator_id = ${userId}
    `;
    if (bal.balance !== "0") return { status: "blocked", reason: "balance" };

    const open = await tx<{ one: number }[]>`
      select 1 as one from creator_payouts
       where creator_id = ${userId} and status in ('scheduled', 'held', 'initiated', 'in_transit')
       limit 1
    `;
    if (open.length) return { status: "blocked", reason: "payout_in_progress" };

    // A captured live tip with no ledger posting yet is money the books do not show.
    const unposted = await tx<{ one: number }[]>`
      select 1 as one
        from payment_attempts pa
        join tip_orders t on t.id = pa.tip_order_id
       where t.creator_id = ${userId}
         and t.status = 'captured'
         and pa.provider_status = 'captured'
         and pa.livemode is true
         and pa.provider_payment_ref is not null
         and not exists (
           select 1 from ledger_transactions lt
            where lt.idempotency_key = 'capture:' || pa.provider_payment_ref
         )
       limit 1
    `;
    if (unposted.length) return { status: "blocked", reason: "unposted_tips" };

    const sounds = await tx<{ blob_url: string }[]>`
      delete from creator_sounds where creator_id = ${userId} returning blob_url
    `;

    // Goal bars and their history carry the creator's own titles.
    await tx`delete from goal_history where creator_id = ${userId}`;
    await tx`delete from goals where creator_id = ${userId}`;
    await tx`delete from handle_requests where user_id = ${userId}`;

    // Messages the creator sent us through the contact form, found by the sign-in
    // email (a message sent from a different address cannot be tied to the account).
    const contact = users[0].email
      ? await tx<{ id: string }[]>`
          delete from contact_messages where lower(email) = lower(${users[0].email}) returning id::text as id
        `
      : [];

    const [money] = await tx<{ any: boolean }[]>`
      select exists (select 1 from ledger_entries where creator_id = ${userId}) as any
    `;
    const keepPayoutIdentity = money.any;

    await tx`
      update users set
        google_id           = ${CLOSED_PREFIX + userId},
        email               = ${`closed-${userId}${CLOSED_EMAIL_DOMAIN}`},
        name                = null,
        display_name        = null,
        picture_url         = null,
        bio                 = null,
        yt_channel_id       = null,
        yt_channel_name     = null,
        yt_channel_url      = null,
        legal_name          = case when ${keepPayoutIdentity} then legal_name else null end,
        upi_vpa             = case when ${keepPayoutIdentity} then upi_vpa else null end,
        banned_words        = '',
        goal_title          = null,
        goal_target_paise   = null,
        goal_started_at     = null,
        goal_repeat         = 'never',
        overlay_token_hash  = null,
        default_sound_id    = null,
        creator_status      = 'suspended'
      where id = ${userId}
    `;

    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
      values (${actor.userId}, ${actor.role}, 'account.closed', 'user', ${String(userId)},
              ${{ kept_payout_identity: keepPayoutIdentity, sounds_removed: sounds.length, contact_messages_removed: contact.length }}::jsonb,
              ${actor.role === "owner" ? "closed by the owner on the creator's request" : "closed by the creator"})
    `;

    return { status: "closed", blobUrls: sounds.map((s) => s.blob_url) };
  });

  // Apart from the transaction so it works before migration 0026 is run.
  if (result.status === "closed") {
    try {
      await db`update users set accent = null where id = ${userId}`;
    } catch {
      /* column not there yet */
    }
    await eraseTimestampData(db, userId);
    // Fan profiles, the birthdays on the creator's tips and their birthday greeting
    // (migration 0038); nothing to erase before it is run.
    try {
      await eraseFans(db, userId);
    } catch {
      /* migration 0038 not run */
    }
    // The Streamlabs connection and its queue (migration 0041): the sealed sign-in goes.
    try {
      await eraseStreamlabs(db, userId);
    } catch {
      /* migration 0041 not run */
    }
    // The creator's alert media files go with the account (the caller deletes the files).
    result.blobUrls.push(...(await eraseMedia(db, userId)));
  }
  return result;
}

// Alert media (migration 0036): the rows go and their files are handed back to be deleted
// (a file the owner already took down has none left). Apart from the main transaction so
// closing works before the migration is run (nothing to erase then).
async function eraseMedia(db: LedgerDb, userId: number): Promise<string[]> {
  try {
    const rows = await db<{ blob_url: string; review_state: string }[]>`
      delete from creator_media where creator_id = ${userId} returning blob_url, review_state
    `;
    return rows.filter((r) => r.review_state !== "removed").map((r) => r.blob_url);
  } catch {
    return [];
  }
}

// Stream timestamps (migration 0032): the saved moments carry viewers' names and words,
// and the creator's YouTube permission and Discord webhook are secrets. All go, and
// Google is told to cancel the permission. Apart from the main transaction so closing
// works before the migration is run (nothing to erase then).
async function eraseTimestampData(db: LedgerDb, userId: number): Promise<void> {
  try {
    const [row] = await db<{ token: string | null }[]>`select yt_refresh_token_enc as token from users where id = ${userId}`;
    await db`delete from stream_timestamps where creator_id = ${userId}`;
    await db`delete from timestamp_streams where creator_id = ${userId}`;
    await db`
      update users set ts_token_hash = null, yt_refresh_token_enc = null, yt_connected_at = null,
                       yt_reconnect_needed = false, discord_webhook_enc = null
       where id = ${userId}
    `;
    const token = open(row?.token);
    if (token) await createYouTubeClient().revoke(token);
  } catch {
    /* migration 0032 not run: nothing to erase */
  }
  // Phase 2 settings (migration 0033): the editor link stops working and public pages go.
  try {
    await db`update users set ts_editor_token_hash = null, ts_public = false, ts_tip_min_paise = null where id = ${userId}`;
  } catch {
    /* migration 0033 not run */
  }
  // Phase 3 (migration 0034): the clip helper's token stops working.
  try {
    await db`update users set ts_helper_token_hash = null, ts_helper_seen_at = null where id = ${userId}`;
  } catch {
    /* migration 0034 not run */
  }
}
