import type { LedgerDb, Query } from "./accrual";
import { isClosedGoogleId } from "./account-close";
import { renameHandle } from "./handle";

// Handle change requests. A creator asks, the owner decides. Approving runs the one
// allowed rename in lib/handle.ts (so the old handle is kept reserved and the check
// that it is a first and only change still holds); a rejection costs the creator
// nothing. A request does not reserve the new name: it is checked again on approval.

export type RequestResult =
  | { status: "ok" }
  | { status: "taken" }
  | { status: "same" }
  | { status: "no_handle" }
  | { status: "already_renamed" }
  | { status: "already_pending" }
  | { status: "closed" }
  | { status: "not_found" };

export async function requestHandleChange(db: LedgerDb, googleId: string, handle: string): Promise<RequestResult> {
  return db.begin(async (tx): Promise<RequestResult> => {
    await tx`select pg_advisory_xact_lock(hashtext('freetip.handle'))`;
    const users = await tx<{ id: string; handle: string | null; google_id: string }[]>`
      select id::text, handle, google_id from users where google_id = ${googleId} for update
    `;
    if (!users.length) return { status: "not_found" };
    const u = users[0];
    if (isClosedGoogleId(u.google_id)) return { status: "closed" };
    if (!u.handle) return { status: "no_handle" };
    if (u.handle === handle) return { status: "same" };

    const id = Number(u.id);
    const done = await tx<{ one: number }[]>`select 1 as one from handle_history where user_id = ${id}`;
    if (done.length) return { status: "already_renamed" };
    const open = await tx<{ one: number }[]>`
      select 1 as one from handle_requests where user_id = ${id} and status = 'pending'
    `;
    if (open.length) return { status: "already_pending" };

    const used = await tx<{ one: number }[]>`
      select 1 as one from users where handle = ${handle}
      union all
      select 1 as one from handle_history where old_handle = ${handle}
      limit 1
    `;
    if (used.length) return { status: "taken" };

    await tx`
      insert into handle_requests (user_id, current_handle, requested_handle)
      values (${id}, ${u.handle}, ${handle})
    `;
    return { status: "ok" };
  });
}

export type DecisionResult =
  | { status: "approved"; handle: string }
  | { status: "rejected" }
  | { status: "gone" }
  | { status: "blocked"; reason: "taken" | "already_renamed" | "same" | "no_handle" | "closed" | "not_found" };

type Pending = { id: string; google_id: string; requested_handle: string; current_handle: string; user_id: string };

async function loadPending(tx: Query, requestId: number): Promise<Pending | null> {
  const rows = await tx<Pending[]>`
    select r.id::text, u.google_id, r.requested_handle, r.current_handle, r.user_id::text
    from handle_requests r join users u on u.id = r.user_id
    where r.id = ${requestId} and r.status = 'pending'
    for update of r
  `;
  return rows[0] ?? null;
}

// Approving renames in the same moment. If the rename cannot happen (someone took the
// name since, the account closed) the request is left pending and the reason is
// returned so the owner can reject it with a note.
export async function approveHandleRequest(db: LedgerDb, requestId: number): Promise<DecisionResult> {
  const req = await db.begin((tx) => loadPending(tx, requestId));
  if (!req) return { status: "gone" };

  const renamed = await renameHandle(db, req.google_id, req.requested_handle, {
    role: "owner",
    reason: "approved by the owner",
  });
  if (renamed.status !== "ok") {
    return { status: "blocked", reason: renamed.status === "already_set" ? "same" : renamed.status };
  }
  await db.begin(async (tx) => {
    await tx`
      update handle_requests set status = 'approved', decided_at = now()
      where id = ${requestId} and status = 'pending'
    `;
  });
  return { status: "approved", handle: renamed.handle };
}

export async function rejectHandleRequest(db: LedgerDb, requestId: number, note: string): Promise<DecisionResult> {
  return db.begin(async (tx): Promise<DecisionResult> => {
    const req = await loadPending(tx, requestId);
    if (!req) return { status: "gone" };
    await tx`
      update handle_requests
      set status = 'rejected', decided_at = now(), decision_note = ${note.trim().slice(0, 300) || null}
      where id = ${requestId}
    `;
    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
      values (null, 'owner', 'handle.request_rejected', 'user', ${req.user_id},
              ${{ from: req.current_handle, to: req.requested_handle }}::jsonb, 'rejected by the owner')
    `;
    return { status: "rejected" };
  });
}

export const REQUEST_MESSAGE: Record<Exclude<RequestResult["status"], "ok">, string> = {
  taken: "That handle is taken. Try another",
  same: "That is already your handle",
  no_handle: "Claim your handle first",
  already_renamed: "You have already changed your handle once, and it cannot be changed again",
  already_pending: "You already have a request waiting. Please wait for the decision",
  closed: "This account is closed",
  not_found: "We could not find your account. Sign in again",
};
