"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectYouTube,
  removeDiscordWebhook,
  removeEditorLink,
  removeHelperToken,
  type TsResult,
} from "@/app/actions/timestamps";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { pillOutline } from "../parts/styles";

// What /dashboard/timestamps shows while the switch is off: only the buttons that take
// something we hold away. Each one is offered only while there is something stored.
export function TimestampsCleanup({
  youtube,
  discord,
  editorLink,
  helperToken,
}: {
  youtube: boolean;
  discord: boolean;
  editorLink: boolean;
  helperToken: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TsResult | null>(null);

  function run(fn: () => Promise<TsResult>) {
    setResult(null);
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.status === "ok") router.refresh();
    });
  }

  return (
    <Tile id="ts-cleanup" level={2} title="What we hold for you">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {youtube && (
            <ConfirmAction
              prompt="Disconnect YouTube? We delete our saved permission and tell Google to cancel it."
              confirmLabel="Yes, disconnect"
              keepLabel="Keep it connected"
              className={pillOutline}
              disabled={pending}
              onConfirm={() => run(disconnectYouTube)}
            >
              Disconnect YouTube
            </ConfirmAction>
          )}
          {discord && (
            <ConfirmAction
              prompt="Disconnect Discord? We delete the saved webhook address."
              confirmLabel="Yes, disconnect"
              keepLabel="Keep it connected"
              className={pillOutline}
              disabled={pending}
              onConfirm={() => run(removeDiscordWebhook)}
            >
              Disconnect Discord
            </ConfirmAction>
          )}
          {editorLink && (
            <ConfirmAction
              prompt="Remove the editor link? Anyone using it loses access."
              confirmLabel="Yes, remove it"
              keepLabel="Keep the link"
              className={pillOutline}
              disabled={pending}
              onConfirm={() => run(removeEditorLink)}
            >
              Remove the editor link
            </ConfirmAction>
          )}
          {helperToken && (
            <ConfirmAction
              prompt="Remove the helper token? A helper that is running stops working."
              confirmLabel="Yes, remove it"
              keepLabel="Keep the token"
              className={pillOutline}
              disabled={pending}
              onConfirm={() => run(removeHelperToken)}
            >
              Remove the helper token
            </ConfirmAction>
          )}
        </div>
        <Msg kind={result ? (result.status === "error" ? "error" : "ok") : undefined} text={result?.message} />
      </div>
    </Tile>
  );
}
