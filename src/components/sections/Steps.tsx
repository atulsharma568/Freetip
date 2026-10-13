"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SITE_HOST } from "@/lib/site";

const STEPS = [
  {
    verb: "Claim",
    text: `Pick a handle. Your page lives at ${SITE_HOST}/yourname.`,
  },
  {
    verb: "Share",
    text: "Put the link in your video descriptions, pinned comments and community posts.",
  },
  {
    verb: "Get paid",
    text: "Fans pay with UPI or card. Tips are paid out to your bank account in INR.",
  },
];

export function Steps() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        q("[data-step]").forEach((row) => {
          const rule = row.querySelector("[data-rule]");
          const verb = row.querySelector("[data-verb]");
          const text = row.querySelector("[data-text]");
          gsap
            .timeline({
              scrollTrigger: { trigger: row, start: "top 82%", once: true },
            })
            .fromTo(
              rule,
              { scaleX: 0 },
              { scaleX: 1, duration: 1.1, ease: "expo.out", transformOrigin: "left" },
            )
            .fromTo(
              verb,
              { yPercent: 105 },
              { yPercent: 0, duration: 0.9, ease: "expo.out" },
              0.1,
            )
            .fromTo(
              text,
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
              0.3,
            );
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="how"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-32 pt-32 md:pb-48 md:pt-48"
    >
      <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">How it works</h2>
      <ol className="mt-16 md:mt-24">
        {STEPS.map((step) => (
          <li
            key={step.verb}
            data-step
            className="grid grid-cols-1 gap-x-8 gap-y-4 pb-12 md:grid-cols-12 md:pb-16"
          >
            <div
              data-rule
              className="col-span-full mb-8 h-px bg-line md:mb-10"
              aria-hidden="true"
            />
            <div className="-mb-[0.14em] overflow-hidden pb-[0.14em] md:col-span-7">
              <span
                data-verb
                className="display inline-block text-[clamp(3rem,8vw,6rem)]"
              >
                {step.verb}
              </span>
            </div>
            <p
              data-text
              className="max-w-[36ch] text-pretty text-lg text-muted md:col-span-5 md:self-end"
            >
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
