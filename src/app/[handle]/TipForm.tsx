"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { gsap, useGSAP } from "@/lib/gsap";
import { Switch } from "@/components/ui/Switch";
import { TickLoader } from "@/components/ui/TickLoader";
import { Odometer, spinReels } from "@/components/ui/Odometer";
import { createTipOrder } from "@/app/actions/tip";

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
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

function buildPresets(minPaise: number): number[] {
  const min = Math.ceil(minPaise / 100);
  const raw = [min, min * 2, min * 5, min * 10];
  return raw.map((v) => {
    if (v >= 1000) return Math.round(v / 500) * 500;
    if (v >= 100) return Math.round(v / 100) * 100;
    if (v >= 10) return Math.round(v / 10) * 10;
    return v;
  });
}

const noopSubscribe = () => () => {};
const canShare = () => typeof navigator !== "undefined" && "share" in navigator;

const CONFETTI_PIECES = 40;
const CONFETTI_COLOURS = ["bg-accent", "bg-accent", "bg-accent", "bg-text", "bg-muted"];

const rupeeText = (rupees: number) =>
  rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// After a tip: a lime note slides in and flies off while the amount's reels
// spin and a burst of lime confetti rises from the amount, then the fan can
// send another tip or pass the creator's page on. Motion (confetti included)
// is skipped under reduced motion; the words are always there.
function SuccessScreen({
  amountPaise,
  displayName,
  handle,
  anonymous,
  onAgain,
}: {
  amountPaise: number;
  displayName: string;
  handle: string;
  anonymous: boolean;
  onAgain: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const shareable = useSyncExternalStore(noopSubscribe, canShare, () => false);
  const rupees = amountPaise / 100;
  const whole = Number.isInteger(rupees);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline();
        tl.fromTo(
          ".success-note",
          { y: 48, opacity: 0, rotate: -8, scale: 0.85 },
          { y: 0, opacity: 1, rotate: -3, scale: 1, duration: 0.45, ease: "power3.out" },
        )
          .to(
            ".success-note",
            { x: 180, y: -140, rotate: 16, opacity: 0, duration: 0.7, ease: "power2.in" },
            0.75,
          )
          .from(".success-line", { y: 14, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, 0.9);
        const reels = gsap.utils.toArray<HTMLElement>("[data-reel]");
        if (reels.length) spinReels(gsap, reels).forEach((spin) => tl.add(spin, 0.3));
        // Confetti: each piece shoots up and out, then drifts down turning and
        // fading. They start hidden (opacity 0 in the markup).
        const pieces = gsap.utils.toArray<HTMLElement>(".confetti-piece");
        const burst = gsap.timeline({ delay: 1.05 });
        pieces.forEach((piece) => {
          const x = gsap.utils.random(-150, 150);
          const rise = gsap.utils.random(70, 190);
          const spin = gsap.utils.random(-540, 540);
          burst
            .set(piece, { opacity: 1, x: 0, y: 0, rotate: 0, scale: gsap.utils.random(0.7, 1.2) }, 0)
            .to(piece, { x, y: -rise, rotate: spin / 2, duration: 0.55, ease: "power2.out" }, 0)
            .to(
              piece,
              {
                x: x * 1.15,
                y: gsap.utils.random(120, 260),
                rotate: spin,
                opacity: 0,
                duration: gsap.utils.random(0.9, 1.4),
                ease: "power1.in",
              },
              0.55,
            );
        });
      });
    },
    { scope: ref },
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${handle}`);
      setNotice("Link copied");
    } catch {
      setNotice("Could not copy the link.");
    }
  }

  async function shareLink() {
    try {
      await navigator.share({
        title: `Tip ${displayName}`,
        url: `${window.location.origin}/${handle}`,
      });
    } catch {
      // The sheet was closed: nothing to report.
    }
  }

  const control =
    "inline-flex h-12 items-center rounded-full border border-control px-6 text-sm font-semibold text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.97]";

  return (
    <div
      ref={ref}
      className="mx-auto flex w-full max-w-sm flex-col items-center space-y-8 overflow-x-clip px-6 py-20 text-center"
    >
      <div className="relative flex h-24 w-full items-center justify-center" aria-hidden="true">
        <div className="success-note flex h-16 w-32 items-center justify-center rounded-[0.6rem] bg-accent text-3xl font-bold text-ink shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)]">
          ₹
        </div>
      </div>
      <div role="status" className="relative space-y-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 m-0! size-0"
        >
          {Array.from({ length: CONFETTI_PIECES }, (_, i) => (
            <span
              key={i}
              className={`confetti-piece absolute left-0 top-0 opacity-0 ${CONFETTI_COLOURS[i % CONFETTI_COLOURS.length]} ${
                i % 3 === 0 ? "h-2 w-2 rounded-full" : i % 3 === 1 ? "h-1 w-3 rounded-[1px]" : "h-2.5 w-1 rounded-[1px]"
              }`}
            />
          ))}
        </div>
        <p className="sr-only">
          ₹{rupeeText(rupees)} sent to {displayName}.
        </p>
        <p className="success-line text-[clamp(3.5rem,14vw,5rem)] font-semibold leading-none text-accent">
          {whole ? (
            <Odometer value={rupees} />
          ) : (
            <span aria-hidden="true" className="numeric">
              ₹{rupeeText(rupees)}
            </span>
          )}
        </p>
        <p className="success-line text-xl font-semibold text-text">Sent to {displayName}!</p>
        <p className="success-line text-sm text-muted">
          {anonymous ? "Your tip is on its way." : "They'll see your message on stream."}
        </p>
      </div>
      <div className="success-line flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onAgain} className={control}>
          Send another tip
        </button>
        {shareable ? (
          <button type="button" onClick={shareLink} className={control}>
            Share {displayName}&apos;s page
          </button>
        ) : (
          <button type="button" onClick={copyLink} className={control}>
            Copy their link
          </button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-accent">
        {notice}
      </p>
    </div>
  );
}

type Phase = "idle" | "creating" | "checkout" | "success" | "error";

interface Props {
  handle: string;
  displayName: string;
  pictureUrl: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  minTipPaise: number;
  messageMaxChars: number;
  bio: string | null;
  previewMode?: boolean;
}

export function TipForm({
  handle,
  displayName,
  pictureUrl,
  ytChannelName,
  ytChannelUrl,
  minTipPaise,
  messageMaxChars,
  bio,
  previewMode = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const presets = buildPresets(minTipPaise);
  const minRupees = Math.ceil(minTipPaise / 100);

  const [selected, setSelected] = useState<number | "custom">(presets[0]);
  const [custom, setCustom] = useState("");
  const [tipName, setTipName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".tip-section", {
          y: 20,
          opacity: 0,
          duration: 0.45,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "all",
        });
      });
    },
    { scope: containerRef },
  );

  const nearLimit = message.length >= messageMaxChars - 20;

  const amountRupees =
    selected === "custom" ? parseFloat(custom) || 0 : selected;
  const amountPaise = Math.round(amountRupees * 100);
  const canPay = !previewMode && amountPaise >= minTipPaise && phase === "idle";

  async function handlePay() {
    if (!canPay) return;
    setPhase("creating");
    setErrorMsg("");

    const result = await createTipOrder(
      handle,
      amountPaise,
      anonymous ? null : tipName.trim() || null,
      message.trim() || null,
      anonymous,
    );

    if (result.status === "error") {
      setPhase("error");
      setErrorMsg(result.message);
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setPhase("error");
      setErrorMsg("Could not load payment — check your connection and try again");
      return;
    }

    setPhase("checkout");

    const rzp = new window.Razorpay({
      key: result.razorpayKeyId,
      amount: result.amountPaise,
      currency: "INR",
      name: "Tipsite",
      description: `Tip for ${displayName}`,
      order_id: result.razorpayOrderId,
      theme: { color: "#bfe84a" },
      handler: () => {
        setPaidAmount(result.amountPaise);
        setPhase("success");
      },
      modal: {
        ondismiss: () => {
          setPhase("idle");
        },
      },
    });

    rzp.open();
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <SuccessScreen
        amountPaise={paidAmount}
        displayName={displayName}
        handle={handle}
        anonymous={anonymous}
        onAgain={() => {
          setPhase("idle");
          setMessage("");
          setTipName("");
          setAnonymous(false);
          setPaidAmount(0);
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-sm px-6 py-12 space-y-8">
      {/* Preview banner for the creator, or coming-soon for everyone else */}
      {previewMode && (
        <div className="tip-section rounded-[var(--radius-surface)] border border-line/60 bg-surface px-5 py-4 space-y-1">
          <p className="text-sm font-semibold text-text">Preview — your page isn&apos;t live yet.</p>
          <p className="text-sm text-muted">This is exactly what fans will see once you go live.</p>
        </div>
      )}

      {/* Creator */}
      <div className="tip-section flex items-center gap-4">
        {pictureUrl && (
          <Image
            src={pictureUrl}
            alt={`${displayName}'s profile photo`}
            loading="eager"
            width={56}
            height={56}
            className="shrink-0 rounded-full"
          />
        )}
        <div className="min-w-0">
          <h1 className="display truncate text-[clamp(1.5rem,5vw,2rem)]">{displayName}</h1>
          {ytChannelName && ytChannelUrl && (
            <a
              href={ytChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-muted transition-colors hover:text-text"
            >
              {ytChannelName}
            </a>
          )}
          {bio && <p className="text-sm text-muted mt-1">{bio}</p>}
        </div>
      </div>

      <div className="space-y-6">
        {/* Amount presets */}
        <fieldset className="tip-section space-y-3">
          <legend className="text-sm font-medium uppercase tracking-widest text-muted">
            Amount
          </legend>
          <p
            key={amountRupees}
            aria-hidden="true"
            className={`amount-numeral numeric font-semibold leading-none text-accent ${
              String(Math.trunc(amountRupees)).length >= 5
                ? "text-[clamp(2.75rem,12vw,3.5rem)]"
                : String(Math.trunc(amountRupees)).length === 4
                  ? "text-[clamp(3.25rem,14vw,4.25rem)]"
                  : "text-[clamp(4rem,17vw,5.5rem)]"
            }`}
          >
            ₹{rupeeText(amountRupees)}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSelected(preset)}
                aria-pressed={selected === preset}
                className={`numeric h-11 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] ${
                  selected === preset
                    ? "bg-accent text-ink"
                    : "border border-control text-text hover:border-muted"
                }`}
              >
                ₹{preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected("custom")}
              aria-pressed={selected === "custom"}
              className={`h-11 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] ${
                selected === "custom"
                  ? "bg-accent text-ink"
                  : "border border-control text-text hover:border-muted"
              }`}
            >
              Custom
            </button>
          </div>
          {selected === "custom" && (
            <div className="relative flex items-center">
              <span
                aria-hidden="true"
                className="numeric pointer-events-none absolute left-4 text-muted"
              >
                ₹
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={minRupees}
                max={100000}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Enter amount"
                aria-label="Custom tip amount in rupees"
                className="numeric w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground pl-8 pr-4 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none"
              />
            </div>
          )}
          {minRupees > 1 && (
            <p className="text-xs text-muted">Minimum ₹{minRupees}</p>
          )}
        </fieldset>

        {/* Anonymous toggle */}
        <div className="tip-section flex items-center gap-3">
          <Switch id="anon-toggle" checked={anonymous} onChange={setAnonymous} />
          <label htmlFor="anon-toggle" className="cursor-pointer select-none text-sm text-text">
            Tip anonymously
          </label>
        </div>

        {/* Name */}
        <div className="tip-section space-y-2">
          <label
            htmlFor="tip-name"
            className="text-sm font-medium uppercase tracking-widest text-muted"
          >
            Your name{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            id="tip-name"
            type="text"
            maxLength={50}
            value={tipName}
            onChange={(e) => setTipName(e.target.value)}
            placeholder={anonymous ? "Hidden" : "Riya, Kabir…"}
            disabled={anonymous}
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted transition-[border-color,opacity] duration-200 focus:border-accent focus:outline-none disabled:opacity-40"
          />
        </div>

        {/* Message */}
        <div className="tip-section space-y-2">
          <label
            htmlFor="tip-message"
            className="text-sm font-medium uppercase tracking-widest text-muted"
          >
            Message{" "}
            <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="tip-message"
            maxLength={messageMaxChars}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Great stream today!"
            className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none"
          />
          <p
            aria-live={nearLimit ? "polite" : "off"}
            className="text-right text-xs text-muted"
          >
            {message.length}/{messageMaxChars}
          </p>
        </div>

        {/* Trust line */}
        <p className="tip-section text-sm text-muted">
          No account or email needed. You pay exactly the tip.
        </p>

        {/* Error */}
        {phase === "error" && (
          <p role="alert" className="tip-section text-sm text-red-400">
            {errorMsg}
          </p>
        )}

        {/* Pay button */}
        <div className="tip-section">
          <button
            type="button"
            onClick={handlePay}
            disabled={previewMode || amountPaise < minTipPaise || phase === "creating" || phase === "checkout"}
            className="beam w-full h-14 rounded-full bg-accent text-base font-semibold text-ink transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-3"
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
              `Tip ₹${amountRupees || "—"} →`
            )}
          </button>
          {!previewMode && amountPaise > 0 && amountPaise < minTipPaise && (
            <p className="mt-2 text-center text-xs text-muted">
              Minimum tip is ₹{minRupees}
            </p>
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
  );
}
