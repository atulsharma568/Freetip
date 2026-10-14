"use client";

import { useRef } from "react";
import { SpeakerHigh } from "@phosphor-icons/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SAMPLE_TIP } from "@/lib/site";

const WORDS = SAMPLE_TIP.message.split(" ");

export function Stream() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        const screen = q("[data-screen]");
        const tile = q("[data-tile]");
        const words = q("[data-word]") as HTMLElement[];
        const light = (index: number) =>
          words.forEach((word, i) => {
            word.dataset.on = String(i === index);
          });

        // The stream screen starts tilted away in perspective and turns to
        // face the viewer as the page scrolls.
        gsap.fromTo(
          screen,
          { rotationX: 24, rotationY: -18, scale: 0.88, transformOrigin: "50% 60%" },
          {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: screen[0],
              start: "top bottom",
              end: "center 55%",
              scrub: 0.6,
            },
          },
        );

        // Once the screen faces the viewer, the alert pops in and reads out.
        const tl = gsap.timeline({
          scrollTrigger: { trigger: screen[0], start: "center 55%", once: true },
        });
        tl.fromTo(
          tile,
          { clipPath: "inset(0% 0% 100% 0% round 1.25rem)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 1.25rem)",
            duration: 0.9,
            ease: "expo.out",
            clearProps: "clipPath",
          },
        );
        words.forEach((_, i) => {
          tl.call(light, [i], i === 0 ? "+=0.2" : "+=0.5");
        });
        tl.call(light, [-1], "+=0.5");

        return () => light(-1);
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="stream"
      className="mx-auto grid max-w-7xl scroll-mt-24 gap-x-8 gap-y-12 px-6 pb-32 md:grid-cols-12 md:pb-48"
    >
      <div className="md:col-span-5">
        <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">
          On your stream
        </h2>
        <div className="mt-8 max-w-[34ch] space-y-5 text-pretty text-lg text-muted md:mt-12">
          <p>
            <span className="text-text">OBS alerts.</span> Every tip shows up on
            your stream with the fan&apos;s optional name, the amount and their message.
          </p>
          <p>
            <span className="text-text">Safer text-to-speech.</span> Messages are
            screened and only read out after you approve them.
          </p>
        </div>
      </div>
      <div className="[perspective:1600px] md:col-span-7">
        <div
          data-screen
          className="flex min-h-[24rem] flex-col justify-between gap-8 rounded-surface border border-line bg-surface p-4 md:min-h-[30rem] md:p-6"
        >
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-1 font-semibold">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              LIVE
            </span>
            <span className="text-muted">Sample stream</span>
          </div>
          <div
            data-tile
            role="group"
            aria-label="Sample stream alert"
            className="on-accent w-full max-w-[26rem] rounded-surface bg-accent p-6 text-ink md:p-8"
          >
            <p className="text-sm font-semibold">
              Sample alert. Nothing is sent to a stream.
            </p>
            <p className="mt-6 text-lg font-medium">{SAMPLE_TIP.name} tipped</p>
            <p className="numeric mt-2 text-[clamp(3.5rem,10vw,5rem)] font-semibold leading-none tracking-tight">
              ₹{SAMPLE_TIP.amount}
            </p>
            <p className="mt-5 flex items-start gap-3 text-lg font-medium [word-spacing:0.25em] md:text-2xl">
              <SpeakerHigh
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 size-6 shrink-0 md:mt-1 md:size-7"
              />
              <span>
                {WORDS.map((word, i) => (
                  <span key={`${word}-${i}`}>
                    {i > 0 && " "}
                    <span
                      data-word
                      className="-mx-2 inline-block rounded-full px-2 py-0.5 data-[on=true]:bg-ink data-[on=true]:text-accent"
                    >
                      {word}
                    </span>
                  </span>
                ))}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
