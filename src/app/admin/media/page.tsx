import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { adminApproveMedia, adminRemoveMedia, adminTakeDownPageAsset } from "@/app/actions/admin";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type MediaRow = {
  id: string;
  handle: string | null;
  kind: "gif" | "image" | "webm";
  name: string;
  blob_url: string;
  size_bytes: number;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  placement: string;
  enabled: boolean;
  review_state: "new" | "approved" | "removed";
  created_at: Date;
};

const LIMIT = 200;

// Every creator's alert media. New uploads play at once; the owner looks them over here
// and takes down what breaks the rules. Any file still waiting (held under the old
// first-upload rule) comes first.
export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOwner();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const idMatch = /^\d{1,12}$/.test(q) ? Number(q) : -1;
  const db = adminDb();

  const result = db
    ? await load("the alert media", async () => {
        const files = await db<MediaRow[]>`
          select m.id::text, u.handle, m.kind, m.name, m.blob_url, m.size_bytes, m.duration_ms,
                 m.width, m.height, m.placement, m.enabled, m.review_state, m.created_at
          from creator_media m
          join users u on u.id = m.creator_id
          where ${q === ""}::boolean or m.id = ${idMatch} or u.handle ilike ${like} or m.name ilike ${like}
          order by (m.review_state = 'new') desc, m.created_at desc, m.id desc
          limit ${LIMIT}
        `;
        const [c] = await db<{ total: string; waiting: string }[]>`
          select count(*)::text as total, count(*) filter (where m.review_state = 'new')::text as waiting
          from creator_media m join users u on u.id = m.creator_id
          where ${q === ""}::boolean or m.id = ${idMatch} or u.handle ilike ${like} or m.name ilike ${like}
        `;
        return { files, total: Number(c.total), waiting: Number(c.waiting) };
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alert media"
        title="Creator alert media"
        note="Uploads play at once. A file still marked as waiting is from before that change: approve it to let it play. Look at each one for adult, hateful or copyrighted material and take it down if it breaks the rules. Taking a file down erases it and is kept in the audit history."
      />

      <form action="/admin/media" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search handle, file name or file id"
          aria-label="Search alert media"
          className={`${FIELD_CLASS} w-full max-w-md`}
        />
        <button type="submit" className={buttonClass("quiet", "md")}>
          Search
        </button>
        {q && (
          <Link href="/admin/media" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead
          message="Could not read the alert media. Has db/migrations/0036_media_and_rules.sql been run in Neon?"
          detail={result.error}
        />
      ) : result.data.files.length === 0 ? (
        q ? (
          <p className="text-sm text-muted">No file matches “{q}”.</p>
        ) : (
          <AdminEmptyState
            title="No alert media yet"
            description="Files creators upload go live at once and appear here for you to look over. Take down anything that breaks the rules."
          />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {result.data.waiting > 0 ? (
              <strong className="font-medium text-text">{result.data.waiting} waiting for approval. </strong>
            ) : null}
            Showing {result.data.files.length} of {result.data.total} file{result.data.total === 1 ? "" : "s"}
            {result.data.total > result.data.files.length ? " (waiting first, then newest; search to find older ones)" : ""}
          </p>
          <div data-lenis-prevent className="max-h-[75vh] overflow-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <caption className="sr-only">Creator alert media, files waiting for approval first</caption>
              <thead className="sticky top-0 z-10 bg-raised">
                <tr className="border-b border-control">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">File</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Look</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {result.data.files.map((m) => (
                  <tr key={m.id} className="align-top transition-colors hover:bg-raised">
                    <td className="numeric px-4 py-3 text-text">{m.handle ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{m.name}</p>
                      <p className="text-xs text-muted">
                        {m.kind.toUpperCase()} · {(m.size_bytes / 1024).toFixed(0)} KB
                        {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                        {m.duration_ms ? ` · ${(m.duration_ms / 1000).toFixed(1)} s` : ""} · {m.placement} ·{" "}
                        {fmtIST(m.created_at, "date")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {m.review_state === "removed" ? (
                        <span className="text-xs text-muted">File erased</span>
                      ) : m.kind === "webm" ? (
                        <video src={m.blob_url} controls muted loop preload="none" aria-label={`Preview of ${m.name}`} className="max-h-40 w-56 rounded-field bg-ground" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- the owner's review of a creator's own upload
                        <img src={m.blob_url} alt={`Preview of ${m.name}`} loading="lazy" decoding="async" className="max-h-40 w-56 rounded-field bg-ground object-contain" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {m.review_state === "new"
                        ? "Waiting for approval"
                        : m.review_state === "removed"
                          ? "Taken down"
                          : m.enabled
                            ? "Playing"
                            : "Switched off by the creator"}
                    </td>
                    <td className="space-y-2 px-4 py-3">
                      {m.review_state === "new" && (
                        <ConfirmAction
                          action={adminApproveMedia.bind(null, Number(m.id))}
                          label="Approve"
                          confirmLabel="Approve file"
                          pendingLabel="Approving…"
                          description={`“${m.name}” will play on ${m.handle ?? "the creator"}'s alerts.`}
                          tone="primary"
                        />
                      )}
                      {m.review_state !== "removed" && (
                        <ConfirmAction
                          action={adminRemoveMedia.bind(null, Number(m.id))}
                          label="Take down"
                          confirmLabel="Take down file"
                          pendingLabel="Taking down…"
                          description={`Erases “${m.name}” for good. The creator sees that Freetip took it down.`}
                          askReason
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PageAssetsSection like={like} idMatch={idMatch} all={q === ""} />
    </div>
  );
}

type PageAssetRow = {
  id: string;
  creator_id: string;
  handle: string | null;
  kind: "image" | "gif" | "webm";
  name: string;
  blob_url: string;
  poster_url: string | null;
  size_bytes: number;
  review_state: "approved" | "removed";
  created_at: Date;
};

// The pictures the owner put on creators' tip pages (page builder phase 3). Only the owner uploads
// them, so this is a list to find and take down a file, not a queue. A taken-down file is erased
// and the page that used it shows its normal look.
async function PageAssetsSection({ like, idMatch, all }: { like: string; idMatch: number; all: boolean }) {
  const db = adminDb();
  if (!db) return null;
  const result = await load("the tip page pictures", async () =>
    db<PageAssetRow[]>`
      select a.id::text, a.creator_id::text, u.handle, a.kind, a.name, a.blob_url, a.poster_url, a.size_bytes, a.review_state, a.created_at
      from page_assets a
      join users u on u.id = a.creator_id
      where ${all}::boolean or a.id = ${idMatch} or u.handle ilike ${like} or a.name ilike ${like}
      order by a.created_at desc, a.id desc
      limit ${LIMIT}
    `,
  );
  return (
    <section className="space-y-3" aria-labelledby="page-assets-title">
      <h2 id="page-assets-title" className="text-lg font-semibold text-text">
        Tip page pictures
      </h2>
      <p className="text-sm text-muted">
        Pictures, GIFs and videos you uploaded in the tip page editor. Taking one down erases its files; a page that used it then shows its normal look.
      </p>
      {!result.ok ? (
        <CouldNotRead message="Could not read the tip page pictures. Has db/migrations/0052_page_assets.sql been run in Neon?" detail={result.error} />
      ) : result.data.length === 0 ? (
        <p className="text-sm text-muted">No tip page pictures yet.</p>
      ) : (
        <div data-lenis-prevent className="max-h-[60vh] overflow-auto rounded-surface border border-control">
          <table className="w-full text-sm">
            <caption className="sr-only">Pictures on creators&apos; tip pages, newest first</caption>
            <thead className="sticky top-0 z-10 bg-raised">
              <tr className="border-b border-control">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">File</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Look</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control bg-surface">
              {result.data.map((a) => (
                <tr key={a.id} className="align-top transition-colors hover:bg-raised">
                  <td className="px-4 py-3">
                    <Link href={`/admin/creators/${a.creator_id}/page`} className="numeric text-text underline">
                      {a.handle ?? a.creator_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{a.name}</p>
                    <p className="text-xs text-muted">
                      {a.kind === "image" ? "Picture" : a.kind === "gif" ? "GIF or animation" : "Video"} · {(a.size_bytes / 1024).toFixed(0)} KB · {fmtIST(a.created_at, "date")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {a.review_state === "removed" ? (
                      <span className="text-xs text-muted">File erased</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, a small preview (the first frame for a GIF or video)
                      <img src={a.poster_url ?? a.blob_url} alt={`Preview of ${a.name}`} loading="lazy" decoding="async" className="max-h-32 w-48 rounded-field bg-ground object-contain" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{a.review_state === "removed" ? "Removed" : "In the library"}</td>
                  <td className="px-4 py-3">
                    {a.review_state !== "removed" && (
                      <ConfirmAction
                        action={adminTakeDownPageAsset.bind(null, Number(a.id))}
                        label="Take down"
                        confirmLabel="Take down file"
                        pendingLabel="Taking down…"
                        description={`Erases “${a.name}” for good. A tip page that uses it shows its normal look instead.`}
                        askReason
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
