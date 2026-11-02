import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { SITE_HOST, SITE_NAME } from "@/lib/site";
import { formatRupees } from "@/lib/earnings";
import { RECAP_DAYS, STREAM_GAP_MS, recapSummaryText, type StreamRecap } from "@/lib/stream-recap";
import { DashboardNav } from "../DashboardNav";
import { loadRecapStreams } from "../queries";
import { DashboardShell } from "../parts/DashboardShell";
import { EmptyState, SampleAlert } from "../parts/EmptyState";
import { CopyButton } from "../parts/CopyButton";
import { pillOutline } from "../parts/styles";

export const metadata: Metadata = {
  title: `Recap: ${SITE_NAME}`,
  robots: { index: false },
};

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
});

function dayLabel(r: StreamRecap): string {
  const day = dayFormat.format(r.start);
  // A stream that crossed midnight shows the second day too.
  const endDay = dayFormat.format(r.end);
  return endDay === day ? day : `${day} to ${endDay}`;
}

function timeLabel(r: StreamRecap): string {
  const from = timeFormat.format(r.start);
  const to = timeFormat.format(r.end);
  return from === to ? from : `${from} to ${to}`;
}

export default async function RecapPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;

  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");
  const [user] = await db<{ id: number; handle: string | null; creator_status: string }[]>`
    select id, handle, creator_status from users where google_id = ${googleId}
  `;
  // Nothing to recap until the creator has a link.
  if (!user?.handle) redirect("/dashboard");

  const streams = await loadRecapStreams(user.id);
  const gapHours = STREAM_GAP_MS / (60 * 60 * 1000);

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <div className="space-y-4">
          <DashboardNav current="recap" />
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Recap</h1>
        </div>

        {streams.length === 0 ? (
          <div className="rounded-surface border border-line/60 bg-surface p-6 md:p-8">
            <EmptyState
              sample={<SampleAlert name="Riya" amount={250} message="Great stream today!" />}
              title="No streams to recap yet."
              body={`After a stream with tips, you will see what it earned, how many fans tipped and the biggest tip here. Tips from the last ${RECAP_DAYS} days are used.`}
              cta={
                <CopyButton
                  value={`https://${SITE_HOST}/${user.handle}`}
                  label="Share your link"
                  className={pillOutline}
                />
              }
            />
          </div>
        ) : (
          <ul className="space-y-4">
            {streams.map((r) => (
              <li
                key={r.start.toISOString()}
                className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5 md:p-6"
              >
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-text">{dayLabel(r)}</h2>
                  <p className="numeric text-sm text-muted">{timeLabel(r)} IST</p>
                </div>

                <p className="numeric text-[clamp(1.75rem,7vw,2.5rem)] font-semibold leading-none text-accent">
                  {formatRupees(r.grossPaise)}
                </p>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                  <Stat label="Tips" value={String(r.tips)} />
                  <Stat label="Supporters" value={String(r.supporters)} />
                  <Stat label="Biggest tip" value={formatRupees(r.biggest.amountPaise)} />
                  <Stat label="You'd keep about" value={formatRupees(r.sharePaise)} />
                </dl>

                {r.topSupporters.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-text">Top supporters</h3>
                    <ol className="space-y-1.5 text-sm">
                      {r.topSupporters.map((s) => (
                        <li key={s.name} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 break-words text-text">{s.name}</span>
                          <span className="numeric shrink-0 text-muted">
                            {formatRupees(s.totalPaise)}
                            {s.tips > 1 ? ` in ${s.tips} tips` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {r.anonymousTips > 0 && (
                  <p className="text-sm text-muted">
                    {r.anonymousTips} {r.anonymousTips === 1 ? "tip was" : "tips were"} anonymous and{" "}
                    {r.anonymousTips === 1 ? "is" : "are"} not counted as a supporter.
                  </p>
                )}

                {r.ongoing && (
                  <p className="text-sm text-muted">
                    The last tip came less than {gapHours} hours ago, so more tips may still join this stream.
                  </p>
                )}

                <CopyButton value={recapSummaryText(r, dayLabel(r))} label="Copy summary" className={pillOutline} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-muted">
          We only see when tips arrive, not when you go live. A stream here is a run of paid tips with less than{" "}
          {gapHours} hours between one tip and the next, from the last {RECAP_DAYS} days. The copied summary has
          numbers only, with no fan names. The amount you&apos;d keep is an estimate.
        </p>
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className="numeric font-medium text-text">{value}</dd>
    </div>
  );
}
