import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { ActionForm } from "@/components/admin/ActionForm";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { adminGrantDecor, adminRevokeDecor, adminTakeDownDecor } from "@/app/actions/admin";
import { listAllDecor } from "@/lib/decor-library";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { DECOR_ANCHOR_LABELS } from "@/lib/page-doc/decor";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

// Every picture creators uploaded for their tip page (profile picture and decoration). The owner looks
// them over, shares one with other creators by handle (they find it under "Shared with you" on their
// Effects page), withdraws a share, or takes a picture down for good.
export default async function AdminDecorationsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100).toLowerCase();
  const kind = ["avatar", "frame", "banner"].includes(sp.kind ?? "") ? sp.kind : "";
  const db = adminDb();
  const result = db ? await load("the decorations", () => listAllDecor(db)) : null;
  const rows = result?.ok ? result.data.filter((r) => (kind === "" || r.kind === kind) && (q === "" || (r.ownerHandle ?? "").toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || String(r.id) === q)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Decorations"
        title="Creator decorations"
        note="Pictures and decorations creators uploaded for their tip page. Share one with other creators by typing their handles: it appears under “Shared with you” on their Effects page, and they choose whether to wear it. Withdrawing a share, or taking a picture down, stops it showing at once. Everything here is kept in the audit history."
      />

      <form action="/admin/decorations" className="flex flex-wrap gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Search handle, name or id" aria-label="Search decorations" className={`${FIELD_CLASS} w-full max-w-md`} />
        <select name="kind" defaultValue={kind} aria-label="Kind" className={FIELD_CLASS}>
          <option value="">All kinds</option>
          <option value="avatar">Profile pictures</option>
          <option value="frame">Decorations</option>
          <option value="banner">Banners</option>
        </select>
        <button type="submit" className={buttonClass("quiet", "md")}>
          Search
        </button>
        {(q || kind) && (
          <Link href="/admin/decorations" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead message="Could not read the decorations. Has db/migrations/0062_decor_library.sql been run in Neon?" detail={result.error} />
      ) : rows.length === 0 ? (
        q ? (
          <p className="text-sm text-muted">Nothing matches “{q}”.</p>
        ) : (
          <AdminEmptyState title="No decorations yet" description="Pictures creators upload on their Effects page appear here for you to look over and share." />
        )
      ) : (
        <div data-lenis-prevent className="max-h-[80vh] overflow-auto rounded-surface border border-control">
          <table className="w-full text-sm">
            <caption className="sr-only">Creator decorations, newest first</caption>
            <thead className="sticky top-0 z-10 bg-raised">
              <tr className="border-b border-control">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Picture</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Look</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Shared with</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control bg-surface">
              {rows.map((r) => (
                <tr key={r.id} className="align-top transition-colors hover:bg-raised">
                  <td className="px-4 py-3 text-text">{r.ownerHandle ? `@${r.ownerHandle}` : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text">{r.name}</p>
                    <p className="text-xs text-muted">
                      {r.kind === "frame" ? "Decoration" : r.kind === "banner" ? "Banner" : "Profile picture"} · {r.width}×{r.height} · {(r.sizeBytes / 1024).toFixed(0)} KB
                      {r.animated ? " · animated" : ""}
                      {r.kind === "frame" ? ` · placed: ${DECOR_ANCHOR_LABELS[r.placement.anchor].toLowerCase()}, ${r.placement.size}%` : ""} · {fmtIST(new Date(r.createdAt), "date")}
                    </p>
                    <p className="text-xs text-muted">
                      {r.reviewState === "removed" ? "Taken down" : r.wornBy > 0 ? `On ${r.wornBy} tip page${r.wornBy === 1 ? "" : "s"} now` : "Not on any page"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.reviewState === "removed" ? (
                      <span className="text-xs text-muted">File erased</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- the owner's review of a creator's own upload
                      <img
                        src={r.posterUrl ?? r.url}
                        alt={`Preview of ${r.name}`}
                        loading="lazy"
                        decoding="async"
                        className="size-32 rounded-field object-contain"
                        style={{ backgroundImage: "repeating-conic-gradient(rgb(128 128 128 / 0.22) 0% 25%, transparent 0% 50%)", backgroundSize: "14px 14px" }}
                      />
                    )}
                  </td>
                  <td className="space-y-2 px-4 py-3">
                    {r.grants.length === 0 ? (
                      <span className="text-xs text-muted">Nobody</span>
                    ) : (
                      <ul className="space-y-2">
                        {r.grants.map((g) => (
                          <li key={g.creatorId} className="space-y-1">
                            <span className="text-text">{g.handle ? `@${g.handle}` : `#${g.creatorId}`}</span>
                            <ConfirmAction
                              action={adminRevokeDecor.bind(null, r.id, g.creatorId)}
                              label="Withdraw"
                              confirmLabel="Withdraw"
                              pendingLabel="Withdrawing…"
                              description={`“${r.name}” stops showing on ${g.handle ? `@${g.handle}` : "that creator"}'s page.`}
                              tone="quiet"
                              askReason
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="space-y-3 px-4 py-3">
                    {r.reviewState === "approved" && (
                      <>
                        <ActionForm
                          action={adminGrantDecor.bind(null, r.id)}
                          label="Share"
                          pendingLabel="Sharing…"
                          tone="primary"
                          note={{ name: "handles", label: `Creator handles to share ${r.name} with`, placeholder: "handles, e.g. kabir, mira", maxLength: 400 }}
                        />
                        <ConfirmAction
                          action={adminTakeDownDecor.bind(null, r.id)}
                          label="Take down"
                          confirmLabel="Take down picture"
                          pendingLabel="Taking down…"
                          description={`Erases “${r.name}” for good and it stops showing on every page, including those it was shared with.`}
                          askReason
                        />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
