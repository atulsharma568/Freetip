"use client";

import { useRef, useState } from "react";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { gsap, useGSAP } from "@/lib/gsap";
import { HandleField } from "@/components/ui/HandleField";
import { TickLoader } from "@/components/ui/TickLoader";
import {
  ConsentNote,
  useWaitlist,
  WaitlistHiddenFields,
} from "@/components/waitlist/useWaitlist";

const IDS = { handle: "handle", email: "waitlist-email" };

export function Closer() {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const waitlist = useWaitlist(IDS);

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

  return (
    <section
      ref={root}
      id="claim"
      className="scroll-mt-24 overflow-hidden bg-ground"
    >
      <div ref={field} className="on-accent bg-accent text-ink">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <h2 className="display max-w-[14ch] text-[clamp(3rem,9vw,6rem)]">
            Your handle is your link.
          </h2>
          <p className="mt-6 max-w-[40ch] text-pretty text-lg">
            Pick the name your fans will type and join the waitlist.
            We&apos;ll email you when sign&#8209;up opens; handles
            aren&apos;t reserved until then.
          </p>
          <form
            action={waitlist.action}
            onSubmit={waitlist.onSubmit}
            noValidate
            className="mt-10 space-y-6"
          >
            <WaitlistHiddenFields source="home" />
            <div>
              <label htmlFor={IDS.handle} className="mb-2 block text-sm font-semibold">
                The handle you want <span className="font-normal">(optional)</span>
              </label>
              <HandleField
                id={IDS.handle}
                tone="lime"
                value={handle}
                onChange={(next) => {
                  setHandle(next);
                  waitlist.onEdit();
                }}
                invalid={waitlist.invalid("handle")}
                describedBy="waitlist-status"
                scanning={waitlist.pending}
              />
            </div>
            <div>
              <label htmlFor={IDS.email} className="mb-2 block text-sm font-semibold">
                Email
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <input
                  id={IDS.email}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    waitlist.onEdit();
                  }}
                  aria-invalid={waitlist.invalid("email")}
                  aria-describedby="waitlist-status"
                  placeholder="you@example.com"
                  className="h-16 w-full rounded-full border-2 border-ink bg-transparent px-6 text-base text-ink transition-shadow duration-200 ease-out-expo placeholder:text-ink/70 focus-visible:shadow-[0_14px_32px_-14px_rgb(27_28_20/0.7)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:max-w-md sm:flex-1"
                />
                <Magnetic className="w-full sm:w-auto">
                  <button
                    type="submit"
                    className="beam h-16 w-full rounded-full bg-ink px-8 text-base font-semibold text-accent transition-transform duration-200 [--beam-inset:5px] active:scale-[0.97] sm:w-auto"
                  >
                    {/* Both labels share one cell, so the width never jumps. */}
                    <span className="grid">
                      <span className={`col-start-1 row-start-1 ${waitlist.pending ? "invisible" : ""}`}>
                        <RollText>Join the waitlist</RollText>
                      </span>
                      <span
                        className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-3 ${waitlist.pending ? "" : "invisible"}`}
                      >
                        {waitlist.pending && <TickLoader />}
                        Joining
                      </span>
                    </span>
                  </button>
                </Magnetic>
              </div>
            </div>
            <p
              id="waitlist-status"
              role="status"
              className="min-h-6 text-base font-medium"
            >
              {waitlist.message}
            </p>
            <ConsentNote tone="lime" />
          </form>
        </div>
      </div>
    </section>
  );
}
