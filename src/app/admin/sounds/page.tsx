import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { adminDeleteSound } from "@/app/actions/admin";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type SoundRow = {
  id: string;
  handle: string | null;
  name: string;
  emoji: string | null;
  min_paise: number;
  enabled: boolean;
  blob_url: string;
  duration_ms: number;
  size_bytes: number;
  created_at: Date;
};

const LIMIT = 200;

// Every creator's uploaded sounds, newest first, so the owner can listen to one
// and remove it. A removed sound is cleared from fans' picks and from the
// creator's default.
export default async function AdminSoundsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOwner();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const idMatch = /^\d{1,12}$/.test(q) ? Number(q) : -1;
  const db = adminDb();

  const result = db
    ? await load("the sounds", async () => {
        const sounds = await db<SoundRow[]>`
          select s.id::text, u.handle, s.name, s.emoji, s.min_paise, s.enabled, s.blob_url,
                 s.duration_ms, s.size_bytes, s.created_at
          from creator_sounds s
          join users u on u.id = s.creator_id
          where ${q === ""}::boolean or s.id = ${idMatch} or u.handle ilike ${like} or s.name ilike ${like}
          order by s.created_at desc, s.id desc
          limit ${LIMIT}
        `;
        const [c] = await db<{ n: string }[]>`
          select count(*)::text as n
          from creator_sounds s join users u on u.id = s.creator_id
          where ${q === ""}::boolean or s.id = ${idMatch} or u.handle ilike ${like} or s.name ilike ${like}
        `;
        return { sounds, total: Number(c.n) };
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sounds"
        title="Creator sounds"
        note="Listen to what creators uploaded and remove any that break the rules. A removed sound is cleared from fans' picks and from the creator's default, and the removal is kept in the audit history."
      />

      <form action="/admin/sounds" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search handle, sound name or sound id"
          aria-label="Search sounds"
          className={`${FIELD_CLASS} w-full max-w-md`}
        />
        <button type="submit" className={buttonClass("quiet", "md")}>
          Search
        </button>
        {q && (
          <Link href="/admin/sounds" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead
          message="Could not read the sounds. Has db/migrations/0013_creator_sounds.sql been run in Neon?"
          detail={result.error}
        />
      ) : result.data.sounds.length === 0 ? (
        q ? (
          <p className="text-sm text-muted">No sound matches “{q}”.</p>
        ) : (
          <AdminEmptyState
            title="No sounds yet"
            description="Sounds creators upload appear here, where you can listen to them and remove any that break the rules."
          />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Showing {result.data.sounds.length} of {result.data.total} sound{result.data.total === 1 ? "" : "s"}
            {result.data.total > result.data.sounds.length ? " (newest first; search to find older ones)" : ""}
          </p>
          <div className="max-h-[75vh] overflow-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <caption className="sr-only">Creator sounds, newest first</caption>
              <thead className="sticky top-0 z-10 bg-raised">
                <tr className="border-b border-control">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Sound</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Listen</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Size</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {result.data.sounds.map((s) => (
                  <tr key={s.id} className="align-top transition-colors hover:bg-raised">
                    <td className="numeric px-4 py-3 text-text">{s.handle ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">
                        {s.emoji} {s.name}
                      </p>
                      <p className="text-xs text-muted">
                        {s.min_paise ? `from ₹${Math.ceil(s.min_paise / 100)}` : "any tip"}
                        {s.enabled ? "" : " · hidden from fans"} · {fmtIST(s.created_at, "date")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <audio controls preload="none" src={s.blob_url} aria-label={`Listen to ${s.name}`} className="h-9 w-56" />
                    </td>
                    <td className="numeric px-4 py-3 text-muted">
                      {(s.duration_ms / 1000).toFixed(1)} s · {(s.size_bytes / 1024).toFixed(0)} KB
                    </td>
                    <td className="px-4 py-3">
                      <ConfirmAction
                        action={adminDeleteSound.bind(null, Number(s.id))}
                        label="Remove"
                        confirmLabel="Remove sound"
                        pendingLabel="Removing…"
                        description={`Deletes “${s.name}” and its file for good. Fans who picked it fall back to the default.`}
                        askReason
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
