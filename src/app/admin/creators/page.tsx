import { getDb } from "@/lib/db";
import { setCreatorStatus } from "@/app/actions/admin";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";

interface CreatorRow {
  id: number;
  name: string | null;
  email: string;
  handle: string | null;
  creator_status: "pending" | "active" | "suspended";
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

export default async function AdminCreatorsPage() {
  await requireOwner();
  const db = getDb();

  const creators: CreatorRow[] = db
    ? await db<CreatorRow[]>`
        select id, name, email, handle, creator_status,
               yt_channel_name, yt_channel_url,
               min_tip_paise, message_max_chars, created_at
        from users
        order by created_at desc
      `
    : [];

  if (!creators.length) {
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

      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Handle</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Settings</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {creators.map((c) => {
              const approve = setCreatorStatus.bind(null, c.id, "active");
              const suspend = setCreatorStatus.bind(null, c.id, "suspended");
              const reset = setCreatorStatus.bind(null, c.id, "pending");

              return (
                <tr key={c.id} className="bg-surface/30 hover:bg-surface/60 transition-colors">
                  {/* Creator */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{c.name ?? "—"}</p>
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
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.creator_status]}`}>
                      {c.creator_status}
                    </span>
                  </td>

                  {/* Settings */}
                  <td className="numeric px-4 py-3 text-muted">
                    <span>₹{Math.round(c.min_tip_paise / 100)} min</span>
                    <span className="mx-1.5 text-control">·</span>
                    <span>{c.message_max_chars} chars</span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
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
                    </div>
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
