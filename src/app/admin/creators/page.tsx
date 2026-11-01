import Link from "next/link";
import { getDb } from "@/lib/db";
import { setCreatorStatus, rejectCreatorOnboarding, resetCreatorAccent, adminCloseCreator } from "@/app/actions/admin";
import { BLOCKER_MESSAGE, CLOSED_EMAIL_DOMAIN, type CloseBlocker } from "@/lib/account-close";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";
import { DEFAULT_ACCENT, safeAccent } from "@/lib/accent";

type OnboardingState = "not_started" | "submitted" | "active" | "rejected";

interface CreatorRow {
  id: number;
  name: string | null;
  email: string;
  handle: string | null;
  creator_status: "pending" | "active" | "suspended";
  onboarding_state: OnboardingState;
  upi_vpa: string | null;
  yt_channel_name: string | null;
  yt_channel_url: string | null;
  min_tip_paise: number;
  message_max_chars: number;
  created_at: string;
}

const STATUS_STYLES = {
  pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  active: "bg-accent/10 text-accent border-accent/20",
  suspended: "bg-red-400/10 text-red-400 border-red-400/20",
};

const ONBOARDING_STYLES: Record<string, string> = {
  not_started: "bg-surface text-muted border-control",
  submitted: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  active: "bg-accent/10 text-accent border-accent/20",
  rejected: "bg-red-400/10 text-red-400 border-red-400/20",
};

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; q?: string }>;
}) {
  await requireOwner();
  const { blocked, q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const blockedReason = blocked && blocked in BLOCKER_MESSAGE ? (blocked as CloseBlocker) : null;
  const db = getDb();

  const creators: CreatorRow[] = db
    ? await db<CreatorRow[]>`
        select id, name, email, handle, creator_status, onboarding_state, upi_vpa,
               yt_channel_name, yt_channel_url,
               min_tip_paise, message_max_chars, created_at
        from users
        where ${q === ""}::boolean or name ilike ${like} or email ilike ${like} or handle ilike ${like}
              or yt_channel_name ilike ${like} or upi_vpa ilike ${like}
        order by created_at desc
        limit 500
      `
    : [];

  // Page colours (migration 0026), read apart so this page loads before it is run.
  const accents = new Map<number, string>();
  if (db && creators.length) {
    try {
      const rows = await db<{ id: number; accent: string | null }[]>`select id, accent from users where accent is not null`;
      for (const r of rows) accents.set(r.id, safeAccent(r.accent));
    } catch (err) {
      console.error("Admin creators: could not read the accent colours.", err);
    }
  }

  if (!creators.length && !q) {
    return (
      <AdminEmptyState
        title="No creators yet"
        description="Creators appear here once they sign in with Google. You can approve or suspend them from this page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Creators</h1>
        <p className="text-sm text-muted">
          {creators.length} account{creators.length !== 1 ? "s" : ""}
        </p>
      </div>

      <form action="/admin/creators" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, handle, channel or UPI ID"
          aria-label="Search creators"
          className="h-10 w-full max-w-md rounded-xl border border-control bg-surface px-3 text-sm text-text"
        />
        <button type="submit" className="rounded-xl border border-control px-4 text-sm text-text hover:border-muted">
          Search
        </button>
      </form>
      {q && !creators.length && <p className="text-sm text-muted">No creator matches &ldquo;{q}&rdquo;.</p>}

      {blockedReason && (
        <p role="alert" className="rounded-2xl border border-control bg-surface px-4 py-3 text-sm text-text">
          Not closed: {BLOCKER_MESSAGE[blockedReason]}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Handle</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Payout</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {creators.map((c) => {
              const approve = setCreatorStatus.bind(null, c.id, "active");
              const suspend = setCreatorStatus.bind(null, c.id, "suspended");
              const reset = setCreatorStatus.bind(null, c.id, "pending");
              const reject = rejectCreatorOnboarding.bind(null, c.id);
              const close = adminCloseCreator.bind(null, c.id);
              const isClosed = c.email.endsWith(CLOSED_EMAIL_DOMAIN);

              return (
                <tr key={c.id} className="bg-surface/30 hover:bg-surface/60 transition-colors">
                  {/* Creator */}
                  <td className="px-4 py-3">
                    <Link href={`/admin/creators/${c.id}`} className="font-medium text-text hover:underline">
                      {c.name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted truncate max-w-[180px]">{c.email}</p>
                    {c.yt_channel_name && (
                      <a
                        href={c.yt_channel_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted hover:text-text transition-colors truncate block max-w-[180px]"
                      >
                        {c.yt_channel_name}
                      </a>
                    )}
                  </td>

                  {/* Handle */}
                  <td className="numeric px-4 py-3 text-text">
                    {c.handle ?? <span className="text-muted">not set</span>}
                    {accents.has(c.id) && accents.get(c.id) !== DEFAULT_ACCENT && (
                      <form action={resetCreatorAccent.bind(null, c.id)} className="mt-1 flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block size-3 rounded-full border border-control"
                          style={{ backgroundColor: accents.get(c.id) }}
                        />
                        <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">
                          Reset colour
                        </button>
                      </form>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.creator_status]}`}>
                      {c.creator_status}
                    </span>
                  </td>

                  {/* Payout */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ONBOARDING_STYLES[c.onboarding_state]}`}>
                      {c.onboarding_state.replace("_", " ")}
                    </span>
                    {c.upi_vpa && (
                      <p className="numeric mt-1 text-xs text-muted truncate max-w-[160px]">
                        {c.upi_vpa}
                      </p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {isClosed ? (
                      <span className="text-xs text-muted">Closed, kept for the records</span>
                    ) : (
                    <div className="flex flex-wrap gap-2">
                      {c.creator_status !== "active" && (
                        <form action={approve}>
                          <button
                            type="submit"
                            className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                          >
                            Approve
                          </button>
                        </form>
                      )}
                      {c.creator_status === "active" && (
                        <form action={suspend}>
                          <button
                            type="submit"
                            className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
                          >
                            Suspend
                          </button>
                        </form>
                      )}
                      {c.creator_status === "suspended" && (
                        <form action={reset}>
                          <button
                            type="submit"
                            className="rounded-lg border border-control px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-text/30 hover:text-text"
                          >
                            Reset to pending
                          </button>
                        </form>
                      )}
                      {c.creator_status === "pending" && c.onboarding_state === "submitted" && (
                        <form action={reject}>
                          <button
                            type="submit"
                            className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
                          >
                            Reject
                          </button>
                        </form>
                      )}
                      <details className="text-xs">
                        <summary className="cursor-pointer rounded-lg border border-control px-3 py-1 font-medium text-muted transition-colors hover:text-text">
                          Close account
                        </summary>
                        <form action={close} className="mt-2 space-y-2">
                          <p className="max-w-[220px] text-muted">
                            Permanent. Removes their profile and sounds; money records stay.
                          </p>
                          <button
                            type="submit"
                            className="rounded-lg border border-control px-3 py-1 font-medium text-text transition-colors hover:border-muted"
                          >
                            Confirm close
                          </button>
                        </form>
                      </details>
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
