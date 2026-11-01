import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass } from "@/components/admin/tones";
import { getFeatureMatrix } from "@/lib/admin/features-queries";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { FEATURES } from "@/lib/plans";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

const BUILT = FEATURES.filter((f) => f.built);
const PLANNED = FEATURES.filter((f) => !f.built);

// Who has which paid feature. Read only: switch a feature on or off from the
// creator's own page (the link in the first column).
export default async function AdminFeaturesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireOwner();
  const onlyOn = (await searchParams).all !== "1";
  const db = adminDb();
  const result = db ? await getFeatureMatrix(db, { onlyOn }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Paid features"
        title="Who has what"
        note="A creator gets nothing until you switch it on for them. A tick is what the site actually shows them: a timestamp extra counts as off while Stream timestamps is off. Open a creator to change their switches."
      />

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead message="Could not read the paid features. Has migration 0035 been run in Neon?" detail={result.error} />
      ) : (
        <>
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
              <div className="max-h-[75vh] overflow-auto rounded-surface border border-control">
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
