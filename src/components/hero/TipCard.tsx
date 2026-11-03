"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowCounterClockwise, ArrowRight, Check } from "@phosphor-icons/react";
import ClickSpark, {
  type ClickSparkHandle,
} from "@/components/react-bits/ClickSpark";
import { RollText } from "@/components/motion/RollText";
import { Switch } from "@/components/ui/Switch";
import { Odometer, spinReels } from "@/components/ui/Odometer";
import { StepHeading } from "@/components/tip/StepHeading";
import { tipTier } from "@/lib/tip-tier";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { UplinkPanel } from "./UplinkPanel";
import { INK_HEX, SAMPLE_CREATOR_NAME, SAMPLE_HANDLE, SAMPLE_TIP, SITE_HOST } from "@/lib/site";

// The same shape as the real tip page: a handful of steps, then "Custom".
const AMOUNTS = [20, 50, 100, 250, 500];
const MIN_AMOUNT = 20;
const MESSAGE_MAX = 140;
const DEMO_NAME = SAMPLE_TIP.name;
const DEMO_MESSAGE = SAMPLE_TIP.message;
// How long the uplink panel shows before the success state.
const SEND_MS = 1800;

export type SentTip = { name: string; amount: number; message: string };
type Beat = 0 | 1 | 2 | 3;

