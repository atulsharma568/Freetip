"use client";

import { useState, useTransition } from "react";
import { disconnectStreamlabsAction, sendStreamlabsTestAlert, type SlResult } from "@/app/actions/streamlabs";
import { ConfirmAction } from "../parts/ConfirmAction";
import { Msg } from "../parts/Msg";
import { pillOutline, pillPrimary } from "../parts/styles";

// The buttons on /dashboard/streamlabs. Connecting is a plain GET form to /api/streamlabs/start
// (a full page trip to Streamlabs and back); the rest are server actions.
export function StreamlabsManager({
  available,
  connected,
  reconnectNeeded,
}: {
  available: boolean;
  connected: boolean;
  reconnectNeeded: boolean;
}) {
  const [result, setResult] = useState<SlResult | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<SlResult>) {
    setResult(null);
    start(async () => setResult(await action()));
  }

  return (
    <div className="space-y-4">
      {(!connected || reconnectNeeded) &&
        (available ? (
          <form action="/api/streamlabs/start" method="get">
            <button type="submit" className={pillPrimary}>
              {reconnectNeeded ? "Connect Streamlabs again" : "Connect Streamlabs"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">This is not switched on for the site yet.</p>
        ))}

      {connected && (
        <div className="flex flex-wrap items-center gap-2">
          {!reconnectNeeded && (
            <button type="button" className={pillOutline} disabled={pending} onClick={() => run(sendStreamlabsTestAlert)}>
              Send a test alert
            </button>
          )}
          <ConfirmAction
            prompt="Stop sending alerts to Streamlabs and delete our saved sign-in?"
            confirmLabel="Yes, disconnect"
            keepLabel="Keep it connected"
            onConfirm={() => run(disconnectStreamlabsAction)}
            disabled={pending}
            className={pillOutline}
          >
            Disconnect
          </ConfirmAction>
        </div>
      )}

      <Msg kind={result ? (result.status === "error" ? "error" : "ok") : undefined} text={result?.message} />
    </div>
  );
}
