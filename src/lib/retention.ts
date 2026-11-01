import type { LedgerDb } from "./accrual";

// The privacy policy promises that a tip's name and message are deleted after 90
// days and only the payment record stays. This is that promise. It blanks the two
// fields on every tip order older than the limit, whatever its status (an unpaid or
// failed order carries the same name and message), and leaves the order, its amount
// and the ledger alone. Safe to run again: only rows that still hold text are touched.

export const TIP_TEXT_RETENTION_DAYS = 90;

export async function purgeOldTipText(db: LedgerDb): Promise<{ cleared: number }> {
  return db.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update tip_orders
         set fan_name = null, fan_message = null
       where created_at < now() - make_interval(days => ${TIP_TEXT_RETENTION_DAYS})
         and (fan_name is not null or fan_message is not null)
      returning id::text as id
    `;
    if (rows.length) {
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, after_json, reason)
        values (null, 'system', 'tips.text_purged', 'tip_orders',
                ${{ cleared: rows.length, retention_days: TIP_TEXT_RETENTION_DAYS }}::jsonb,
                'daily clean-up: tip names and messages older than the retention period')
      `;
    }
    return { cleared: rows.length };
  });
}

// Contact-form messages the owner has marked handled are deleted 12 months after they
// were sent (owner, 2026-11-01). Unhandled ones are kept until someone deals with them.
// The age counts from when the message arrived, as no handled-at time is stored.

export const CONTACT_RETENTION_MONTHS = 12;

export async function purgeHandledContactMessages(db: LedgerDb): Promise<{ deleted: number }> {
  return db.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      delete from contact_messages
       where status = 'handled'
         and created_at < now() - make_interval(months => ${CONTACT_RETENTION_MONTHS})
      returning id::text as id
    `;
    if (rows.length) {
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, after_json, reason)
        values (null, 'system', 'contact.messages_purged', 'contact_messages',
                ${{ deleted: rows.length, retention_months: CONTACT_RETENTION_MONTHS }}::jsonb,
                'daily clean-up: handled contact messages older than the retention period')
      `;
    }
    return { deleted: rows.length };
  });
}

// Timestamp moments hold a viewer's chat name and what they typed after !ts, so they
// follow the same 90 days as tip text. The comment already posted on YouTube is the
// creator's own and is not touched. A stream row with no moments left is removed too.
export const TIMESTAMP_RETENTION_DAYS = 90;

export async function purgeOldTimestamps(db: LedgerDb): Promise<{ deleted: number }> {
  return db.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      delete from stream_timestamps
       where created_at < now() - make_interval(days => ${TIMESTAMP_RETENTION_DAYS})
      returning id::text as id
    `;
    // Posted, skipped or failed streams with nothing left to show. A queued stream is
    // kept: its moments are still waiting for the stream to end.
    await tx`
      delete from timestamp_streams s
       where s.state in ('posted', 'skipped', 'failed')
         and s.created_at < now() - make_interval(days => ${TIMESTAMP_RETENTION_DAYS})
         and not exists (select 1 from stream_timestamps m where m.video_id = s.video_id)
    `;
    if (rows.length) {
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, after_json, reason)
        values (null, 'system', 'timestamps.purged', 'stream_timestamps',
                ${{ deleted: rows.length, retention_days: TIMESTAMP_RETENTION_DAYS }}::jsonb,
                'daily clean-up: stream timestamps older than the retention period')
      `;
    }
    return { deleted: rows.length };
  });
}
