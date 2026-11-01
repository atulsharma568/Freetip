import Link from "next/link";
import { TONE_BADGE, TONE_MARK } from "@/components/admin/tones";
import { cronJobs, describeSchedule, envStatus } from "@/lib/admin/health";
import { requireOwner } from "@/lib/owner-auth";
import { DefinitionNote } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

// The scheduled jobs and which server settings are set. Presence only: a value is
// never read into the page. The site does not record when a job last ran yet.
export default async function AdminHealthPage() {
  await requireOwner();
  const jobs = cronJobs();
  const groups = envStatus();
  const missing = groups.flatMap((g) => g.vars).filter((v) => v.required && !v.set);
  const parkedButSet = groups.flatMap((g) => g.vars).filter((v) => v.parked && v.set);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="System"
        title="Health"
        note="What should be running, and what the server has been given. Nothing here calls a job or shows a secret."
      />

      <section className="space-y-3" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-base font-semibold text-text">
          Server settings
        </h2>
        {missing.length > 0 ? (
          <p role="status" className="max-w-2xl text-sm text-text">
            <span aria-hidden="true">{TONE_MARK.bad} </span>
            {missing.length} required setting{missing.length === 1 ? " is" : "s are"} not set:{" "}
            <span className="numeric">{missing.map((v) => v.name).join(", ")}</span>. Set them in Vercel, then redeploy.
          </p>
        ) : (
          <p className="max-w-2xl text-sm text-muted">Every required setting is set.</p>
        )}
        {parkedButSet.length > 0 && (
          <p role="status" className="max-w-2xl text-sm text-text">
            <span aria-hidden="true">{TONE_MARK.warn} </span>
            Parked by the owner but set: <span className="numeric">{parkedButSet.map((v) => v.name).join(", ")}</span>.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="rounded-surface border border-control bg-surface p-4">
              <h3 className="mb-2 text-sm font-medium text-text">{g.title}</h3>
              <ul className="divide-y divide-control">
                {g.vars.map((v) => {
                  const bad = v.parked ? v.set : v.required && !v.set;
                  return (
                    <li key={v.name} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="numeric block break-all text-text">{v.name}</span>
                        <span className="block text-xs text-muted">
                          {v.what}
                          {v.required || v.parked ? "" : " · optional"}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          bad ? TONE_BADGE.bad : v.set ? TONE_BADGE.good : TONE_BADGE.neutral
                        }`}
                      >
                        <span aria-hidden="true">{bad ? TONE_MARK.bad : v.set ? TONE_MARK.good : ""} </span>
                        {v.set ? "set" : "not set"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <DefinitionNote>
          Set means the variable has a non-empty value on this server. It does not prove the value is right: the
          Razorpay line on the overview says whether the key is live or test.
        </DefinitionNote>
      </section>

      <section className="space-y-3" aria-labelledby="cron-heading">
        <h2 id="cron-heading" className="text-base font-semibold text-text">
          Scheduled jobs
        </h2>
        <div className="overflow-x-auto rounded-surface border border-control">
          <table className="w-full text-sm">
            <caption className="sr-only">Scheduled jobs: path, schedule, what it does, last run</caption>
            <thead className="bg-raised">
              <tr className="border-b border-control">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Job</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Schedule (Vercel)</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">What it does</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Last run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control bg-surface">
              {jobs.map((j) => (
                <tr key={j.path} className="align-top">
                  <td className="numeric px-4 py-3 text-text">{j.path.replace("/api/cron/", "")}</td>
                  <td className="px-4 py-3 text-muted">
                    {j.schedule ? describeSchedule(j.schedule) : "not in vercel.json"}
                  </td>
                  <td className="px-4 py-3 text-text">
                    {j.what}
                    {j.note && <span className="mt-1 block text-xs text-muted">{j.note}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">not recorded yet</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-2xl text-xs text-muted">
          The site does not record when a job last ran or what it returned, so there is no last-run time or failure
          alert yet. To check by hand, see <span className="numeric">OPERATIONS.md</span> section 7 (calling a job with
          the CRON_SECRET), or the cron logs in Vercel. A run history would need a small table written by each job.{" "}
          <Link href="/admin/reconciliation" className="underline">
            Reconciliation
          </Link>{" "}
          shows whether the daily ledger sweep is keeping up.
        </p>
      </section>
    </div>
  );
}
