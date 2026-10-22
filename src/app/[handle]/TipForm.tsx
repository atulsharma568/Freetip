"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Switch } from "@/components/ui/Switch";

const MAX_MESSAGE_FALLBACK = 150;

// Build 4 clean preset amounts from the creator's minimum tip (in paise).
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

interface Props {
  name: string;
  pictureUrl: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  minTipPaise: number;
  messageMaxChars: number;
}

export function TipForm({ name, pictureUrl, ytChannelName, ytChannelUrl, minTipPaise, messageMaxChars }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const presets = buildPresets(minTipPaise);
  const maxChars = messageMaxChars ?? MAX_MESSAGE_FALLBACK;

  const [selected, setSelected] = useState<number | "custom">(presets[0]);
  const [custom, setCustom] = useState("");
  const [tipName, setTipName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Stagger sections in on mount.
  useGSAP(
    () => {
      gsap.from(".tip-section", {
        y: 20,
        opacity: 0,
        duration: 0.45,
        stagger: 0.08,
        ease: "power2.out",
        clearProps: "all",
      });
    },
    { scope: containerRef },
  );

  const amount =
    selected === "custom" ? Math.max(0, parseInt(custom, 10) || 0) : selected;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < 1) return;
    setSubmitted(true);
  };

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-sm px-6 py-12 space-y-8">
      {/* Creator */}
      <div className="tip-section flex items-center gap-4">
        {pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictureUrl} alt="" width={56} height={56} className="shrink-0 rounded-full" />
        )}
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-text">{name}</h1>
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
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount presets */}
        <fieldset className="tip-section space-y-3">
          <legend className="text-sm font-medium uppercase tracking-widest text-muted">
            Amount
          </legend>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSelected(preset)}
                aria-pressed={selected === preset}
                className={`numeric h-11 rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${
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
              className={`h-11 rounded-full px-5 text-sm font-semibold transition-colors duration-150 ${
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
                min={1}
                max={100000}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Enter amount"
                autoFocus
                aria-label="Custom tip amount in rupees"
                className="numeric w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground pl-8 pr-4 text-base text-text placeholder:text-muted transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgb(191_232_74/0.14)] focus:outline-none"
              />
            </div>
          )}
        </fieldset>

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
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgb(191_232_74/0.14)] focus:outline-none disabled:opacity-40"
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
            maxLength={maxChars}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Great stream today!"
            className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text placeholder:text-muted transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgb(191_232_74/0.14)] focus:outline-none"
          />
          <p
            aria-live="polite"
            className="numeric text-right text-xs text-muted"
          >
            {message.length}/{maxChars}
          </p>
        </div>

        {/* Anonymous */}
        <div className="tip-section flex items-center gap-3">
          <Switch id="anon-toggle" checked={anonymous} onChange={setAnonymous} />
          <label htmlFor="anon-toggle" className="cursor-pointer select-none text-sm text-text">
            Tip anonymously
          </label>
        </div>

        {/* Submit / coming-soon */}
        <div className="tip-section space-y-3">
          {submitted ? (
            <div
              role="status"
              className="rounded-[var(--radius-field)] border border-control bg-surface px-5 py-4 space-y-1"
            >
              <p className="font-semibold text-text">Payments coming soon.</p>
              <p className="text-sm text-muted">
                We&apos;re integrating UPI and card payments. Join the waitlist
                and we&apos;ll let you know when tips go live.
              </p>
            </div>
          ) : (
            <button
              type="submit"
              disabled={amount < 1}
              className="beam w-full h-14 rounded-full bg-accent text-base font-semibold text-ink transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tip ₹{amount > 0 ? amount : "—"} →
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
