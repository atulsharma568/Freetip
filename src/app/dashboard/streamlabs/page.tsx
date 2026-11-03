import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { planFeatures } from "@/lib/plans";
import { SITE_NAME } from "@/lib/site";
import { streamlabsConfigured } from "@/lib/streamlabs";
import { loadStreamlabsState, type StreamlabsState } from "@/lib/streamlabs-outbox";
import { DashboardNav } from "../DashboardNav";
import { DashboardShell } from "../parts/DashboardShell";
import { Msg } from "../parts/Msg";
import { Tile } from "../parts/Tile";
import { StreamlabsManager } from "./StreamlabsManager";

export const metadata: Metadata = {
  title: `Streamlabs: ${SITE_NAME}`,
  robots: { index: false },
};

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Streamlabs connected. Each paid tip will now also show as an alert there." },
  declined: { ok: false, text: "Streamlabs was not connected: you did not give permission." },
  failed: { ok: false, text: "Streamlabs could not be connected. Try again." },
  unavailable: { ok: false, text: "This is not switched on for the site yet." },
};

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function StreamlabsPage({ searchParams }: { searchParams: Promise<{ sl?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<
    { id: string; handle: string | null; paid_features: string[] | null; creator_status: string }[]
  >`select id::text, handle, paid_features, creator_status from users where google_id = ${googleId}`;
  if (!user?.handle) redirect("/dashboard");
  // Switched off: the page is for nothing but taking a saved connection away, so it opens only
  // when there is one (a creator can always remove what we hold, whatever the switch says).
  const switchedOff = !planFeatures(user).streamlabs;

  let migrated = true;
  let state: StreamlabsState = {
    connected: false,
    displayName: null,
    reconnectNeeded: false,
    lastError: null,
    lastSentAt: null,
    sent24h: 0,
    dropped24h: 0,
  };
  try {
    state = await loadStreamlabsState(db as unknown as LedgerDb, Number(user.id));
  } catch (err) {
    console.error("Streamlabs page: could not read the connection (migration 0041 run?)", err);
    migrated = false;
  }

  if (switchedOff && !(migrated && state.connected)) redirect("/dashboard");

  const sl = (await searchParams).sl;
  const notice = sl ? NOTICES[sl] : undefined;

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      <div className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-24 pt-4">
        <DashboardNav current="streamlabs" />
        <div className="space-y-3">
          <h1 className="display text-[clamp(2.25rem,8vw,3.5rem)]">Streamlabs</h1>
          <p className="text-muted">
            {switchedOff
              ? "Streamlabs alerts are switched off for your account, so nothing is sent. Your saved sign-in is still with us until you disconnect it below."
              : "Connect your own Streamlabs account and each paid tip also shows as an alert in your Streamlabs alert box, with the fan's name, the amount and their message."}
          </p>
        </div>

        {!migrated ? (
          <Msg kind="error" text="This is not available right now. Try again later." />
        ) : (
          <>
            <Msg kind={notice ? (notice.ok ? "ok" : "error") : undefined} text={notice?.text} />

            <Tile id="streamlabs-connection" level={2} title="Connection">
              <div className="space-y-4">
                <p className="text-base text-text">
                  {state.connected
                    ? state.reconnectNeeded
                      ? "Streamlabs needs you to sign in again. Alerts are paused."
                      : `Connected${state.displayName ? ` as ${state.displayName}` : ""}.`
                    : "Not connected."}
                </p>
                {state.connected && !state.reconnectNeeded && (
                  <p className="text-sm text-muted">
                    Last 24 hours: {state.sent24h} sent{state.dropped24h > 0 ? `, ${state.dropped24h} not sent` : ""}.
                    {state.lastSentAt ? ` Last alert ${timeFormat.format(state.lastSentAt)} IST.` : ""}
                  </p>
                )}
                {state.lastError && <p className="text-sm text-muted">Last problem: {state.lastError}</p>}
                <StreamlabsManager
                  available={streamlabsConfigured() && !switchedOff}
                  switchedOff={switchedOff}
                  connected={state.connected}
                  reconnectNeeded={state.reconnectNeeded}
                />
              </div>
            </Tile>

            <Tile level={2} title="What to know">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
                <li>
                  Streamlabs gets the fan&apos;s name, the amount and, by the same rules as your OBS alert, their
                  message. A message you reject, or that has a word you banned, is never sent. Nothing else is shared.
                </li>
                <li>
                  If your Freetip alert and your Streamlabs alert box are both in OBS, each tip shows twice. Use one of
                  them.
                </li>
                <li>
                  Streamlabs asks for no more than about two alerts a minute, so a very busy moment is spread out. An
                  alert more than an hour old is skipped.
                </li>
                <li>You can disconnect at any time. That deletes our saved sign-in for your Streamlabs account at once.</li>
              </ul>
            </Tile>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
