"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { MoneyOrbit } from "./MoneyOrbit";
import { gsap, useGSAP } from "@/lib/gsap";
import { HANDLE_PATTERN, HandleField } from "@/components/ui/HandleField";

type Status = "idle" | "invalid" | "closed";

const MESSAGES: Record<Status, string> = {
  idle: "",
  invalid: "Use 3 to 20 letters, numbers or underscores.",
  closed: "Sign-up isn't open yet, so nothing has been reserved.",
};

export function Closer() {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [scanning, setScanning] = useState(false);
  const scanTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(scanTimer.current), []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
        () => {
          gsap.fromTo(
            field.current,
            { clipPath: "inset(14% 7% 0% 7% round 2rem 2rem 0rem 0rem)" },
            {
              clipPath: "inset(0% 0% 0% 0% round 0rem 0rem 0rem 0rem)",
              ease: "none",
              scrollTrigger: {
                trigger: field.current,
                start: "top 90%",
                end: "top 25%",
                scrub: true,
              },
            },
          );
        },
      );
    },
    { scope: root },
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = HANDLE_PATTERN.test(handle) ? "closed" : "invalid";
    // A valid handle gets a short scan across the field before the answer.
    if (next === "invalid" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStatus(next);
      return;
    }
    setStatus("idle");
    setScanning(true);
    window.clearTimeout(scanTimer.current);
    scanTimer.current = window.setTimeout(() => {
      setScanning(false);
      setStatus(next);
    }, 700);
  };

  return (
    <section
      ref={root}
      id="claim"
      className="scroll-mt-24 overflow-hidden bg-ground"
    >
      <MoneyOrbit />
      <div ref={field} className="on-accent bg-accent text-ink">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <h2 className="display max-w-[14ch] text-[clamp(3rem,9vw,6rem)]">
            Your handle is your link.
          </h2>
          <p className="mt-6 max-w-[40ch] text-pretty text-lg">
            Pick the name your fans will type. Sign&#8209;up isn&apos;t open
            yet, so handles can&apos;t be reserved.
          </p>
          <form onSubmit={onSubmit} noValidate className="mt-10">
            <label
              htmlFor="handle"
              className="mb-2 block text-sm font-semibold"
            >
              Your handle
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <HandleField
                id="handle"
                tone="lime"
                value={handle}
                onChange={(next) => {
                  setHandle(next);
                  setStatus("idle");
                }}
                invalid={status === "invalid"}
                describedBy="handle-status"
                scanning={scanning}
              />
              <Magnetic className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="beam h-16 w-full rounded-full bg-ink px-8 text-base font-semibold text-accent transition-transform duration-200 [--beam-inset:5px] active:scale-[0.97] sm:w-auto"
                >
                  <RollText>Claim your handle</RollText>
                </button>
              </Magnetic>
            </div>
            <p
              id="handle-status"
              role="status"
              className="mt-4 min-h-6 text-base font-medium"
            >
              {MESSAGES[status]}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
