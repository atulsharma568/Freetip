"use client";

import { useState, type CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Magnetic } from "@/components/motion/Magnetic";
import { TipCard } from "./TipCard";

const BEATS = ["Your link.", "Their UPI.", "Your bank."];

const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function Hero() {
  const [beat, setBeat] = useState(0);

  return (
    <section className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 items-end gap-x-10 gap-y-14 px-6 pb-16 pt-24 lg:grid-cols-12">
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
              className="inline-flex h-14 items-center gap-2 rounded-full bg-accent px-8 text-base font-semibold text-ink transition-transform duration-200 active:scale-[0.97]"
            >
              Claim your handle
              <ArrowUpRight weight="bold" aria-hidden="true" />
            </a>
          </Magnetic>
          <a
            href="#how"
            className="text-base text-text underline decoration-line transition-colors duration-200 hover:decoration-accent"
          >
            See how it works
          </a>
        </div>
      </div>
      <div
        className="enter w-full max-w-[26rem] lg:col-span-5 lg:self-start lg:justify-self-end"
        style={step(2)}
      >
        <TipCard onBeat={setBeat} />
      </div>
    </section>
  );
}
