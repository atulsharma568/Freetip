import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass } from "@/components/admin/tones";
import { getFeatureMatrix } from "@/lib/admin/features-queries";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { FEATURES } from "@/lib/plans";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";
import { setCreatorFeatures } from "@/app/actions/admin";
import { RowForm } from "./RowForm";

export const dynamic = "force-dynamic";

const BUILT = FEATURES.filter((f) => f.built);
const PLANNED = FEATURES.filter((f) => !f.built);

// Who has which paid feature. Read only: switch a feature on or off from the
// creator's own page (the link in the first column).
export default async function AdminFeaturesPage({ searchParams }: { searchParams: Promise<{ all?: string; q?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const onlyOn = sp.all !== "1";
  const db = adminDb();
  const result = db ? await getFeatureMatrix(db, { onlyOn, q }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Paid features"
        title="Who has what"
        note="A creator gets nothing until you switch it on for them. A tick is what the site actually shows them: a timestamp extra counts as off while Stream timestamps is off. Search a creator below, tick their features and press Save."
      />

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead message="Could not read the paid features. Has migration 0035 been run in Neon?" detail={result.error} />
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-2" action="/admin/features">
            <input type="hidden" name="all" value="1" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, email or handle"
              aria-label="Search creators"
              className="w-full max-w-sm rounded-surface border border-control bg-surface px-3 py-2 text-sm"
            />
            <button type="submit" className={buttonClass("primary", "sm")}>
              Search
            </button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <span className="numeric text-text">{result.data.withAny}</span> of{" "}
              <span className="numeric text-text">{result.data.creators}</span> creators have at least one feature on.
            </p>
            <Link href={onlyOn ? "/admin/features?all=1" : "/admin/features"} className={buttonClass("quiet", "sm")}>
              {onlyOn ? "Show every creator" : "Show only creators with a feature on"}
            </Link>
          </div>

          {result.data.rows.length === 0 ? (
            <AdminEmptyState
              title="No creator has a feature on"
              description="Open a creator and tick what they are paying for. They then appear here."
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Showing {result.data.rows.length} of {result.data.matching} creator{result.data.matching === 1 ? "" : "s"}
                {result.data.matching > result.data.rows.length ? " (the first of the list; the counts cover everyone)" : ""}.
              </p>
              <div data-lenis-prevent className="max-h-[75vh] overflow-auto rounded-surface border border-control">
                <table className="w-full text-sm">
                  <caption className="sr-only">Built paid features per creator</caption>
                  <thead className="sticky top-0 z-10 bg-raised">
                    <tr className="border-b border-control">
                      <th scope="col" className="sticky left-0 z-10 bg-raised px-4 py-3 text-left font-medium text-muted">
                        Creator
                      </th>
                      {BUILT.map((f) => (
                        <th key={f.key} scope="col" className="min-w-28 px-3 py-3 text-left align-bottom font-medium text-muted">
                          <span className="block text-xs leading-tight">{f.label}</span>
                          <span className="numeric mt-1 block text-text">{result.data.counts[f.key]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-control bg-surface">
                    {result.data.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-raised">
                        <th scope="row" className="sticky left-0 bg-surface px-4 py-2 text-left font-normal">
                          <Link href={`/admin/creators/${r.id}`} className="text-text hover:underline">
                            {r.name ?? r.email}
                          </Link>
                          <span className="numeric block text-xs text-muted">{r.handle ?? "no handle"}</span>
                        </th>
                        {BUILT.map((f) => (
                          <td key={f.key} className="px-3 py-2">
                            {r.effective[f.key] ? (
                              <span className="text-accent">
                                <span aria-hidden="true">✓</span>
                                <span className="sr-only">on</span>
                              </span>
                            ) : (
                              <span className="text-muted">
                                <span aria-hidden="true">·</span>
                                <span className="sr-only">off</span>
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-text">Change a creator&apos;s features</h2>
            {result.data.rows.slice(0, 20).map((r) => (
              <details key={r.id} open={q !== ""} className="rounded-surface border border-control bg-surface p-4">
                <summary className="cursor-pointer text-sm text-text">
                  {r.name ?? r.email} <span className="text-xs text-muted">{r.email}</span>
                </summary>
                <div className="mt-3">
                  <RowForm action={setCreatorFeatures.bind(null, r.id)} granted={r.granted} />
                </div>
              </details>
            ))}
            {result.data.rows.length > 20 && <p className="text-xs text-muted">Search to narrow the list.</p>}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-text">Planned, not built yet</h2>
            <p className="max-w-2xl text-xs text-muted">
              These cannot be switched on. {PLANNED.map((f) => f.label).join(", ")}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
