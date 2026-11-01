"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowCounterClockwise, Check, Copy, ShareNetwork } from "@phosphor-icons/react";
import { tipThanksLine, type AlertMode } from "@/lib/alerts";
import { gsap, useGSAP } from "@/lib/gsap";
import { INK_HEX } from "@/lib/site";
import ClickSpark, { type ClickSparkHandle } from "@/components/react-bits/ClickSpark";
import { RollText } from "@/components/motion/RollText";
import { Odometer, spinReels } from "@/components/ui/Odometer";
import { rupeeText } from "./format";

const noopSubscribe = () => () => {};
const canShare = () => typeof navigator !== "undefined" && "share" in navigator;

// After a tip: the page floods lime from the bottom like the landing's sample
// card, the amount's reels spin and land, a short burst of ink sparks leaves
// the check badge, then the fan can tip again or pass the creator's page on.
// Focus moves to the heading so the result is read out. Motion is skipped
// under reduced motion; the words are always there.
export function SuccessScreen({
  amountPaise,
  displayName,
  handle,
  anonymous,
  alertMessage,
  alertMode,
  reference,
  onAgain,
}: {
  amountPaise: number;
  displayName: string;
  handle: string;
  anonymous: boolean;
  alertMessage: string;
  alertMode: AlertMode;
  reference: string;
  onAgain: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const spark = useRef<ClickSparkHandle>(null);
  const [notice, setNotice] = useState("");
  const shareable = useSyncExternalStore(noopSubscribe, canShare, () => false);
  const rupees = amountPaise / 100;
  const whole = Number.isInteger(rupees);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  useGSAP(
    () => {
      const el = field.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap
          .timeline()
          .fromTo(
            el,
            { clipPath: "circle(0% at 50% 90%)" },
            { clipPath: "circle(140% at 50% 90%)", duration: 0.85, ease: "expo.out" },
          )
          .fromTo(
            el.querySelectorAll("[data-pop]"),
            { y: 18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.07 },
            0.25,
          )
          .call(
            () => {
              const badge = el.querySelector("[data-badge]");
              const box = root.current;
              if (!badge || !box) return;
              const b = badge.getBoundingClientRect();
              const c = box.getBoundingClientRect();
              spark.current?.spark(b.left - c.left + b.width / 2, b.top - c.top + b.height / 2);
            },
            undefined,
            0.5,
          );
        const reels = gsap.utils.toArray<HTMLElement>("[data-reel]", el);
        spinReels(gsap, reels).forEach((spin) => tl.add(spin, 0.25));
      });
    },
    { scope: root },
  );

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
      await navigator.share({
        title: `Tip ${displayName}`,
        url: `${window.location.origin}/${handle}`,
      });
    } catch {
      // The sheet was closed: nothing to report.
    }
  }

  const pill =
    "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,color] duration-200 active:scale-[0.97]";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <ClickSpark
        ref={spark}
        manual
        sparkColor={INK_HEX}
        sparkCount={10}
        sparkRadius={44}
        sparkSize={12}
        sparkWidth={2.5}
        spread={220}
        direction={0}
        duration={700}
        className="mx-auto max-w-xl"
      >
        <div ref={root} className="relative">
          <div
            ref={field}
            className="on-accent flex min-h-[28rem] flex-col items-center justify-center gap-4 rounded-[var(--radius-surface)] bg-accent p-6 text-center text-ink sm:p-10"
          >
            <span
              data-pop
              data-badge
              className="grid size-12 place-items-center rounded-full bg-ink text-accent"
            >
              <Check weight="bold" size={24} aria-hidden="true" />
            </span>
            <p className="text-[clamp(4rem,18vw,7rem)] font-semibold leading-none">
              {whole ? (
                <Odometer value={rupees} />
              ) : (
                <span aria-hidden="true" className="numeric">
                  ₹{rupeeText(rupees)}
                </span>
              )}
            </p>
            <h1
              ref={heading}
              tabIndex={-1}
              data-pop
              className="text-xl font-semibold outline-none sm:text-2xl"
            >
              <span className="sr-only">₹{rupeeText(rupees)}. </span>
              Sent to {displayName}!
            </h1>
            <p data-pop className="max-w-[34ch] text-pretty text-base">
              {tipThanksLine(anonymous, alertMessage, alertMode)}
            </p>
            <div data-pop className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onAgain}
                className={`${pill} border-2 border-ink hover:bg-ink hover:text-accent`}
              >
                <ArrowCounterClockwise weight="bold" aria-hidden="true" />
                Tip again
              </button>
              <button
                type="button"
                onClick={shareable ? shareLink : copyLink}
                className={`${pill} bg-ink text-accent`}
              >
                {shareable ? (
                  <ShareNetwork weight="bold" aria-hidden="true" />
                ) : (
                  <Copy weight="bold" aria-hidden="true" />
                )}
                <RollText>{shareable ? `Share ${displayName}'s page` : "Copy their link"}</RollText>
              </button>
            </div>
            <p data-pop aria-live="polite" className="min-h-5 text-sm font-semibold">
              {notice}
            </p>
            {reference && (
              <p data-pop className="numeric break-all text-xs text-ink/85">
                Reference {reference}
              </p>
            )}
          </div>
        </div>
      </ClickSpark>
    </div>
  );
}
