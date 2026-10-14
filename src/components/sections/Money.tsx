"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Odometer, spinReels } from "@/components/ui/Odometer";

export function Money() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap.fromTo(
          q("[data-tile]"),
          { clipPath: "inset(0% 0% 100% 0% round 1.25rem)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 1.25rem)",
            duration: 1.1,
            ease: "expo.out",
            clearProps: "clipPath",
            stagger: 0.12,
            scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
          },
        );
        // The fee rolls in on odometer reels once its tile is well in view.
        const fee = q("[data-fee]")[0];
        const spins = spinReels(gsap, gsap.utils.toArray<HTMLElement>("[data-reel]", fee));
        const tl = gsap.timeline({
          paused: true,
          scrollTrigger: { trigger: fee, start: "top 80%", once: true },
        });
        // Hidden until it spins, so it never sits on "0%".
        gsap.set(fee, { opacity: 0 });
        tl.to(fee, { opacity: 1, duration: 0.2, ease: "none" }, 0.35);
        spins.forEach((spin) => tl.add(spin, 0.35));
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="fees"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-32 md:pb-48"
    >
      <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">
        Payments and fees
      </h2>
      <div className="mt-16 grid gap-4 md:mt-24 md:grid-cols-12 md:grid-rows-[auto_1fr]">
        <div
          data-tile
          className="flex min-h-[16rem] flex-col justify-between rounded-surface bg-accent p-8 text-ink md:col-span-7 md:row-span-2 md:p-10"
        >
          <p className="display text-[clamp(6rem,16vw,11rem)] leading-[0.85]">
            UPI
          </p>
          <p className="max-w-[26ch] text-pretty text-xl font-medium">
            Fans pay with the UPI app already on their phone.
          </p>
        </div>
        <div
          data-tile
          className="rounded-surface border border-line bg-surface p-8 md:col-span-5"
        >
          <p className="display text-[clamp(2.25rem,4vw,3rem)]">Cards</p>
          <p className="mt-3 max-w-[30ch] text-pretty text-lg text-muted">
            Fans can also pay by card, from the same page.
          </p>
        </div>
        <div
          data-tile
          className="flex flex-col justify-end rounded-surface border border-line bg-raised p-8 md:col-span-5 md:p-10"
        >
          <span data-fee className="mb-6 block">
            <Odometer
              value={5}
              prefix=""
              suffix="%"
              className="text-[clamp(4.5rem,10vw,7rem)] font-semibold tracking-tight"
            />
          </span>
          <h3 className="display text-[clamp(2.25rem,4vw,3rem)]">What it costs</h3>
          <p className="mt-4 max-w-[34ch] text-pretty text-2xl font-medium text-text">
            We take 5% of every tip.
          </p>
        </div>
      </div>
    </section>
  );
}
