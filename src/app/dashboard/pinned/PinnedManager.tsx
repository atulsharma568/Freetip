"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pinMessageAgain, savePinSettings, unpinNow, type PinnedActionResult } from "@/app/actions/pinned";
import { PIN_SECONDS_MAX, PIN_SECONDS_MIN } from "@/lib/pinned";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { field, pillOutline, pillPrimary } from "../parts/styles";

type Item = {
  id: number;
  name: string;
  amountPaise: number;
  message: string;
  capturedAt: string;
  state: "live" | "ended" | "waiting";
  secondsLeft: number;
};

const rupees = (paise: number) => Math.floor(paise / 100).toLocaleString("en-IN");

const STATE_TEXT: Record<Item["state"], string> = {
  live: "Pinned now",
  ended: "Ended",
  waiting: "Waiting for your approval",
};

export function PinnedManager({ savedRupees, savedSeconds, items }: { savedRupees: string; savedSeconds: number; items: Item[] }) {
  const router = useRouter();
  const [min, setMin] = useState(savedRupees);
  const [seconds, setSeconds] = useState(String(savedSeconds));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function run(key: string, action: () => Promise<PinnedActionResult>) {
    setBusy(key);
    setMessage(null);
    const res = await action();
    setBusy(null);
    setMessage({ kind: res.status === "error" ? "error" : "ok", text: res.message });
    if (res.status === "ok") router.refresh();
  }

  const live = items.some((i) => i.state === "live");

  return (
    <div className="space-y-4">
      <Tile id="pin-settings" title="What fans can pin">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("save", () => savePinSettings(min, seconds));
          }}
          className="space-y-4"
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text">Smallest tip that can pin a message (₹)</span>
            <input
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Empty means fans cannot pin"
              className={field}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-text">How long a pinned message stays (seconds)</span>
            <input
              inputMode="numeric"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={field}
            />
            <span className="block text-xs text-muted">
              Between {PIN_SECONDS_MIN} and {PIN_SECONDS_MAX}. The time starts when you approve the message.
            </span>
          </label>
          <button type="submit" disabled={busy !== null} className={pillPrimary}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </form>
        <p className="mt-4 border-t border-line/60 pt-4 text-sm text-muted">
          In OBS, add your alert link as another Browser source and put <span className="numeric text-text">/pinned</span> on
          the end of it. It shows nothing until a message is pinned.
        </p>
      </Tile>

      <Tile id="pin-list" title="Pinned in the last day">
        {live && (
          <div className="mb-4">
            <button type="button" disabled={busy !== null} onClick={() => run("unpin", unpinNow)} className={pillPrimary}>
              {busy === "unpin" ? "Taking down…" : "Take down now"}
            </button>
            <p className="mt-2 text-xs text-muted">The card clears in OBS within a few seconds. The fan&apos;s tip stays final.</p>
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing yet. A message a fan asked to pin shows here, and a new one waits in Messages to approve on the
            overview until you say yes.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="min-w-0 space-y-2 rounded-[var(--radius-field)] border border-line/60 p-4">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium text-text">{i.name}</span>
                  <span className="numeric shrink-0 text-accent">₹{rupees(i.amountPaise)}</span>
                </p>
                <p className="break-words text-base text-text">{i.message}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted">
                    {STATE_TEXT[i.state]}
                    {i.state === "live" ? `, about ${i.secondsLeft} s left` : ""}
                  </span>
                  {i.state === "ended" && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => run(`again-${i.id}`, () => pinMessageAgain(i.id))}
                      className={pillOutline}
                    >
                      {busy === `again-${i.id}` ? "Pinning…" : "Pin again"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <Msg kind={message?.kind} text={message?.text} />
    </div>
  );
}
