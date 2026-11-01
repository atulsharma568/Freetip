import type { LedgerDb } from "../accrual";
import { load, toWhole, type Loaded } from "./result";

// Reads of audit_events (append-only, written by the site: owner actions, handle
// changes, account closing). Newest first. Read only.

export const AUDIT_PAGE_SIZE = 50;

export interface AuditRow {
  id: number;
  at: Date;
  actorRole: string;
  actorUserId: number | null;
  action: string;
  entityType: string;
  entityRef: string | null;
  // The creator an event is about, when it has one (entity_type 'user').
  creatorId: number | null;
  creatorLabel: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
}

export interface AuditFilter {
  // Free text: a user id, a handle, an email or a name.
  creator?: string;
  // An exact creator id (the creator page).
  creatorId?: number;
  action?: string;
  page?: number;
}

export interface AuditPage {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

const likeOf = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function getAuditPage(db: LedgerDb, filter: AuditFilter, pageSize = AUDIT_PAGE_SIZE): Promise<Loaded<AuditPage>> {
  return load("the audit events", async () => {
    const creator = (filter.creator ?? "").trim().slice(0, 100);
    const like = likeOf(creator);
    const action = (filter.action ?? "").slice(0, 100);
    const creatorId = filter.creatorId ?? -1;
    const page = Math.max(1, Math.floor(filter.page ?? 1));
    const offset = (page - 1) * pageSize;

    const [count] = await db<{ n: string }[]>`
      select count(*)::text as n
        from audit_events e
        left join users u on e.entity_type = 'user' and u.id::text = e.entity_ref
       where (${action} = '' or e.action = ${action})
         and (${creatorId}::bigint = -1 or u.id = ${creatorId})
         and (${creator} = ''
              or u.id::text = ${creator} or u.handle ilike ${like} or u.email ilike ${like} or u.name ilike ${like})
    `;
    const found = await db<{
      id: string;
      created_at: Date;
      actor_role: string;
      actor_user_id: string | null;
      action: string;
      entity_type: string;
      entity_ref: string | null;
      user_id: string | null;
      user_label: string | null;
      before_json: unknown;
      after_json: unknown;
      reason: string | null;
    }[]>`
      select e.id::text, e.created_at, e.actor_role, e.actor_user_id::text, e.action, e.entity_type,
             e.entity_ref, u.id::text as user_id, coalesce(u.handle, u.name, u.email) as user_label,
             e.before_json, e.after_json, e.reason
        from audit_events e
        left join users u on e.entity_type = 'user' and u.id::text = e.entity_ref
       where (${action} = '' or e.action = ${action})
         and (${creatorId}::bigint = -1 or u.id = ${creatorId})
         and (${creator} = ''
              or u.id::text = ${creator} or u.handle ilike ${like} or u.email ilike ${like} or u.name ilike ${like})
       order by e.created_at desc, e.id desc
       limit ${pageSize} offset ${offset}
    `;
    return {
      total: toWhole(count.n),
      page,
      pageSize,
      rows: found.map((r) => ({
        id: toWhole(r.id),
        at: r.created_at,
        actorRole: r.actor_role,
        actorUserId: r.actor_user_id === null ? null : toWhole(r.actor_user_id),
        action: r.action,
        entityType: r.entity_type,
        entityRef: r.entity_ref,
        creatorId: r.user_id === null ? null : toWhole(r.user_id),
        creatorLabel: r.user_label,
        before: r.before_json,
        after: r.after_json,
        reason: r.reason,
      })),
    };
  });
}

// Every action name that has been recorded, for the filter.
export function getAuditActions(db: LedgerDb): Promise<Loaded<string[]>> {
  return load("the audit actions", async () => {
    const rows = await db<{ action: string }[]>`select distinct action from audit_events order by action`;
    return rows.map((r) => r.action);
  });
}

// When the owner last changed this creator's paid features, and what they were set to.
export function getLastFeatureChange(
  db: LedgerDb,
  creatorId: number,
): Promise<Loaded<{ at: Date; reason: string | null } | null>> {
  return load("the last feature change", async () => {
    const rows = await db<{ created_at: Date; reason: string | null }[]>`
      select created_at, reason from audit_events
       where action = 'creator.features_changed' and entity_type = 'user' and entity_ref = ${String(creatorId)}
       order by created_at desc, id desc limit 1
    `;
    return rows[0] ? { at: rows[0].created_at, reason: rows[0].reason } : null;
  });
}
