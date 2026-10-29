import { getDb } from "@/lib/db";
import { adminDeleteSound } from "@/app/actions/admin";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { requireOwner } from "@/lib/owner-auth";

interface SoundRow {
  id: number;
  handle: string | null;
  name: string;
  emoji: string | null;
  min_paise: number;
  enabled: boolean;
  blob_url: string;
  duration_ms: number;
  size_bytes: number;
  created_at: string;
}

// Every creator's uploaded sounds, newest first, so the owner can listen to one
// and remove it. A removed sound is cleared from fans' picks and from the
// creator's default.
export default async function AdminSoundsPage() {
  await requireOwner();
  const db = getDb();

  let sounds: SoundRow[] = [];
  let missing = false;
  if (db) {
    try {
      sounds = await db<SoundRow[]>`
        select s.id, u.handle, s.name, s.emoji, s.min_paise, s.enabled, s.blob_url,
               s.duration_ms, s.size_bytes, s.created_at
        from creator_sounds s
        join users u on u.id = s.creator_id
        order by s.created_at desc
        limit 500
      `;
    } catch {
      missing = true;
    }
  }

  if (missing) {
    return (
      <AdminEmptyState
        title="Sounds are not set up"
        description="Run db/migrations/0013_creator_sounds.sql in Neon to switch the soundboard on."
      />
    );
  }
  if (!sounds.length) {
    return (
      <AdminEmptyState
        title="No sounds yet"
        description="Sounds creators upload appear here, where you can listen to them and remove any that break the rules."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Sounds</h1>
        <p className="text-sm text-muted">
          {sounds.length} sound{sounds.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-control">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-control bg-surface/60">
              <th className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Sound</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Listen</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Size</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control">
            {sounds.map((s) => (
              <tr key={s.id} className="bg-surface/30 transition-colors hover:bg-surface/60">
                <td className="numeric px-4 py-3 text-text">{s.handle ?? "—"}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-text">
                    {s.emoji} {s.name}
                  </p>
                  <p className="text-xs text-muted">
                    {s.min_paise ? `from ₹${Math.ceil(s.min_paise / 100)}` : "any tip"}
                    {s.enabled ? "" : " · hidden from fans"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <audio controls preload="none" src={s.blob_url} className="h-9 w-56" />
                </td>
                <td className="numeric px-4 py-3 text-muted">
                  {(s.duration_ms / 1000).toFixed(1)} s · {(s.size_bytes / 1024).toFixed(0)} KB
                </td>
                <td className="px-4 py-3">
                  <form action={adminDeleteSound.bind(null, s.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/20"
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
