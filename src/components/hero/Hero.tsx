"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { HeroHands } from "./HeroHands";
import { TipCard } from "./TipCard";

const BEATS = ["Your link.", "Their UPI.", "Your bank."];

const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero() {
  const [beat, setBeat] = useState(0);
  const [handsDone, setHandsDone] = useState(false);

  return (
    <section className="relative overflow-x-clip">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 items-end gap-x-10 gap-y-14 px-6 pb-16 pt-24 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="display text-[clamp(3.25rem,9vw,6rem)]">
            {BEATS.map((text, i) => (
              <span
                key={text}
                data-active={beat === i + 1}
                className="beat enter block w-fit"
                style={step(i)}
              >
                {text}
              </span>
            ))}
          </h1>
          <p
            className="enter mt-8 max-w-[34ch] text-pretty text-lg text-muted md:text-xl"
            style={step(3)}
          >
            Tips for YouTube streamers, with OBS alerts and text-to-speech. Fans
            pay with UPI or card, no account needed.
          </p>
          <div
            className="enter mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
            style={step(4)}
          >
            <Magnetic>
              <a
                href="#claim"
                className="group inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-base font-semibold text-ink transition-transform duration-200 active:scale-[0.97]"
              >
                <RollText>Claim your handle</RollText>
                <ArrowUpRight
                  weight="bold"
                  aria-hidden="true"
                  className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-focus-visible:-translate-y-0.5 group-focus-visible:translate-x-0.5"
                />
              </a>
            </Magnetic>
            <a
              href="#how"
              className="beam inline-flex h-14 items-center rounded-full border border-line px-8 text-base font-semibold text-text"
            >
              <RollText>See how it works</RollText>
            </a>
          </div>
        </div>
        <div className="w-full max-w-[26rem] lg:col-span-5 lg:self-start lg:justify-self-end">
          <div className="lg:h-[11.5rem]">
            <div className="-ml-6 h-[9.5rem] w-screen lg:absolute lg:inset-x-0 lg:-mt-10 lg:ml-0 lg:h-[14rem] lg:w-auto">
              <HeroHands onDone={() => setHandsDone(true)} />
            </div>
          </div>
          <div className="enter mt-3 w-full" style={step(2)}>
            <TipCard onBeat={setBeat} ready={handsDone} />
          </div>
        </div>
      </div>
    </section>
  );
}
