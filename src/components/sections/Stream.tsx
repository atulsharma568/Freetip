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
        const tile = q("[data-tile]");
        const words = q("[data-word]") as HTMLElement[];
        const light = (index: number) =>
          words.forEach((word, i) => {
            word.dataset.on = String(i === index);
          });

        const tl = gsap.timeline({
          scrollTrigger: { trigger: tile[0], start: "top 75%", once: true },
        });
        tl.fromTo(
          tile,
          { clipPath: "inset(0% 0% 100% 0% round 1.25rem)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 1.25rem)",
            duration: 1.1,
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
            your stream with the fan&apos;s name, the amount and their message.
          </p>
          <p>
            <span className="text-text">Text-to-speech.</span> The message is
            read out loud as the alert plays.
          </p>
        </div>
      </div>
      <div
        data-tile
        role="group"
        aria-label="Sample stream alert"
        className="on-accent flex min-h-[22rem] flex-col justify-between rounded-surface bg-accent p-8 text-ink md:col-span-7 md:min-h-[26rem] md:p-10"
      >
        <p className="text-sm font-semibold">
          Sample alert. Nothing is sent to a stream.
        </p>
        <div>
          <p className="text-xl font-medium">{SAMPLE_TIP.name} tipped</p>
          <p className="numeric mt-2 text-[clamp(4.5rem,18vw,7rem)] font-semibold leading-none tracking-tight">
            ₹{SAMPLE_TIP.amount}
          </p>
          <p className="mt-6 flex items-start gap-3 text-xl font-medium [word-spacing:0.25em] md:gap-4 md:text-3xl">
            <SpeakerHigh
              weight="bold"
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 md:mt-1 md:size-8"
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
    </section>
  );
}
