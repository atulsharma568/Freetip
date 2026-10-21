"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
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
    verb: "Go live",
    text: "Tips show up on your stream as OBS alerts. You choose whether alerts show, whether messages are read out and whether you approve each one first.",
  },
  {
    verb: "Get paid",
    text: "Fans pay with UPI or card. Tips are paid out to your bank account in INR.",
  },
];

// The rail layout (one row that slides sideways while the section is pinned)
// only applies from md up with motion allowed; the same query is used in
// the classes below (md:motion-safe:) and in the script.
const RAIL = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

export function Steps() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      // Rail: pin the section and slide the steps left as the page scrolls,
      // filling the lime progress line. Each verb rises as it comes in.
      mm.add(RAIL, () => {
        const track = q("[data-track]")[0];
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const slide = gsap.to(track, { x: () => -distance(), ease: "none" });
        const progress = gsap.fromTo(
          q("[data-progress]"),
          { scaleX: 0 },
          { scaleX: 1, ease: "none", transformOrigin: "left" },
        );
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          animation: gsap.timeline().add(slide, 0).add(progress, 0),
        });
        q("[data-step]").forEach((row, i) => {
          const verb = row.querySelector("[data-verb]");
          const text = row.querySelector("[data-text]");
          if (i === 0) return;
          gsap
            .timeline({
              scrollTrigger: {
                trigger: row,
                containerAnimation: slide,
                start: "left 85%",
                once: true,
              },
            })
            .fromTo(verb, { yPercent: 105 }, { yPercent: 0, duration: 0.9, ease: "expo.out" })
            .fromTo(
              text,
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" },
              0.2,
            );
        });
        return () => st.kill();
      });

      // Stacked (phones): each step draws its rule and rises as it scrolls in,
      // including the first step (which the rail skips on desktop).
      // "top bottom" fires the instant the element enters the viewport so the
      // trigger is never missed even if the user scrolls quickly past the splash.
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        q("[data-step]").forEach((row) => {
          const rule = row.querySelector("[data-rule]");
          const verb = row.querySelector("[data-verb]");
          const text = row.querySelector("[data-text]");
          gsap
            .timeline({
              scrollTrigger: {
                trigger: row,
                start: "top bottom",
                once: true,
                invalidateOnRefresh: true,
              },
            })
            .fromTo(
              rule,
              { scaleX: 0 },
              { scaleX: 1, duration: 1.2, ease: "expo.out", transformOrigin: "left" },
            )
            .fromTo(verb, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: "expo.out" }, 0.08)
            .fromTo(
              text,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" },
              0.28,
            );
        });
        // Refresh after a frame so positions are correct once the page-content
        // transition (opacity 0→1) has been measured by ScrollTrigger.
        ScrollTrigger.refresh();
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="how"
      className="scroll-mt-24 overflow-x-clip pb-32 pt-32 md:pb-48 md:pt-48 md:motion-safe:flex md:motion-safe:h-[100dvh] md:motion-safe:flex-col md:motion-safe:justify-center md:motion-safe:py-0"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">How it works</h2>
        <div
          aria-hidden="true"
          className="relative mt-12 hidden h-px bg-line md:motion-safe:block"
        >
          <div data-progress className="absolute -top-px left-0 h-[3px] w-full bg-accent" />
        </div>
      </div>
      <ol
        data-track
        className="mx-auto mt-16 max-w-7xl px-6 md:mt-24 md:motion-safe:mt-16 md:motion-safe:flex md:motion-safe:w-max md:motion-safe:max-w-none md:motion-safe:gap-20 md:motion-safe:pl-[max(1.5rem,calc(50vw-38.5rem))] md:motion-safe:pr-[max(1.5rem,calc(50vw-38.5rem))]"
      >
        {STEPS.map((step) => (
          <li
            key={step.verb}
            data-step
            className="grid grid-cols-1 gap-x-8 gap-y-4 pb-12 md:grid-cols-12 md:pb-16 md:motion-safe:block md:motion-safe:w-[min(30rem,42vw)] md:motion-safe:shrink-0 md:motion-safe:pb-0"
          >
            <div
              data-rule
              className="col-span-full mb-8 h-px bg-line md:mb-10 md:motion-safe:hidden"
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
              className="max-w-[36ch] text-pretty text-lg text-muted md:col-span-5 md:self-end md:motion-safe:mt-6"
            >
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
