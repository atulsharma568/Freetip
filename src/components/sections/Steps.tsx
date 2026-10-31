"use client";

import { useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { RevealHeading } from "@/components/motion/RevealHeading";
import { FEES } from "@/lib/legal";
import { SAMPLE_HANDLE, SAMPLE_TIP, SITE_HOST } from "@/lib/site";

// One lime line runs down the section and four numbered nodes light up as it
// reaches them. Each step has a small labelled sample next to it. Everything
// is readable and drawn in full without JavaScript or under reduced motion.
const MOTION = "(prefers-reduced-motion: no-preference)";

function Sample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      data-sample
      aria-hidden="true"
      className="rounded-surface border border-line/60 bg-surface p-6"
    >
      <p className="mb-4 text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}

const STEPS = [
  {
    verb: "Claim",
    text: `Pick a handle. Your page lives at ${SITE_HOST}/yourname.`,
    sample: (
      <Sample label="Sample handle">
        <p className="numeric inline-block max-w-full break-all rounded-full bg-accent px-5 py-3 text-ink">
          {SITE_HOST}/{SAMPLE_HANDLE}
        </p>
      </Sample>
    ),
  },
  {
    verb: "Share",
    text: "Put the link in your video descriptions, pinned comments and community posts.",
    sample: (
      <Sample label="Sample video description">
        <div className="space-y-2">
          <div className="h-2 w-11/12 rounded-full bg-raised" />
          <div className="h-2 w-8/12 rounded-full bg-raised" />
          <p className="pt-2 text-base">
            Tip the stream:{" "}
            <span className="numeric underline decoration-line underline-offset-4">
              {SITE_HOST}/{SAMPLE_HANDLE}
            </span>
          </p>
        </div>
      </Sample>
    ),
  },
  {
    verb: "Go live",
    text: "Tips show up on your stream as OBS alerts. You choose whether alerts show, whether messages are read out and whether you approve each one first.",
    sample: (
      <Sample label="Sample alert. Nothing is sent to a stream.">
        <div data-alert className="on-accent rounded-surface bg-accent p-5 text-ink">
          <p className="font-semibold">{SAMPLE_TIP.name} tipped</p>
          <p className="numeric mt-1 text-3xl font-semibold">₹{SAMPLE_TIP.amount}</p>
          <p className="mt-2 text-base">{SAMPLE_TIP.message}</p>
        </div>
      </Sample>
    ),
  },
  {
    verb: "Get paid",
    text: "Fans pay with UPI or card. Tips are paid out to your UPI ID or bank account in INR.",
    sample: (
      <Sample label="Sample payout, on a ₹100 tip">
        <dl className="text-base">
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted">Fan tips</dt>
            <dd className="numeric whitespace-nowrap">{FEES.example.tip}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-dashed border-line pt-3 text-lg font-semibold">
            <dt>To your bank</dt>
            <dd className="numeric whitespace-nowrap text-accent">{FEES.example.keep}</dd>
          </div>
        </dl>
      </Sample>
    ),
  },
];

export function Steps() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(MOTION, () => {
        const rows = q("[data-step]");
        rows.forEach((row) => row.removeAttribute("data-on"));

        rows.forEach((row, i) => {
          const sample = row.querySelector("[data-sample]");
          const alert = row.querySelector("[data-alert]");
          const fill = row.querySelector("[data-fill]");
          const next = rows[i + 1];

          // The line draws as the page scrolls: this step's segment fills
          // from its node to the next one, tracking the 60% line of the screen.
          if (fill && next) {
            gsap.fromTo(
              fill,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: "none",
                transformOrigin: "top",
                scrollTrigger: {
                  trigger: row,
                  start: "top 60%",
                  endTrigger: next,
                  end: "top 60%",
                  scrub: 0.4,
                },
              },
            );
          }

          // The node lights when the line arrives and goes dark again when
          // scrolling back above it.
          ScrollTrigger.create({
            trigger: row,
            start: "top 60%",
            onEnter: () => row.setAttribute("data-on", ""),
            onLeaveBack: () => row.removeAttribute("data-on"),
          });

          // The sample comes in once.
          gsap.set(sample, { opacity: 0, y: 24 });
          if (alert) gsap.set(alert, { clipPath: "inset(0 0 100% 0)" });
          const tl = gsap
            .timeline({ scrollTrigger: { trigger: row, start: "top 70%", once: true } })
            .to(sample, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" });
          if (alert) {
            tl.to(alert, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.out" }, 0.3);
          }
        });

        return () => rows.forEach((row) => row.setAttribute("data-on", ""));
      });

      // Without motion every node is lit and the line is full.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        q("[data-step]").forEach((row) => row.setAttribute("data-on", ""));
        return () => q("[data-step]").forEach((row) => row.removeAttribute("data-on"));
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
      <RevealHeading className="display text-[clamp(2.5rem,6vw,4.5rem)]">
        How it works
      </RevealHeading>
      <div className="mt-16 md:mt-24">
        <ol className="space-y-20 md:space-y-28">
          {STEPS.map((step, i) => (
            <li
              key={step.verb}
              data-step
              data-on=""
              className="group relative grid grid-cols-1 gap-x-12 gap-y-8 pl-12 md:grid-cols-12 md:pl-20"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex size-7 items-center justify-center rounded-full border-2 border-control bg-ground text-sm font-semibold text-muted transition-colors duration-500 group-data-[on]:border-accent group-data-[on]:bg-accent group-data-[on]:text-ink md:size-8"
              >
                {i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-20 left-[13px] top-7 w-px bg-line md:-bottom-28 md:left-[15px] md:top-8"
                >
                  <span data-fill className="absolute -left-px top-0 h-full w-[3px] bg-accent" />
                </span>
              )}
              <div className="md:col-span-6">
                <div className="-mb-[0.14em] overflow-hidden pb-[0.14em]">
                  <h3 className="display inline-block text-[clamp(2.5rem,8vw,6rem)]">
                    {step.verb}
                  </h3>
                </div>
                <p className="mt-4 max-w-[36ch] text-pretty text-lg text-muted">{step.text}</p>
              </div>
              <div className="max-w-md md:col-span-6 md:self-center">{step.sample}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
