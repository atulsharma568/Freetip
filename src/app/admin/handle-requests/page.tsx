import Link from "next/link";
import { getDb } from "@/lib/db";
import { approveHandleChange, rejectHandleChange } from "@/app/actions/admin";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";

interface RequestRow {
  id: number;
  user_id: number;
  name: string | null;
  email: string;
  current_handle: string;
  requested_handle: string;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

const BLOCKED: Record<string, string> = {
  taken: "Someone else has that handle now. Reject the request with a note.",
  already_renamed: "This creator has already used their one change.",
  same: "The creator already has that handle.",
  no_handle: "The creator has no handle.",
  closed: "The account is closed.",
  not_found: "The account was not found.",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

// Handle change requests from creators. Approving renames at once (the old link and
// QR code stop working, the old handle stays reserved for that creator); rejecting
// leaves their one change unused. Each creator has one change, ever.
export default async function AdminHandleRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string }>;
}) {
  await requireOwner();
  const { blocked } = await searchParams;
  const db = getDb();

  let rows: RequestRow[] = [];
  let missing = false;
  if (db) {
    try {
      rows = await db<RequestRow[]>`
        select r.id, r.user_id, u.name, u.email, r.current_handle, r.requested_handle,
               r.status, r.decision_note, r.created_at, r.decided_at
        from handle_requests r join users u on u.id = r.user_id
        order by (r.status = 'pending') desc, coalesce(r.decided_at, r.created_at) desc
        limit 200
      `;
    } catch {
      missing = true;
    }
  }

  if (missing) {
    return (
      <AdminEmptyState
        title="Handle requests are not set up"
        description="Run db/migrations/0031_handle_requests.sql in Neon to switch them on."
      />
    );
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Handle requests</h1>
        <p className="text-sm text-muted">
          {pending.length} waiting. A creator gets one change, ever. Approving moves them at once; the old link stops
          working and the old handle stays theirs.
        </p>
      </div>

      {blocked && BLOCKED[blocked] && (
        <p role="alert" className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-400">
          Not approved: {BLOCKED[blocked]}
        </p>
      )}

      {!rows.length && (
        <AdminEmptyState
          title="No requests yet"
          description="When a creator asks to change their handle it appears here for you to approve or reject."
        />
      )}

      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-control bg-surface/30 p-4">
              <div>
                <p className="text-sm text-text">
                  <span className="numeric font-medium">{r.current_handle}</span> →{" "}
                  <span className="numeric font-medium">{r.requested_handle}</span>
                </p>
                <p className="text-xs text-muted">
                  <Link href={`/admin/creators/${r.user_id}`} className="underline underline-offset-2 hover:text-text">
                    {r.name ?? r.email}
                  </Link>{" "}
                  · asked {fmt(r.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={approveHandleChange.bind(null, r.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    Approve
                  </button>
                </form>
                <form action={rejectHandleChange.bind(null, r.id)} className="flex items-center gap-2">
                  <input
                    name="note"
                    maxLength={300}
                    placeholder="Reason (optional, the creator sees it)"
                    aria-label={`Reason for rejecting ${r.requested_handle}`}
                    className="h-8 w-64 rounded-lg border border-control bg-ground px-3 text-xs text-text"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Decided</h2>
          <ul className="divide-y divide-control rounded-2xl border border-control">
            {decided.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <p className="text-text">
                  <span className="numeric">{r.current_handle}</span> → <span className="numeric">{r.requested_handle}</span>{" "}
                  <span className={r.status === "approved" ? "text-accent" : "text-red-400"}>· {r.status}</span>
                </p>
                <p className="text-xs text-muted">
                  {r.name ?? r.email}
                  {r.decided_at ? ` · ${fmt(r.decided_at)}` : ""}
                  {r.decision_note ? ` · “${r.decision_note}”` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
