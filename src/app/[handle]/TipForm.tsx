"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/gsap";
import { Switch } from "@/components/ui/Switch";

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

export function TipForm({
  name,
  pictureUrl,
  ytChannelName,
  ytChannelUrl,
  minTipPaise,
  messageMaxChars,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const presets = buildPresets(minTipPaise);
  const minRupees = Math.ceil(minTipPaise / 100);

  const [selected, setSelected] = useState<number | "custom">(presets[0]);
  const [custom, setCustom] = useState("");
  const [tipName, setTipName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);

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

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-sm px-6 py-12 space-y-8">
      {/* Coming-soon banner */}
      <div className="tip-section rounded-[var(--radius-surface)] border border-line/60 bg-surface px-5 py-4 space-y-1">
        <p className="text-sm font-semibold text-text">Tips open soon.</p>
        <p className="text-sm text-muted">
          UPI and card payments are on their way.{" "}
          <Link
            href="/"
            className="text-text underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            Join the waitlist
          </Link>{" "}
          to be first.
        </p>
      </div>

      {/* Creator */}
      <div className="tip-section flex items-center gap-4">
        {pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pictureUrl}
            alt=""
            width={56}
            height={56}
            className="shrink-0 rounded-full"
          />
        )}
        <div className="min-w-0">
          <h1 className="display truncate text-[clamp(1.5rem,5vw,2rem)]">{name}</h1>
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

      <form className="space-y-6">
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

        {/* Anonymous — above name so the disabled state is explained before it happens */}
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
            className="w-full h-12 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent focus:outline-none disabled:opacity-40"
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

        {/* Disabled submit */}
        <div className="tip-section">
          <button
            type="submit"
            disabled
            className="w-full h-14 rounded-full bg-accent text-base font-semibold text-ink opacity-50 cursor-not-allowed"
          >
            Tips open soon →
          </button>
        </div>
      </form>
    </div>
  );
}
