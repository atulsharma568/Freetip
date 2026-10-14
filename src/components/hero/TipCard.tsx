"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";
import ClickSpark, {
  type ClickSparkHandle,
} from "@/components/react-bits/ClickSpark";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { INK_HEX, SAMPLE_HANDLE, SAMPLE_TIP, SITE_HOST } from "@/lib/site";

const AMOUNTS = [50, 100, 250, 500];
const DEMO_NAME = SAMPLE_TIP.name;
const DEMO_MESSAGE = SAMPLE_TIP.message;

type Method = "upi" | "card";
type Beat = 0 | 1 | 2 | 3;

export function TipCard({
  onBeat,
  ready = true,
}: {
  onBeat: (beat: Beat) => void;
  // The demo waits for this, so it never plays while the hero hands move.
  ready?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const tipAgainRef = useRef<HTMLButtonElement>(null);
  const sparkRef = useRef<ClickSparkHandle>(null);
  const demo = useRef<gsap.core.Timeline | null>(null);
  const userAction = useRef<"submit" | "again" | null>(null);

  const [amount, setAmount] = useState(100);
  const [method, setMethod] = useState<Method>("upi");
  const [paid, setPaid] = useState(false);

  const amountRef = useRef(amount);
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  const readyRef = useRef(ready);
  const startDemo = () => {
    const tl = demo.current;
    if (!tl || !entered.current || !readyRef.current) return;
    gsap.delayedCall(0.8, () => {
      if (demo.current === tl && !tl.isActive() && tl.progress() === 0) tl.play();
    });
  };

  useEffect(() => {
    readyRef.current = ready;
    if (ready) startDemo();
  }, [ready]);

  const reset = () => {
    setPaid(false);
    setAmount(100);
    setMethod("upi");
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    userAction.current = "submit";
    setPaid(true);
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
            setAmount(SAMPLE_TIP.amount);
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
                if (messageRef.current)
                  messageRef.current.value = DEMO_MESSAGE.slice(
                    0,
                    Math.round(typed.message),
                  );
              },
            },
            "+=0.2",
          )
          .call(() => setPaid(true), undefined, "+=0.7")
          .call(() => onBeat(3), undefined, "+=0.5")
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
      const total = totalRef.current;
      if (!field || !total) return;
      const target = amountRef.current;

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            total.textContent = `₹${target}`;
            return;
          }
          total.textContent = "₹0";
          const counter = { value: 0 };
          gsap
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
            .to(
              counter,
              {
                value: target,
                duration: 0.9,
                ease: "power2.out",
                onUpdate: () => {
                  total.textContent = `₹${Math.round(counter.value)}`;
                },
              },
              0.3,
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
        },
      );
    },
    { dependencies: [paid], scope: root },
  );

  const fieldClass =
    "h-12 w-full rounded-field border border-control bg-ground px-4 text-base text-text placeholder:text-muted focus-visible:border-accent";
  const chipClass =
    "flex cursor-pointer items-center justify-center rounded-full border border-control transition-colors duration-200 hover:border-muted peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";

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
        className="relative overflow-hidden rounded-surface border border-line/60 bg-surface p-6"
      >
        <p className="mb-5 text-sm text-muted">Sample page. No payment is taken.</p>
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="display grid size-11 shrink-0 place-items-center rounded-full bg-accent text-xl text-ink"
          >
            A
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Aarav Plays</p>
            <p className="numeric truncate text-sm text-muted">
              {SITE_HOST}/{SAMPLE_HANDLE}
            </p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          inert={paid}
          className="mt-6 space-y-5"
          autoComplete="off"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Amount</legend>
            <div className="grid grid-cols-4 gap-2">
              {AMOUNTS.map((value) => (
                <label key={value} className="relative">
                  <input
                    type="radio"
                    name="amount"
                    value={value}
                    checked={amount === value}
                    onChange={() => setAmount(value)}
                    className="peer sr-only"
                  />
                  <span className={`numeric h-12 text-base ${chipClass}`}>
                    ₹{value}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-[1fr_1.6fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">
                Name (optional)
              </span>
              <input
                ref={nameRef}
                name="name"
                type="text"
                maxLength={30}
                placeholder="Optional / anonymous"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">
                Message (limit applies)
              </span>
              <input
                ref={messageRef}
                name="message"
                type="text"
                maxLength={140}
                placeholder="Say something nice"
                className={fieldClass}
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Pay with</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["upi", "card"] as const).map((value) => (
                <label key={value} className="relative">
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="peer sr-only"
                  />
                  <span className={`h-11 text-sm font-medium ${chipClass}`}>
                    {value === "upi" ? "UPI" : "Card"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm leading-5 text-muted">
            No account or email needed. Leave your name blank to stay anonymous.
            Messages are screened and only read out after creator approval.
          </p>

          <button
            type="submit"
            className="h-14 w-full rounded-full bg-accent text-base font-semibold text-ink transition-transform duration-200 active:scale-[0.98]"
          >
            Tip ₹{amount} with {method === "upi" ? "UPI" : "card"}
          </button>
        </form>

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
            <span
              ref={totalRef}
              aria-hidden="true"
              className="numeric text-[clamp(4.5rem,18vw,7rem)] font-semibold leading-none tracking-tight"
            >
              ₹{amount}
            </span>
            <p data-pop className="text-lg font-semibold">
              <span className="sr-only">₹{amount}. </span>
              Tip sent to Aarav.
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
