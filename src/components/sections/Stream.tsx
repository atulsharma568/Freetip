"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/Switch";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SAMPLE_TIP } from "@/lib/site";

const WORDS = SAMPLE_TIP.message.split(" ");

type Settings = { alerts: boolean; tts: boolean; approve: boolean };
type Phase = "idle" | "waiting" | "playing" | "done";

const SETTINGS: { key: keyof Settings; label: string; text: string }[] = [
  { key: "alerts", label: "Show alerts on stream", text: "Each tip pops up on your OBS overlay." },
  { key: "tts", label: "Read messages aloud", text: "Text-to-speech reads the fan's message." },
  { key: "approve", label: "Approve before it plays", text: "Nothing plays until you okay it." },
];

const summary = ({ alerts, tts }: Settings) =>
  alerts && tts
    ? "Viewers see the alert and hear the message."
    : alerts
      ? "Viewers see the alert. Nothing is read out."
      : tts
        ? "Viewers hear the message. No alert shows."
        : "Nothing plays on stream. You still get the tip.";

// The message, one span per word so text-to-speech can light them in turn.
function Words() {
  return WORDS.map((word, i) => (
    <span key={`${word}-${i}`}>
      {i > 0 && " "}
      <span
        data-word
        className="-mx-2 inline-block rounded-full px-2 py-0.5 data-[on=true]:bg-ink data-[on=true]:text-accent"
      >
        {word}
      </span>
    </span>
  ));
}

