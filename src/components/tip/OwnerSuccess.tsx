"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ArrowCounterClockwise, Copy, ShareNetwork } from "@phosphor-icons/react";
import { tipThanksLine, type AlertMode } from "@/lib/alerts";
import { rupeeText } from "./format";
import { ownerFont } from "./owner-font";

const noopSubscribe = () => () => {};
const canShare = () => typeof navigator !== "undefined" && "share" in navigator;

// After a tip, on the owner's page: the look of the ending screen of the owner's streams, the
// mask, a huge italic GG, "see you soon" in outline and a thank-you line.
export function OwnerSuccess({
  amountPaise,
  displayName,
  handle,
  anonymous,
  alertMessage,
  alertMode,
  pinned,
  reference,
  onAgain,
  line,
}: {
  amountPaise: number;
  displayName: string;
  handle: string;
  anonymous: boolean;
  alertMessage: string;
  alertMode: AlertMode;
  pinned: boolean;
  reference: string;
  onAgain: () => void;
  // The small line at the bottom; empty or missing is the standard wording.
  line?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState("");
  const shareable = useSyncExternalStore(noopSubscribe, canShare, () => false);
  const rupees = amountPaise / 100;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${handle}`);
      setNotice("Link copied");
    } catch {
      setNotice("Could not copy the link.");
    }
  }

  async function shareLink() {
    try {
      await navigator.share({ title: `Tip ${displayName}`, url: `${window.location.origin}/${handle}` });
    } catch {
      // The sheet was closed: nothing to report.
    }
  }

  const pill =
    "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,color] duration-200 active:scale-[0.97]";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <div className="relative isolate mx-auto flex min-h-[30rem] max-w-xl flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface/80 p-6 text-center backdrop-blur-sm sm:p-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted">{displayName}</p>
        <Image src="/owner/kitsune.svg" alt="" width={92} height={110} aria-hidden="true" className="ap-pop h-24 w-auto" />
        <h1
          ref={heading}
          tabIndex={-1}
          className={`${ownerFont.className} ap-gg text-[clamp(4.5rem,22vw,8rem)] font-black italic leading-[0.85] tracking-tight text-text outline-none`}
        >
          GG
          <span className="sr-only">. ₹{rupeeText(rupees)} sent to {displayName}.</span>
        </h1>
        <p
          aria-hidden="true"
          className={`${ownerFont.className} ap-ghost text-[clamp(1.5rem,6vw,2.25rem)] font-black uppercase italic leading-none`}
        >
          See you soon
        </p>
        <p aria-hidden="true" className="numeric text-2xl font-semibold text-accent">
          ₹{rupeeText(rupees)}
        </p>
        <p className="max-w-[34ch] text-pretty text-base text-muted">
          {tipThanksLine(anonymous, alertMessage, alertMode, pinned)}
        </p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted [overflow-wrap:anywhere]">{line || "Thanks for hanging out."}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onAgain} className={`${pill} border-2 border-accent text-text hover:bg-accent hover:text-ink`}>
            <ArrowCounterClockwise weight="bold" aria-hidden="true" />
            Tip again
          </button>
          <button type="button" onClick={shareable ? shareLink : copyLink} className={`${pill} bg-accent text-ink`}>
            {shareable ? <ShareNetwork weight="bold" aria-hidden="true" /> : <Copy weight="bold" aria-hidden="true" />}
            {shareable ? "Share the page" : "Copy the link"}
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm font-semibold text-muted">
          {notice}
        </p>
        {reference && <p className="numeric break-all text-xs text-muted">Reference {reference}</p>}
      </div>
    </div>
  );
}
