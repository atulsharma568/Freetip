"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import ClickSpark, { type ClickSparkHandle } from "@/components/react-bits/ClickSpark";
import { RollText } from "@/components/motion/RollText";
import { generateOverlayLink } from "@/app/actions/creator";
import { replayLastAlert, sendTestAlert, skipAlert, type ControlResult } from "@/app/actions/overlay-controls";
import { CopyField } from "./parts/CopyField";
import { ConfirmAction } from "./parts/ConfirmAction";
import { Msg } from "./parts/Msg";
import { pillOutline, pillPrimary } from "./parts/styles";

const WARNING = "Anyone with this link can see your alerts: keep it off stream.";

export function OverlayTile({ hasLink }: { hasLink: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [control, setControl] = useState<ControlResult | null>(null);
  const [controlPending, startControl] = useTransition();
  const spark = useRef<ClickSparkHandle>(null);
  const controls = useRef<HTMLDivElement>(null);

  // A spark from the button that was pressed, once the action is through.
  function run(action: () => Promise<ControlResult>, button: HTMLElement, celebrate: boolean) {
    setControl(null);
    startControl(async () => {
      const result = await action();
      setControl(result);
      const root = controls.current?.getBoundingClientRect();
      if (celebrate && result.status === "ok" && root) {
        const box = button.getBoundingClientRect();
        spark.current?.spark(box.left - root.left + box.width / 2, box.top - root.top + box.height / 2);
      }
    });
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await generateOverlayLink();
      if (res.status === "ok") setUrl(res.url);
      else setError(res.message);
    });
  }

  return (
    <div className="space-y-4">
      {url ? (
        <CopyField
          id="overlay-url"
          value={url}
          label="Your alert link. It is shown once, so copy it now."
          note={WARNING}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {hasLink
              ? "You have an alert link. For safety it can't be shown again; create a new one if you lost it."
              : "Create a private link, then add it to OBS as a Browser source."}
          </p>
          <p className="text-xs text-muted">{WARNING}</p>
        </div>
      )}

      <Msg kind={error ? "error" : undefined} text={error} />

      <ConfirmAction
        ask={hasLink && !url}
        prompt="Your current link will stop working. Create a new one?"
        confirmLabel="Yes, make a new link"
        keepLabel="Keep my link"
        onConfirm={create}
        disabled={pending}
        className={pillPrimary}
      >
        <RollText>{pending ? "Creating…" : hasLink || url ? "Create a new link" : "Create link"}</RollText>
      </ConfirmAction>

      {(hasLink || url) && (
        <div className="space-y-2 border-t border-line/60 pt-4">
          <p className="text-xs text-muted">With the alert open in OBS, these act within a few seconds.</p>
          <ClickSpark
            ref={spark}
            manual
            sparkColor="#bfe84a"
            sparkCount={12}
            sparkRadius={44}
            sparkSize={12}
            sparkWidth={2.5}
            duration={700}
          >
            <div ref={controls} className="flex flex-wrap gap-2">
              {[
                { label: "Send test alert", action: sendTestAlert, celebrate: true },
                { label: "Skip current alert", action: skipAlert, celebrate: false },
                { label: "Replay last alert", action: replayLastAlert, celebrate: false },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={(e) => run(b.action, e.currentTarget, b.celebrate)}
                  disabled={controlPending}
                  className={pillOutline}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </ClickSpark>
          <Msg kind={control ? (control.status === "error" ? "error" : "info") : undefined} text={control?.message} />
        </div>
      )}

      <div className="space-y-2 border-t border-line/60 pt-4 text-sm text-muted">
        <p>
          In OBS: Sources, add Browser, paste the link. Set any size you like, for example 800 × 300, then drag and
          resize it on your scene to put the alert where you want it. Keep it wider than it is tall, or the alert
          switches to the vertical-stream layout.
        </p>
        <p>
          <Link
            href="/overlay/preview"
            target="_blank"
            className="text-text underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Preview the alerts
          </Link>{" "}
          (samples only).
        </p>
      </div>
    </div>
  );
}
