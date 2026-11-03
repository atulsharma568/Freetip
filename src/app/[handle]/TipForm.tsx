"use client";

import { useEffect, useRef, useState } from "react";
import type { AlertMode } from "@/lib/alerts";
import type { PinOffer } from "@/lib/pinned";
import { createTipOrder } from "@/app/actions/tip";
import { messageLimitFor, nextMessageStep } from "@/lib/message-limit";
import { tipTier } from "@/lib/tip-tier";
import { PageLayout } from "@/components/tip/blocks/PageLayout";
import { SuccessBlock } from "@/components/tip/blocks/SuccessBlock";
import type { Extra } from "@/components/tip/ExtraPicker";
import { TipFormProvider, type Phase, type TipFormState } from "@/components/tip/TipFormContext";
import { rupeeText } from "@/components/tip/format";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import type { MeterReading } from "@/lib/page-doc/pressure";
import { findBlock } from "@/lib/page-doc/blocks";
import type { PageDoc } from "@/lib/page-doc/types";
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
  // The owner's editor preview: blocks are marked so a click can pick one. Never set on the real page.
  editing?: boolean;
  // The creator lets a big enough tip pin its message on stream (paid highlighted messages).
  pinOffer?: PinOffer | null;
  // The page as a document of blocks (parsed already): what is on the page, in what order and
  // with which words. It never changes what a payment does; that stays in this component.
  doc: PageDoc;
  // The pictures of the library the document uses, by id. Blocks only draw them.
  assets?: Record<number, ResolvedAsset>;
  // The Pressure meter: drawn only when `meterOn`; `meter` is its first reading (null: no goal).
  meterOn?: boolean;
  meter?: MeterReading | null;
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
  editing = false,
  pinOffer = null,
  doc,
  assets = {},
  meterOn = false,
  meter = null,
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
  // The "tip is final, I agree to the Terms and Refund Policy" box; never pre-ticked.
  const [agreed, setAgreed] = useState(false);
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
    agreed &&
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
          agreed,
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
      <SuccessBlock
        block={findBlock(doc, "successScreen")}
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

  // What the blocks read. They show it and call what is handed to them; none of them can change
  // what a payment does.
  const state: TipFormState = {
    handle,
    displayName,
    pictureUrl,
    bannerUrl,
    assets,
    ytChannelName,
    ytChannelUrl,
    bio,
    previewMode,
    editing,
    meterOn,
    meter,
    presets,
    minTipPaise,
    minRupees,
    selected,
    custom,
    amountRupees,
    amountPaise,
    amountLocked,
    lockWarning,
    setLockWarning,
    pickPreset,
    changeCustom,
    announce,
    anonymous,
    setAnonymous,
    tipName,
    changeName,
    remember,
    changeRemember,
    message,
    setMessage,
    messageMaxChars,
    messageLimit,
    moreChars,
    messageTooLong,
    alertName,
    rulePicked,
    pinOffer,
    pin,
    setPin,
    pinTooPricey,
    pinNeedsMessage,
    sounds,
    rules,
    voiceMinPaise,
    extra,
    chooseExtra,
    chosenSound,
    soundTooPricey,
    voiceTooPricey,
    phase,
    errorMsg,
    closed,
    extraBlocked,
    agreed,
    // Ticking the box is the sign the fan is about to pay: fetch the payment script now, so it
    // is ready when Tip is pressed (the longest wait of the flow on a slow phone).
    setAgreed: (on: boolean) => {
      if (on) loadRazorpayScript().catch(() => {});
      setAgreed(on);
    },
    handlePay,
  };

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      {/* Preview banner for the creator (not in the owner's editor preview, where the page may well be live) */}
      {previewMode && !editing && (
        <div className="enter mb-8 space-y-1 rounded-[var(--radius-surface)] border border-line/60 bg-surface px-5 py-4">
          <p className="text-sm font-semibold text-text">Preview: your page isn&apos;t live yet.</p>
          <p className="text-sm text-muted">This is exactly what fans will see once you go live.</p>
        </div>
      )}

      <TipFormProvider value={state}>
        <PageLayout doc={doc} />
      </TipFormProvider>
    </div>
  );
}