export function TipCard({
  onBeat,
  onTip,
  ready = true,
}: {
  onBeat: (beat: Beat) => void;
  // Called once the success state has settled, with what was "sent".
  onTip?: (tip: SentTip) => void;
  // The demo waits for this, so it never plays while the hero hands move.
  ready?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const tipAgainRef = useRef<HTMLButtonElement>(null);
  const sparkRef = useRef<ClickSparkHandle>(null);
  const demo = useRef<gsap.core.Timeline | null>(null);
  const pendingDemo = useRef<gsap.core.Tween | null>(null);
  const userAction = useRef<"submit" | "again" | null>(null);

  // "custom" shows a field for any amount, like the real page.
  const [selected, setSelected] = useState<number | "custom">(100);
  const [custom, setCustom] = useState("");
  const [messageLength, setMessageLength] = useState(0);
  const amount = selected === "custom" ? Math.min(100000, parseInt(custom, 10) || 0) : selected;
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [paid, setPaid] = useState(false);
  const sendTimer = useRef<number | undefined>(undefined);

  const amountRef = useRef(amount);
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  const readyRef = useRef(ready);
  const startDemo = () => {
    const tl = demo.current;
    if (!tl || !entered.current || !readyRef.current) return;
    pendingDemo.current?.kill();
    pendingDemo.current = gsap.delayedCall(0.8, () => {
      if (demo.current === tl && !tl.isActive() && tl.progress() === 0) tl.play();
    });
  };

  useEffect(() => {
    readyRef.current = ready;
    if (ready) startDemo();
  }, [ready]);

  const reset = () => {
    window.clearTimeout(sendTimer.current);
    setSending(false);
    setPaid(false);
    setAnonymous(false);
    setSelected(100);
    setCustom("");
    setMessageLength(0);
    if (nameRef.current) nameRef.current.value = "";
    if (messageRef.current) messageRef.current.value = "";
    onBeat(0);
  };

  const stopDemo = () => {
    if (!demo.current) return;
    demo.current.kill();
    demo.current = null;
    reset();
  };

  // The uplink panel counts the tip out, then the success state.
  // Reduced motion skips straight to success.
  const send = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPaid(true);
      return;
    }
    setSending(true);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      setPaid(true);
    }, SEND_MS);
  };

  useEffect(() => () => {
    window.clearTimeout(sendTimer.current);
    pendingDemo.current?.kill();
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (amount < MIN_AMOUNT) return;
    userAction.current = "submit";
    send();
  };

  const onAnonymous = (on: boolean) => {
    setAnonymous(on);
    if (on && nameRef.current) nameRef.current.value = "";
  };

  const tipAgain = () => {
    userAction.current = "again";
    reset();
  };

  useEffect(() => {
    if (paid && userAction.current === "submit") {
      tipAgainRef.current?.focus();
    } else if (!paid && userAction.current === "again") {
      root.current
        ?.querySelector<HTMLInputElement>('input[name="amount"]:checked')
        ?.focus();
    }
    userAction.current = null;
  }, [paid]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const typed = { name: 0, message: 0 };
        const tl = gsap.timeline({ paused: true });
        demo.current = tl;

        tl.call(() => onBeat(1))
          .to({}, { duration: 1.3 })
          .call(() => {
            onBeat(2);
            setSelected(SAMPLE_TIP.amount);
          })
          .to(
            typed,
            {
              name: DEMO_NAME.length,
              duration: 0.5,
              ease: "none",
              onUpdate: () => {
                if (nameRef.current)
                  nameRef.current.value = DEMO_NAME.slice(0, Math.round(typed.name));
              },
            },
            "+=0.6",
          )
          .to(
            typed,
            {
              message: DEMO_MESSAGE.length,
              duration: 1.4,
              ease: "none",
              onUpdate: () => {
                if (messageRef.current) {
                  const text = DEMO_MESSAGE.slice(0, Math.round(typed.message));
                  messageRef.current.value = text;
                  setMessageLength(text.length);
                }
              },
            },
            "+=0.2",
          )
          .call(send, undefined, "+=0.7")
          .call(() => onBeat(3), undefined, `+=${SEND_MS / 1000 + 0.5}`)
          .to({}, { duration: 3.6 })
          .call(() => {
            demo.current = null;
            reset();
          });

        ScrollTrigger.create({
          trigger: root.current,
          start: "top 50%",
          once: true,
          onEnter: () => {
            entered.current = true;
            startDemo();
          },
        });

        return () => {
          tl.kill();
          demo.current = null;
        };
      });
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (!paid) return;
      const field = successRef.current;
      if (!field) return;
      const reels = gsap.utils.toArray<HTMLElement>("[data-reel]", field);
      const name = nameRef.current?.value.trim();
      const sent: SentTip = {
        name: name || "Anonymous",
        amount: amountRef.current,
        message: messageRef.current?.value.trim() ?? "",
      };

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            onTip?.(sent);
            return;
          }
          const tl = gsap
            .timeline()
            .fromTo(
              field,
              { clipPath: "circle(0% at 50% 90%)" },
              { clipPath: "circle(140% at 50% 90%)", duration: 0.85, ease: "expo.out" },
            )
            .fromTo(
              field.querySelectorAll("[data-pop]"),
              { y: 18, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.07 },
              0.25,
            )

            .call(
              () => {
                const badge = field.querySelector("[data-badge]");
                const card = root.current;
                if (!badge || !card) return;
                const b = badge.getBoundingClientRect();
                const c = card.getBoundingClientRect();
                sparkRef.current?.spark(
                  b.left - c.left + b.width / 2,
                  b.top - c.top + b.height / 2,
                );
              },
              undefined,
              0.5,
            );
          // Odometer: every reel spins a full turn and lands on its digit, the
          // rightmost last, like a meter settling.
          spinReels(gsap, reels).forEach((spin) => tl.add(spin, 0.25));
          // The new alert joins the fan only after the amount has landed.
          tl.call(() => onTip?.(sent), undefined, 1.5);
        },
      );
    },
    { dependencies: [paid], scope: root },
  );

  const fieldClass =
    "h-12 w-full rounded-field border border-control bg-ground px-4 text-base text-text placeholder:text-muted focus-visible:border-accent";
  const chipClass =
    "flex h-12 cursor-pointer items-center justify-center rounded-full border border-control px-5 text-sm transition-[transform,background-color,border-color,color] duration-150 hover:border-muted active:scale-[0.97] peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";
  const digitCount = String(amount).length;

  return (
    <ClickSpark
      ref={sparkRef}
      manual
      sparkColor={INK_HEX}
      sparkCount={10}
      sparkRadius={44}
      sparkSize={12}
      sparkWidth={2.5}
      spread={220}
      direction={0}
      duration={700}
    >
      <div
        ref={root}
        role="group"
        aria-label="Sample tip page"
        onPointerDownCapture={stopDemo}
        onFocusCapture={stopDemo}
        className="relative overflow-hidden rounded-surface border border-line/60 bg-surface p-5 sm:p-6"
      >
        <header className="flex items-center gap-3">
          <span className="inline-block shrink-0 rounded-full border-2 border-accent p-1">
            <span
              aria-hidden="true"
              className="display grid size-11 place-items-center rounded-full bg-accent text-xl text-ink"
            >
              {SAMPLE_CREATOR_NAME[0]}
            </span>
          </span>
          <div className="min-w-0 space-y-1">
            <p className="flex items-start gap-2 text-xs font-medium text-muted">
              <span aria-hidden="true" className="live-dot mt-1 shrink-0" />
              Sample page. No payment is taken.
            </p>
            <p className="truncate font-semibold leading-tight">{SAMPLE_CREATOR_NAME}</p>
            <p className="numeric truncate text-sm text-muted">
              {SITE_HOST}/{SAMPLE_HANDLE}
            </p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          inert={paid || sending}
          className="mt-5 space-y-4"
          autoComplete="off"
        >
          {/* 01 Amount */}
          <div className="space-y-3">
            <StepHeading n={1} title="Amount" />
            <div className="space-y-1 rounded-surface bg-ground px-5 py-4 text-center">
              <p
                key={amount}
                aria-hidden="true"
                className={`amount-numeral numeric font-semibold leading-none text-accent ${
                  digitCount >= 5
                    ? "text-[clamp(2rem,9vw,2.75rem)]"
                    : digitCount === 4
                      ? "text-[clamp(2.5rem,11vw,3.25rem)]"
                      : "text-[clamp(3rem,13vw,4rem)]"
                }`}
              >
                ₹{amount.toLocaleString("en-IN")}
              </p>
              <p className="text-sm text-muted">{tipTier(amount)}</p>
            </div>
            <fieldset>
              <legend className="sr-only">Choose an amount in rupees</legend>
              <div className="grid grid-cols-3 gap-2">
                {AMOUNTS.map((value) => (
                  <label key={value} className="relative">
                    <input
                      type="radio"
                      name="amount"
                      value={value}
                      checked={selected === value}
                      onChange={() => setSelected(value)}
                      className="peer sr-only"
                    />
                    <span className={`numeric ${chipClass}`}>₹{value}</span>
                  </label>
                ))}
                <label className="relative">
                  <input
                    type="radio"
                    name="amount"
                    value="custom"
                    checked={selected === "custom"}
                    onChange={() => setSelected("custom")}
                    className="peer sr-only"
                  />
                  <span className={chipClass}>Custom</span>
                </label>
              </div>
            </fieldset>
            {selected === "custom" && (
              <div className="relative flex items-center">
                <span aria-hidden="true" className="numeric pointer-events-none absolute left-4 text-muted">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter amount"
                  aria-label="Custom tip amount in rupees"
                  className={`numeric ${fieldClass} pl-8`}
                />
              </div>
            )}
          </div>

          {/* 02 Your note */}
          <div className="space-y-3">
            <StepHeading n={2} title="Your note" />
            <div className="flex items-center gap-3">
              <Switch id="tip-anonymous" checked={anonymous} onChange={onAnonymous} />
              <label htmlFor="tip-anonymous" className="cursor-pointer select-none text-sm text-text">
                Tip anonymously
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="sample-name" className="text-sm text-muted">
                Your name <span className="text-control">(optional)</span>
              </label>
              <input
                id="sample-name"
                ref={nameRef}
                name="name"
                type="text"
                maxLength={50}
                disabled={anonymous}
                placeholder={anonymous ? "Hidden" : "Riya, Kabir…"}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-40`}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="sample-message" className="text-sm text-muted">
                  Message <span className="text-control">(optional)</span>
                </label>
                <p className="numeric text-xs text-muted">
                  {messageLength}/{MESSAGE_MAX}
                </p>
              </div>
              <textarea
                id="sample-message"
                ref={messageRef}
                name="message"
                maxLength={MESSAGE_MAX}
                rows={2}
                onChange={(e) => setMessageLength(e.target.value.length)}
                placeholder="Great stream today!"
                className="w-full resize-none rounded-field border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted focus-visible:border-accent"
              />
            </div>
          </div>

          {/* 03 Send */}
          <div className="space-y-3">
            <StepHeading n={3} title="Send" />
            <p className="text-sm text-muted">
              Pay with UPI or a card. You pay exactly the tip. No account or email needed.
            </p>
            <button
              type="submit"
              disabled={amount < MIN_AMOUNT}
              className="beam on-accent inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent text-base font-semibold text-ink transition-[opacity,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RollText>{`Tip ₹${amount || "—"}`}</RollText>
              <ArrowRight weight="bold" aria-hidden="true" />
            </button>
          </div>
        </form>

        {sending && (
          <>
            <p role="status" className="sr-only">
              Sending ₹{amount}
            </p>
            <UplinkPanel amount={amount} duration={SEND_MS / 1000} />
          </>
        )}

        {paid && (
          <div
            ref={successRef}
            role="status"
            className="on-accent absolute inset-0 flex flex-col items-center justify-center gap-4 bg-accent p-8 text-center text-ink"
          >
            <span
              data-pop
              data-badge
              className="grid size-12 place-items-center rounded-full bg-ink text-accent"
            >
              <Check weight="bold" size={24} aria-hidden="true" />
            </span>
            <Odometer
              value={amount}
              className="text-[clamp(4.5rem,18vw,7rem)] font-semibold tracking-tight"
            />
            <p data-pop className="text-lg font-semibold">
              <span className="sr-only">₹{amount}. </span>
              Tip sent to {SAMPLE_CREATOR_NAME}.
            </p>
            <p data-pop className="text-sm">
              Sample only. No money moved.
            </p>
            <button
              ref={tipAgainRef}
              type="button"
              data-pop
              onClick={tipAgain}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink px-5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-accent"
            >
              <ArrowCounterClockwise weight="bold" aria-hidden="true" />
              Tip again
            </button>
          </div>
        )}
      </div>
    </ClickSpark>
  );
}
