"use client";

import { type CSSProperties } from "react";
import { useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { AlertFan, type FanAlert } from "./AlertFan";
import { TipCard, type SentTip } from "./TipCard";

const BEATS = ["Your link.", "Their UPI.", "Your bank."];

const step = (i: number) => ({ "--i": i }) as CSSProperties;

// Labelled sample alerts already fanned out behind the card.
const FIRST_ALERTS: FanAlert[] = [
  { id: 2, name: "Anonymous", amount: 100, message: "Love the stream" },
  { id: 1, name: "Kabir", amount: 50, message: "GG!" },
];

export function Hero() {
  const [beat, setBeat] = useState(0);
  const [alerts, setAlerts] = useState(FIRST_ALERTS);
  // Each tip the card "sends" deals a new alert to the front of the fan.
  // Four are kept so the oldest can fade out at the back.
  const addAlert = (tip: SentTip) =>
    setAlerts((list) => [{ ...tip, id: list[0].id + 1 }, ...list].slice(0, 4));

  return (
    <section className="relative overflow-x-clip">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 items-end gap-x-10 gap-y-14 px-6 pb-16 pt-24 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="display text-[clamp(3.25rem,9vw,6rem)]">
            {BEATS.map((text, i) => (
              <span
                key={text}
                data-active={beat === i + 1}
                className="beat rise block w-fit"
                style={step(i)}
              >
                {text}
              </span>
            ))}
          </h1>
          <p
            className="rise mt-8 max-w-[34ch] text-pretty text-lg text-muted md:text-xl"
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
                className="group inline-flex h-14 items-center gap-4 rounded-full bg-accent pl-8 pr-2 text-base font-semibold text-ink transition-transform duration-200 active:scale-[0.97]"
              >
                <RollText>Claim your handle</RollText>
                <span
                  aria-hidden="true"
                  className="relative grid size-10 place-items-center overflow-hidden rounded-full bg-ink text-accent"
                >
                  <ArrowUpRight
                    weight="bold"
                    className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-7 group-hover:translate-x-7 group-focus-visible:-translate-y-7 group-focus-visible:translate-x-7"
                  />
                  <ArrowUpRight
                    weight="bold"
                    className="absolute -translate-x-7 translate-y-7 transition-transform duration-500 ease-out-expo group-hover:translate-x-0 group-hover:translate-y-0 group-focus-visible:translate-x-0 group-focus-visible:translate-y-0"
                  />
                </span>
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
          <div className="enter relative w-full" style={step(2)}>
            <AlertFan alerts={alerts} />
            <div className="relative z-10">
              <TipCard onBeat={setBeat} onTip={addAlert} ready />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
