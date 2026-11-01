import type { LedgerDb, Query } from "./accrual";
import { isClosedGoogleId } from "./account-close";
import { HANDLE_PATTERN } from "./waitlist";

// Claiming and changing a creator handle. A handle may be changed once, ever. The
// old one is kept in handle_history, so it stays reserved for that creator: the
// old link answers 404 and nobody else can take it. Both paths take the same
// advisory lock, so a handle cannot be claimed in the instant it is being given up.

// Handles that map to existing app routes or would cause confusion.
// Next.js static routes already take precedence over /[handle], but we block
// these at claim time so the handle is never silently unreachable.
export const RESERVED_HANDLES = new Set([
  "admin", "dashboard", "signin", "signup", "about", "contact",
  "terms", "privacy", "refunds", "delivery", "pricing", "api", "overlay",
  "sitemap", "robots", "favicon", "icon", "opengraph",
  "tipsite", "www", "support", "help", "me", "creator", "creators",
  "null", "undefined", "anonymous", "system", "user", "users",
  "settings", "login", "logout", "payments", "billing", "webhook",
  "faq", "static", "security", "official", "staff", "editor",
]);

export type HandleCheck = { ok: true; handle: string } | { ok: false; message: string };

export function checkHandle(raw: string): HandleCheck {
  const handle = raw.toLowerCase().trim();
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, message: "3 to 20 letters, numbers or _" };
  if (RESERVED_HANDLES.has(handle)) return { ok: false, message: "That handle is reserved. Try another" };
  return { ok: true, handle };
}

export type HandleResult =
  | { status: "ok"; handle: string }
  | { status: "taken" }
  | { status: "already_set" }
  | { status: "no_handle" }
  | { status: "same" }
  | { status: "already_renamed" }
  | { status: "closed" }
  | { status: "not_found" };

// The first claim. Fails when the creator already has a handle or the name is in use
// now or was given up by someone.
export async function claimHandle(db: LedgerDb, googleId: string, handle: string): Promise<HandleResult> {
  return db.begin(async (tx): Promise<HandleResult> => {
    await tx`select pg_advisory_xact_lock(hashtext('freetip.handle'))`;
    const users = await tx<{ id: string; handle: string | null }[]>`
      select id::text, handle from users where google_id = ${googleId} for update
    `;
    if (!users.length) return { status: "not_found" };
    if (users[0].handle) return { status: "already_set" };

    if (await isUsed(tx, handle)) return { status: "taken" };
    await tx`update users set handle = ${handle} where id = ${Number(users[0].id)}`;
    return { status: "ok", handle };
  });
}

// The one allowed change. The old handle goes to handle_history and an audit row is
// written (no personal data). The unique index on handle_history.user_id makes
// "once only" hold even if two requests run at once.
export async function renameHandle(
  db: LedgerDb,
  googleId: string,
  handle: string,
  by: { role: "creator" | "owner"; reason: string } = { role: "creator", reason: "changed by the creator" },
): Promise<HandleResult> {
  return db.begin(async (tx): Promise<HandleResult> => {
    await tx`select pg_advisory_xact_lock(hashtext('freetip.handle'))`;
    const users = await tx<{ id: string; handle: string | null; google_id: string }[]>`
      select id::text, handle, google_id from users where google_id = ${googleId} for update
    `;
    if (!users.length) return { status: "not_found" };
    const u = users[0];
    if (isClosedGoogleId(u.google_id)) return { status: "closed" };
    if (!u.handle) return { status: "no_handle" };
    if (u.handle === handle) return { status: "same" };

    const done = await tx<{ one: number }[]>`select 1 as one from handle_history where user_id = ${Number(u.id)}`;
    if (done.length) return { status: "already_renamed" };

    if (await isUsed(tx, handle)) return { status: "taken" };

    await tx`update users set handle = ${handle} where id = ${Number(u.id)}`;
    await tx`insert into handle_history (old_handle, user_id) values (${u.handle}, ${Number(u.id)})`;
    await tx`
      insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
      values (${by.role === "creator" ? Number(u.id) : null}, ${by.role}, 'handle.renamed', 'user', ${u.id},
              ${{ from: u.handle, to: handle }}::jsonb, ${by.reason})
    `;
    return { status: "ok", handle };
  });
}

// Taken now by anyone (closed accounts keep theirs), or given up earlier by anyone.
async function isUsed(tx: Query, handle: string): Promise<boolean> {
  const rows = await tx<{ one: number }[]>`
    select 1 as one from users where handle = ${handle}
    union all
    select 1 as one from handle_history where old_handle = ${handle}
    limit 1
  `;
  return rows.length > 0;
}

export const HANDLE_MESSAGE: Record<Exclude<HandleResult["status"], "ok">, string> = {
  taken: "That handle is taken. Try another",
  already_set: "Your handle is already set",
  no_handle: "Claim your handle first",
  same: "That is already your handle",
  already_renamed: "You have already changed your handle once, and it cannot be changed again. Send us a message through the contact form if there is a real problem",
  closed: "This account is closed",
  not_found: "We could not find your account. Sign in again",
};
