import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { approveHandleChange, rejectHandleChange } from "@/app/actions/admin";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  current_handle: string;
  requested_handle: string;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  created_at: Date;
  decided_at: Date | null;
};

const LIMIT = 200;

// Handle change requests from creators. Approving renames at once (the old link and
// QR code stop working, the old handle stays reserved for that creator); rejecting
// leaves their one change unused. Each creator has one change, ever.
export default async function AdminHandleRequestsPage() {
  await requireOwner();
  const db = adminDb();

  const result = db
    ? await load("the handle requests", async () => {
        const rows = await db<RequestRow[]>`
          select r.id::text, r.user_id::text, u.name, u.email, r.current_handle, r.requested_handle,
                 r.status, r.decision_note, r.created_at, r.decided_at
          from handle_requests r join users u on u.id = r.user_id
          order by (r.status = 'pending') desc, coalesce(r.decided_at, r.created_at) desc
          limit ${LIMIT + 1}
        `;
        const [{ n }] = await db<{ n: string }[]>`select count(*)::text as n from handle_requests`;
        return { rows: rows.slice(0, LIMIT), total: Number(n) };
      })
    : null;

  const pending = result?.ok ? result.data.rows.filter((r) => r.status === "pending") : [];
  const decided = result?.ok ? result.data.rows.filter((r) => r.status !== "pending") : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Handle requests"
        title="Handle changes"
        note={
          <>
            {result?.ok ? `${pending.length} waiting. ` : ""}A creator gets one change, ever. Approving moves them at
            once; the old link stops working and the old handle stays theirs.
          </>
        }
      />

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead
          message="Could not read the handle requests. Has db/migrations/0031_handle_requests.sql been run in Neon?"
          detail={result.error}
        />
      ) : (
        <>
          {result.data.rows.length === 0 && (
            <AdminEmptyState
              title="No requests yet"
              description="When a creator asks to change their handle it appears here for you to approve or reject."
            />
          )}

          {pending.length > 0 && (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id} className="space-y-3 rounded-surface border border-control bg-surface p-4">
                  <div>
                    <p className="text-sm text-text">
                      <span className="numeric font-medium">{r.current_handle}</span> →{" "}
                      <span className="numeric font-medium">{r.requested_handle}</span>
                    </p>
                    <p className="text-xs text-muted">
                      <Link href={`/admin/creators/${r.user_id}`} className="underline underline-offset-2 hover:text-text">
                        {r.name ?? r.email}
                      </Link>{" "}
                      · asked {fmtIST(r.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-4">
                    <ConfirmAction
                      action={approveHandleChange.bind(null, Number(r.id))}
                      label="Approve"
                      confirmLabel={`Move them to ${r.requested_handle}`}
                      pendingLabel="Approving…"
                      tone="primary"
                      description={`Renames ${r.current_handle} to ${r.requested_handle} at once. The old link and QR code stop working. This is their one change.`}
                    />
                    <ActionForm
                      action={rejectHandleChange.bind(null, Number(r.id))}
                      label="Reject"
                      pendingLabel="Rejecting…"
                      tone="danger"
                      note={{
                        name: "note",
                        label: `Reason for rejecting ${r.requested_handle}`,
                        placeholder: "Reason (optional, the creator sees it)",
                        maxLength: 300,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {decided.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Decided</h2>
              <ul className="divide-y divide-control rounded-surface border border-control bg-surface">
                {decided.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2 text-text">
                      <span className="numeric">{r.current_handle}</span> →{" "}
                      <span className="numeric">{r.requested_handle}</span>
                      <StatusBadge status={r.status} />
                    </p>
                    <p className="text-xs text-muted">
                      {r.name ?? r.email}
                      {r.decided_at ? ` · ${fmtIST(r.decided_at)}` : ""}
                      {r.decision_note ? ` · “${r.decision_note}”` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.data.total > result.data.rows.length && (
            <p className="text-xs text-muted">
              Showing the {result.data.rows.length} newest of {result.data.total} requests.
            </p>
          )}
        </>
      )}
    </div>
  );
}
