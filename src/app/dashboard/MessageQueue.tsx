"use client";

import { useState, useTransition } from "react";
import { decideMessage } from "@/app/actions/messages";
import { TickLoader } from "@/components/ui/TickLoader";
import { EmptyState, SampleAlert } from "./parts/EmptyState";
import { Msg } from "./parts/Msg";
import { pillOutline } from "./parts/styles";

export interface PendingMessage {
  id: number;
  fan_name: string | null;
  fan_message: string;
  gross_amount_minor: string;
}

// Messages waiting for the creator's decision. Only shown in split and approve
// modes. While a decision is going through, that message shows it and both
// buttons rest; when it is done a status line (which a screen reader reads)
// says what happened.
export function MessageQueue({ items }: { items: PendingMessage[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState("");
  const [failed, setFailed] = useState("");
  const [, startTransition] = useTransition();

  function decide(m: PendingMessage, decision: "approved" | "rejected") {
    setBusy(m.id);
    setDone("");
    setFailed("");
    startTransition(async () => {
      try {
        await decideMessage(m.id, decision);
        setDone(`${decision === "approved" ? "Approved" : "Rejected"} the message from ${m.fan_name ?? "Anonymous"}.`);
      } catch {
        setFailed("That did not go through. Try again.");
      }
      setBusy(null);
    });
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState
          sample={<SampleAlert name="Riya" amount={250} message="Great stream today!" />}
          title="No messages waiting."
          body="With approval on, a fan's message waits here until you say yes or no. The one above is a sample."
          cta={
            <a href="#alerts" className={pillOutline}>
              Set up alerts
            </a>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((m) => {
            const working = busy === m.id;
            return (
              <li
                key={m.id}
                aria-busy={working}
                className="min-w-0 space-y-3 rounded-[var(--radius-field)] border border-line/60 p-4"
              >
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium text-text">{m.fan_name ?? "Anonymous"}</span>
                  <span className="numeric shrink-0 text-accent">₹{Number(m.gross_amount_minor) / 100}</span>
                </p>
                <p className="break-words text-base text-text">{m.fan_message}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(m, "approved")}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-ink transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(m, "rejected")}
                    className="inline-flex h-10 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-muted disabled:opacity-40"
                  >
                    Reject
                  </button>
                  {working && (
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <TickLoader count={8} duration={0.8} />
                      Sending your answer
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Msg kind={failed ? "error" : done ? "ok" : undefined} text={failed || done} />
    </div>
  );
}