export function Stream() {
  const root = useRef<HTMLElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState<Settings>({ alerts: true, tts: true, approve: true });
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const [pressing, setPressing] = useState(false);
  // The first run approves itself, like the hero card's demo; once the
  // visitor touches the panel, approval waits for them.
  const auto = useRef(true);
  const userApproved = useRef(false);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Each run: queue for approval if approve-first is on, otherwise play.
  useEffect(() => {
    if (run === 0) return;
    if (!settingsRef.current.approve) {
      setPhase("playing");
      return;
    }
    setPhase("waiting");
    if (!auto.current) return;
    const press = window.setTimeout(() => setPressing(true), 1400);
    const approve = window.setTimeout(() => {
      setPressing(false);
      setPhase("playing");
    }, 1560);
    return () => {
      window.clearTimeout(press);
      window.clearTimeout(approve);
      setPressing(false);
    };
  }, [run]);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current?.querySelector("[data-screen]"),
        start: "center 55%",
        once: true,
        onEnter: () => setRun((r) => r + 1),
      });

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The stream screen starts tilted away in perspective and turns to
        // face the viewer as the page scrolls.
        gsap.fromTo(
          "[data-screen]",
          { rotationX: 24, rotationY: -18, scale: 0.88, transformOrigin: "50% 60%" },
          {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-screen]",
              start: "top bottom",
              end: "center 55%",
              scrub: 0.6,
            },
          },
        );
      });
    },
    { scope: root },
  );

  // Playing: the alert (or the audio-only line) comes in, then the message
  // lights one word at a time if text-to-speech is on.
  useGSAP(
    () => {
      if (phase !== "playing") return;
      const q = gsap.utils.selector(root);
      const words = q("[data-word]") as HTMLElement[];
      const light = (index: number) =>
        words.forEach((word, i) => {
          word.dataset.on = String(i === index);
        });
      const finish = () => setPhase("done");

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            finish();
            return;
          }
          const tl = gsap.timeline({ onComplete: finish });
          tl.fromTo(
            q("[data-tile]"),
            { clipPath: "inset(0% 0% 100% 0% round 1.25rem)" },
            {
              clipPath: "inset(0% 0% 0% 0% round 1.25rem)",
              duration: 0.9,
              ease: "expo.out",
              clearProps: "clipPath",
            },
          );
          if (settings.tts) {
            words.forEach((_, i) => {
              tl.call(light, [i], i === 0 ? "+=0.2" : "+=0.5");
            });
            tl.call(light, [-1], "+=0.5");
          }
          return () => light(-1);
        },
      );
    },
    { dependencies: [phase, run], scope: root },
  );

  useEffect(() => {
    if (phase === "done" && userApproved.current) {
      userApproved.current = false;
      againRef.current?.focus();
    }
  }, [phase]);

  const replay = () => {
    auto.current = false;
    setRun((r) => r + 1);
  };

  const toggle = (key: keyof Settings, on: boolean) => {
    auto.current = false;
    setSettings((s) => ({ ...s, [key]: on }));
    if (run > 0) setRun((r) => r + 1);
  };

  const approve = () => {
    auto.current = false;
    userApproved.current = true;
    setPhase("playing");
  };

  const shown = phase === "playing" || phase === "done";
  const Speaker = settings.tts ? SpeakerHigh : SpeakerSlash;

  return (
    <section
      ref={root}
      id="stream"
      className="mx-auto grid max-w-7xl scroll-mt-24 gap-x-8 gap-y-12 px-6 pb-32 md:grid-cols-12 md:pb-48"
    >
      <div className="min-w-0 md:col-span-5">
        <h2 className="display text-[clamp(2.5rem,6vw,4.5rem)]">
          On your stream
        </h2>
        <div className="mt-8 max-w-[34ch] space-y-5 text-pretty text-lg text-muted md:mt-12">
          <p>
            <span className="text-text">OBS alerts.</span> Tips can show up on
            your stream with the fan&apos;s optional name, the amount and their
            message.
          </p>
          <p>
            <span className="text-text">Safer text-to-speech.</span> Messages are
            screened first, and with approve-first on, nothing is read out until
            you okay it.
          </p>
        </div>

        <div
          role="group"
          aria-labelledby="sample-settings"
          className="mt-10 max-w-md rounded-surface border border-line/60 bg-surface p-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <p id="sample-settings" className="font-semibold">
              Sample settings
            </p>
            <p className="text-sm text-muted">Change them and watch</p>
          </div>
          <ul className="mt-3">
            {SETTINGS.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-4 border-t border-line/60 py-3"
              >
                <div>
                  <label
                    htmlFor={`stream-${item.key}`}
                    className="cursor-pointer text-sm font-medium"
                  >
                    {item.label}
                  </label>
                  <p className="text-sm text-muted">{item.text}</p>
                </div>
                <Switch
                  id={`stream-${item.key}`}
                  checked={settings[item.key]}
                  onChange={(on) => toggle(item.key, on)}
                />
              </li>
            ))}
          </ul>
          <p role="status" className="border-t border-line/60 pt-3 text-sm text-text">
            {summary(settings)}
          </p>
          <div className="mt-4 flex min-h-16 items-center">
            {phase === "waiting" ? (
              <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-field bg-raised p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">Waiting for your approval</p>
                  <p className="truncate text-sm font-medium">
                    {SAMPLE_TIP.name} · ₹{SAMPLE_TIP.amount} · “{SAMPLE_TIP.message}”
                  </p>
                </div>
                <button
                  type="button"
                  onClick={approve}
                  data-pressing={pressing}
                  className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-ink transition-transform duration-150 ease-out-expo active:scale-[0.97] data-[pressing=true]:scale-[0.94]"
                >
                  Approve
                </button>
              </div>
            ) : phase === "done" ? (
              <button
                ref={againRef}
                type="button"
                onClick={replay}
                className="beam inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium transition-transform duration-150 active:scale-[0.97]"
              >
                <ArrowCounterClockwise weight="bold" aria-hidden="true" />
                Send the sample tip again
              </button>
            ) : null}
          </div>
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

          {shown && settings.alerts && (
            <div
              key={run}
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
                <Speaker
                  weight="bold"
                  aria-label={settings.tts ? "Read aloud" : "Not read aloud"}
                  className="mt-0.5 size-6 shrink-0 md:mt-1 md:size-7"
                />
                <span>
                  <Words />
                </span>
              </p>
            </div>
          )}

          {shown && !settings.alerts && settings.tts && (
            <div
              key={run}
              data-tile
              className="flex w-fit max-w-full items-start gap-3 rounded-surface border border-line bg-raised p-4 text-base md:text-lg"
            >
              <SpeakerHigh weight="bold" aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm text-muted">
                  Audio only. No alert on screen. Sample.
                </span>
                <span className="[word-spacing:0.25em]">
                  <Words />
                </span>
              </span>
            </div>
          )}

          {shown && !settings.alerts && !settings.tts && (
            <p key={run} data-tile className="text-sm text-muted">
              Nothing shows or plays on stream. The tip still reaches you.
            </p>
          )}

          {!shown && (
            <p className="text-sm text-muted">
              {phase === "waiting" ? "Waiting for your approval. Viewers see nothing yet." : " "}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
