"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { AlertMode } from "@/lib/alerts";
import type { PinOffer } from "@/lib/pinned";
import { Switch } from "@/components/ui/Switch";
import { TickLoader } from "@/components/ui/TickLoader";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { createTipOrder } from "@/app/actions/tip";
import { messageLimitFor, nextMessageStep } from "@/lib/message-limit";
import { tipTier } from "@/lib/tip-tier";
import { AlertCard } from "@/components/tip/AlertCard";
import { CreatorPanel, QrTile } from "@/components/tip/CreatorPanel";
import { ExtraPicker, type Extra } from "@/components/tip/ExtraPicker";
import { FieldNote } from "@/components/tip/FieldNote";
import { StepHeading } from "@/components/tip/StepHeading";
import { SuccessScreen } from "@/components/tip/SuccessScreen";
import { rupeeText } from "@/components/tip/format";
import type { TipRule, TipSound } from "./creator";

export type { Extra };

// Razorpay checkout is loaded via a <script> tag at payment time.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, any>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && typeof window.Razorpay !== "undefined") {
      resolve();
      return;
    }
    const existing = document.getElementById("rzp-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Script load error")));
      return;
    }
    const script = document.createElement("script");
    script.id = "rzp-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      // Drop the dead tag so a retry builds a fresh one instead of waiting on this.
      script.remove();
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(script);
  });
}

// The creator's minimum first, then fixed steps above it (₹20, ₹50, ₹100 ...), so a
// ₹20 minimum gives ₹20, ₹50, ₹100, ₹200, ₹500. A step too close to the minimum is skipped.
const PRESET_STEPS = [20, 50, 100, 200, 500, 1000];

function buildPresets(minPaise: number): number[] {
  const min = Math.ceil(minPaise / 100);
  const gap = Math.max(5, min * 0.25);
  const steps = PRESET_STEPS.filter((v) => v - min >= gap);
  return [min, ...steps].slice(0, 5);
}

const MAX_RUPEES = 100000;

// "Remember my name on this device": only the name, only on this device, only
// when the fan ticks it. Storage can be blocked, so every call is guarded.
const NAME_KEY = "freetip.fan-name";
function readName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeName(name: string) {
  try {
    if (name) window.localStorage.setItem(NAME_KEY, name);
    else window.localStorage.removeItem(NAME_KEY);
  } catch {
    // Storage is blocked: the name just isn't remembered.
  }
}

const step = (i: number) => ({ "--i": i }) as CSSProperties;


type Phase = "idle" | "creating" | "checkout" | "success" | "error";

interface Props {
  accent?: string;
  handle: string;
  displayName: string;
  pictureUrl: string | null;
  // The creator's YouTube banner (paid), drawn behind their photo; null shows no banner.
  bannerUrl?: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  minTipPaise: number;
  messageMaxChars: number;
  bio: string | null;
  sounds: TipSound[];
  // The creator's picks: a GIF and/or sound at a fixed amount, tapped instead of typing a message.
  rules?: TipRule[];
  // Smallest tip that can have its message read aloud, or null when the voice is
  // not offered (the site switch or the creator has it off).
  voiceMinPaise: number | null;
  // How the creator plays alerts, so the success screen only promises what will happen.
  alertMode?: AlertMode;
  previewMode?: boolean;
  // The creator lets a big enough tip pin its message on stream (paid highlighted messages).
  pinOffer?: PinOffer | null;
}

export function TipForm({
  handle,
  displayName,
  pictureUrl,
  bannerUrl = null,
  ytChannelName,
  ytChannelUrl,
  minTipPaise,
  messageMaxChars,
  bio,
  sounds,
  rules = [],
  voiceMinPaise,
  alertMode = "split",
  previewMode = false,
  pinOffer = null,
  accent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refocusAmount = useRef(false);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const presets = buildPresets(minTipPaise);
  const minRupees = Math.ceil(minTipPaise / 100);

  const [selected, setSelected] = useState<number | "custom">(presets[0]);
  const [custom, setCustom] = useState("");
  const [tipName, setTipName] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [extra, setExtra] = useState<Extra>({ kind: "default" });
  // Ask for the message to be pinned on stream (only when the creator offers it).
  const [pin, setPin] = useState(false);
  // A short, debounced sentence for screen readers when the amount changes.
  const [announce, setAnnounce] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Set when the fan closes the payment window without paying.
  const [closed, setClosed] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  // What the fan sent, kept for the success screen (the form is cleared for "tip again").
  const [sent, setSent] = useState({ message: "", reference: "", pinned: false });

  // A remembered name comes back on this device. It can only be read after the
  // page is on the client, so it is filled in once the page has loaded.
  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = readName().slice(0, 50);
      if (!stored) return;
      setTipName((current) => current || stored);
      setRemember(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => clearTimeout(sayTimer.current), []);

  // After "Tip again", keyboard focus goes back to the chosen amount.
  useEffect(() => {
    if (phase === "idle" && refocusAmount.current) {
      refocusAmount.current = false;
      containerRef.current?.querySelector<HTMLInputElement>('input[name="amount"]:checked')?.focus();
    }
  }, [phase]);

  const amountRupees = selected === "custom" ? parseInt(custom, 10) || 0 : selected;
  const amountPaise = Math.round(amountRupees * 100);
  // A bigger tip allows a longer message. The server applies the same rule.
  const messageLimit = messageLimitFor(messageMaxChars, amountPaise);
  const moreChars = nextMessageStep(messageMaxChars, amountPaise);
  const messageTooLong = message.length > messageLimit;
  const nearLimit = message.length >= messageLimit - 20;
  // The name the overlay will show; it falls back to "Anonymous" the same way.
  const alertName = anonymous ? "Anonymous" : tipName.trim() || "Anonymous";
  // A picked sound or the voice needs a big enough tip (and the voice a message);
  // lowering the amount afterwards blocks the button until the fan raises it
  // again or picks something else.
  const chosenSound = extra.kind === "sound" ? (sounds.find((s) => s.id === extra.id) ?? null) : null;
  // A creator's pick fixes the amount: it is set for the fan and cannot be changed until
  // they put the pick back. A soundboard sound only has a minimum, so any amount at or above
  // it works (below it the sound is locked and the button is blocked).
  const amountLocked = extra.kind === "rule" && rules.some((r) => r.id === extra.id);
  const [lockWarning, setLockWarning] = useState(false);
  const soundTooPricey = !!chosenSound && amountPaise < chosenSound.minPaise;
  const voiceTooPricey = extra.kind === "voice" && voiceMinPaise !== null && amountPaise < voiceMinPaise;
  const voiceNeedsMessage = extra.kind === "voice" && !message.trim();
  // A pin needs a big enough tip and a message; lowering the amount or clearing the message
  // afterwards blocks the button until the fan fixes it or unticks the pin.
  const pinTooPricey = pin && pinOffer !== null && amountPaise < pinOffer.minPaise;
  const pinNeedsMessage = pin && !message.trim();
  const rulePicked = extra.kind === "rule";
  const extraBlocked =
    soundTooPricey || voiceTooPricey || voiceNeedsMessage || messageTooLong || pinTooPricey || pinNeedsMessage;
  // After an error the fan can try again; only a request or the popup in flight blocks it.
  const canPay =
    !previewMode &&
    amountPaise >= minTipPaise &&
    !extraBlocked &&
    (phase === "idle" || phase === "error");

  function say(rupees: number) {
    clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => {
      setAnnounce(rupees > 0 ? `Tip amount ${rupeeText(rupees)} rupees. ${tipTier(rupees)}.` : "");
    }, 500);
  }

  function pickPreset(preset: number | "custom") {
    setSelected(preset);
    const rupees = preset === "custom" ? parseInt(custom, 10) || 0 : preset;
    say(rupees);
  }

  // Choosing something besides the message. A pick sets the amount to its own and clears the
  // message and the pin (it plays on its own); a sound or the voice leaves them alone.
  function chooseExtra(next: Extra) {
    setExtra(next);
    setLockWarning(false);
    const fixed = next.kind === "rule" ? rules.find((x) => x.id === next.id)?.minPaise : undefined;
    if (!fixed) return;
    const rupees = Math.ceil(fixed / 100);
    if (presets.includes(rupees)) setSelected(rupees);
    else {
      setSelected("custom");
      setCustom(String(rupees));
    }
    setMessage("");
    setPin(false);
    say(rupees);
  }

  // Whole rupees only: digits in, nothing else (no e, minus, point or comma).
  function changeCustom(raw: string) {
    let digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 6);
    if (Number(digits) > MAX_RUPEES) digits = String(MAX_RUPEES);
    setCustom(digits);
    say(parseInt(digits, 10) || 0);
  }

  function changeName(value: string) {
    setTipName(value);
    if (remember) writeName(value.trim());
  }

  function changeRemember(on: boolean) {
    setRemember(on);
    writeName(on ? tipName.trim() : "");
  }

  async function handlePay() {
    if (!canPay) return;
    setClosed(false);
    setPhase("creating");
    setErrorMsg("");

    let result: Awaited<ReturnType<typeof createTipOrder>>;
    try {
      result = await createTipOrder(
        handle,
        amountPaise,
        anonymous ? null : tipName.trim() || null,
        message.trim() || null,
        anonymous,
        {
          soundId: extra.kind === "sound" ? extra.id : null,
          voice: extra.kind === "voice",
          ruleId: extra.kind === "rule" ? extra.id : null,
          pin: pinOffer !== null && pin,
        },
      );
    } catch {
      setPhase("error");
      setErrorMsg("Could not start payment. Check your connection and try again.");
      return;
    }

    if (result.status === "error") {
      setPhase("error");
      setErrorMsg(result.message);
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setPhase("error");
      setErrorMsg("Could not load payment. Check your connection and try again.");
      return;
    }

    setPhase("checkout");

    try {
      const rzp = new window.Razorpay({
        key: result.razorpayKeyId,
        amount: result.amountPaise,
        currency: "INR",
        name: "Freetip",
        description: `Tip for ${displayName}`,
        order_id: result.razorpayOrderId,
        theme: { color: accent ?? "#bfe84a" },
        handler: () => {
          setPaidAmount(result.amountPaise);
          setSent({
            message: message.trim(),
            reference: result.razorpayOrderId,
            pinned: pinOffer !== null && pin,
          });
          setPhase("success");
        },
        modal: {
          ondismiss: () => {
            setPhase("idle");
            setClosed(true);
          },
        },
      });

      rzp.open();
    } catch {
      setPhase("error");
      setErrorMsg("Could not open payment. Try again.");
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <SuccessScreen
        amountPaise={paidAmount}
        displayName={displayName}
        handle={handle}
        anonymous={anonymous}
        alertMessage={sent.message}
        alertMode={alertMode}
        pinned={sent.pinned}
        reference={sent.reference}
        onAgain={() => {
          refocusAmount.current = true;
          setClosed(false);
          setPhase("idle");
          setMessage("");
          // A remembered name stays for the next tip.
          if (!remember) setTipName("");
          setAnonymous(false);
          setExtra({ kind: "default" });
          setPin(false);
          setPaidAmount(0);
        }}
      />
    );
  }

  const sectionLabel = "text-sm font-medium uppercase tracking-widest text-muted";
  const chip =
    "flex h-12 cursor-pointer items-center justify-center rounded-full border border-control px-5 text-sm transition-[transform,background-color,border-color,color] duration-150 hover:border-muted active:scale-[0.97] peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";
  const digitCount = String(Math.trunc(amountRupees)).length;
  const customBelowMin = selected === "custom" && custom !== "" && amountPaise < minTipPaise;

  const preview = (
    <>
      <p className={sectionLabel}>Preview on stream</p>
      <AlertCard name={alertName} amountRupees={amountRupees} message={message.trim()} />
      <p className="text-xs text-muted">Your message may appear on stream.</p>
    </>
  );

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      {/* Preview banner for the creator */}
      {previewMode && (
        <div className="enter mb-8 space-y-1 rounded-[var(--radius-surface)] border border-line/60 bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-text">Preview: your page isn&apos;t live yet.</p>
          <p className="text-sm text-muted">This is exactly what fans will see once you go live.</p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-14">
        {/* Left on wide screens (sticky), above the form on phones */}
        <div className="contents lg:sticky lg:top-24 lg:block lg:space-y-8">
          <div className="enter" style={step(0)}>
            <CreatorPanel
              displayName={displayName}
              pictureUrl={pictureUrl}
              bannerUrl={bannerUrl}
              ytChannelName={ytChannelName}
              ytChannelUrl={ytChannelUrl}
              bio={bio}
              previewMode={previewMode}
            />
          </div>

          <section
            className="enter hidden space-y-3 lg:block"
            style={step(2)}
            aria-label="Alert preview"
          >
            {preview}
          </section>
          <div className="enter hidden lg:block" style={step(3)}>
            <QrTile handle={handle} />
          </div>
        </div>

        {/* The tip */}
        <div
          className="enter space-y-8 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5 sm:p-8"
          style={step(1)}
        >
          <p role="status" className="sr-only">
            {announce}
          </p>

          {/* 01 Amount */}
          <div className="space-y-4">
            <StepHeading n={1} title="Amount" />
            <div className="space-y-2 rounded-[var(--radius-surface)] bg-ground px-5 py-6 text-center">
              <p
                key={amountRupees}
                aria-hidden="true"
                className={`amount-numeral numeric font-semibold leading-none text-accent ${
                  digitCount >= 5
                    ? "text-[clamp(2.75rem,12vw,3.5rem)]"
                    : digitCount === 4
                      ? "text-[clamp(3.25rem,14vw,4.25rem)]"
                      : "text-[clamp(4rem,17vw,5.5rem)]"
                }`}
              >
                ₹{rupeeText(amountRupees)}
              </p>
              <p className="text-sm text-muted">{tipTier(amountRupees)}</p>
            </div>
            <div onClickCapture={() => amountLocked && setLockWarning(true)} className="space-y-3">
            <fieldset>
              <legend className="sr-only">Choose an amount in rupees</legend>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <label key={preset} className={`relative ${amountLocked ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      name="amount"
                      value={preset}
                      checked={selected === preset}
                      disabled={amountLocked}
                      onChange={() => pickPreset(preset)}
                      className="peer sr-only"
                    />
                    <span className={`numeric ${chip}`}>₹{preset}</span>
                  </label>
                ))}
                <label className={`relative ${amountLocked ? "opacity-50" : ""}`}>
                  <input
                    type="radio"
                    name="amount"
                    value="custom"
                    checked={selected === "custom"}
                    disabled={amountLocked}
                    onChange={() => pickPreset("custom")}
                    className="peer sr-only"
                  />
                  <span className={chip}>Custom</span>
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
                  autoComplete="off"
                  value={custom}
                  readOnly={amountLocked}
                  onChange={(e) => changeCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
                  }}
                  placeholder="Enter amount"
                  aria-label="Custom tip amount in rupees"
                  aria-describedby="tip-min"
                  aria-invalid={customBelowMin || undefined}
                  className="numeric h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground pl-8 pr-4 text-base text-text transition-[border-color] placeholder:text-muted focus:border-accent"
                />
              </div>
            )}
            <p id="tip-min" className="text-xs text-muted">
              Minimum ₹{minRupees}
            </p>
            </div>
            {amountLocked && (
              <div
                role={lockWarning ? "alert" : undefined}
                className={`rounded-[var(--radius-field)] border px-3 py-2 text-xs ${
                  lockWarning ? "border-accent text-text" : "border-line/60 text-muted"
                }`}
              >
                {lockWarning
                  ? "The amount is fixed by the pick you chose. To send a different amount, deselect the pick below first."
                  : "The amount is set by your pick. To change it, deselect the pick below."}{" "}
                <button
                  type="button"
                  onClick={() => chooseExtra({ kind: "default" })}
                  className="font-semibold text-accent underline underline-offset-2"
                >
                  Deselect the pick
                </button>
              </div>
            )}
          </div>

          {/* The alert as it will look, between the amount and the note on phones */}
          <section className="space-y-3 lg:hidden" aria-label="Alert preview">
            {preview}
          </section>

          {/* 02 Your note */}
          <div className="space-y-4">
            <StepHeading n={2} title="Your note" />
            <div className="flex items-center gap-3">
              <Switch id="anon-toggle" checked={anonymous} onChange={setAnonymous} />
              <label htmlFor="anon-toggle" className="cursor-pointer select-none text-sm text-text">
                Tip anonymously
              </label>
            </div>
            <div className="space-y-2">
              <label htmlFor="tip-name" className="text-sm text-muted">
                Your name <span className="text-control">(optional)</span>
              </label>
              <input
                id="tip-name"
                type="text"
                maxLength={50}
                value={tipName}
                onChange={(e) => changeName(e.target.value)}
                placeholder={anonymous ? "Hidden" : "Riya, Kabir…"}
                disabled={anonymous}
                autoComplete="off"
                className="h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text transition-[border-color,opacity] duration-200 placeholder:text-muted focus:border-accent disabled:opacity-40"
              />
              {!anonymous && (
                <div className="flex items-center gap-3 pt-1">
                  <Switch id="remember-name" checked={remember} onChange={changeRemember} />
                  <label htmlFor="remember-name" className="cursor-pointer select-none text-sm text-muted">
                    Remember my name on this device
                  </label>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="tip-message" className="text-sm text-muted">
                Message <span className="text-control">(optional)</span>
              </label>
              <textarea
                id="tip-message"
                maxLength={messageMaxChars}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={rulePicked ? "Not needed with a streamer's pick" : "Great stream today!"}
                disabled={rulePicked}
                className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text transition-[border-color,opacity] placeholder:text-muted focus:border-accent disabled:opacity-40"
              />
              {rulePicked && (
                <FieldNote>
                  A streamer&apos;s pick plays its GIF and sound on its own, so there is no message. Choose another amount or
                  tap the pick again to write one.
                </FieldNote>
              )}
              <p aria-live={nearLimit ? "polite" : "off"} className="text-right text-xs text-muted">
                {message.length}/{messageLimit}
                {moreChars && ` · tip ₹${moreChars.rupees} or more for ${moreChars.limit}`}
              </p>
              {messageTooLong && (
                <FieldNote>
                  Your message is {message.length - messageLimit} characters too long for this tip.
                  {moreChars
                    ? ` Shorten it, or tip ₹${moreChars.rupees} or more for ${moreChars.limit} characters.`
                    : " Please shorten it."}
                </FieldNote>
              )}
            </div>
            {pinOffer && !rulePicked && (
              <div className="space-y-2 rounded-[var(--radius-field)] border border-line/60 p-4">
                <div className="flex items-center gap-3">
                  <Switch id="pin-toggle" checked={pin} onChange={setPin} />
                  <label htmlFor="pin-toggle" className="cursor-pointer select-none text-sm text-text">
                    Pin my message on stream for {pinOffer.seconds} seconds
                  </label>
                </div>
                <p className="text-xs text-muted">
                  For tips of ₹{Math.ceil(pinOffer.minPaise / 100)} or more, and there is no extra fee. {displayName} approves it
                  first and can take it down at any time. Tips are final, so if it is not pinned or is taken down, the
                  tip is not refunded.
                </p>
              </div>
            )}
            {pinTooPricey && pinOffer && (
              <FieldNote>
                Tip at least ₹{Math.ceil(pinOffer.minPaise / 100)} to pin your message, or untick the pin.
              </FieldNote>
            )}
            {pinNeedsMessage && <FieldNote>Write a message to pin, or untick the pin.</FieldNote>}
            {(sounds.length > 0 || rules.length > 0 || voiceMinPaise !== null) && (
              <ExtraPicker
                sounds={sounds}
                rules={rules}
                voiceMinPaise={voiceMinPaise}
                hasMessage={!!message.trim()}
                selected={extra}
                amountPaise={amountPaise}
                onSelect={chooseExtra}
              />
            )}
            {soundTooPricey && chosenSound && (
              <FieldNote>
                Tip at least ₹{Math.ceil(chosenSound.minPaise / 100)} to play {chosenSound.name}, or pick another
                sound.
              </FieldNote>
            )}
            {voiceTooPricey && voiceMinPaise !== null && (
              <FieldNote>
                Tip at least ₹{Math.ceil(voiceMinPaise / 100)} to have your message read aloud, or pick something
                else.
              </FieldNote>
            )}
          </div>

          {/* 03 Send */}
          <div className="space-y-4">
            <StepHeading n={3} title="Send" />
            <p className="text-sm text-muted">
              Pay with UPI or a card. You pay exactly the tip, and no account or email is needed.
            </p>
            {message.trim() && <p className="text-sm text-muted">Your message may appear on stream.</p>}

            {closed && phase === "idle" && (
              <p role="status" className="text-sm text-muted">
                Payment window closed. If it went through, your tip still reaches {displayName}; otherwise you
                weren&apos;t charged.
              </p>
            )}

            {phase === "error" && <FieldNote>{errorMsg}</FieldNote>}

            <div>
              <Magnetic className="w-full" strength={0.1}>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={previewMode || amountPaise < minTipPaise || extraBlocked || phase === "creating" || phase === "checkout"}
                  aria-busy={phase === "creating"}
                  className="beam inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent text-base font-semibold text-ink transition-[opacity,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === "creating" ? (
                    <>
                      <TickLoader count={10} duration={0.8} className="text-ink" />
                      Opening payment…
                    </>
                  ) : phase === "checkout" ? (
                    "Complete payment in the popup"
                  ) : previewMode ? (
                    "Tip (preview only)"
                  ) : (
                    <>
                      <RollText>{`Tip ₹${amountRupees || "—"}`}</RollText>
                      <ArrowRight weight="bold" aria-hidden="true" />
                    </>
                  )}
                </button>
              </Magnetic>
              {!previewMode && amountPaise > 0 && amountPaise < minTipPaise && (
                <p className="mt-2 text-center text-xs text-muted">Minimum tip is ₹{minRupees}</p>
              )}
              {previewMode && (
                <p className="mt-2 text-center text-xs text-muted">
                  Payments are disabled in preview.{" "}
                  <Link href="/dashboard" className="underline decoration-line hover:decoration-accent">
                    Back to dashboard
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
