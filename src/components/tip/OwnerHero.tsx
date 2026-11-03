"use client";

import Image from "next/image";
import { isUploadedBannerUrl } from "@/lib/tip-banner";

// The owner's own tip page header (shown only on the owner's page, see `isOwnerTipPage`): a
// full-width stage with the channel banner, a stacked wordmark and a pressure gauge whose needle
// follows the amount being chosen. The tip form underneath is the shared one.

const SWEEP = 240; // degrees of dial, from -120 to +120
const MARKS = [20, 100, 500, 1000, 5000];

// Where an amount sits on the dial: a log scale, so ₹20 and ₹5,000 both fit.
function fraction(amount: number, low: number, high: number): number {
  if (!(amount > low)) return 0;
  return Math.min(1, Math.log(amount / low) / Math.log(high / low));
}

const LEVELS = [
  { upTo: 0.25, name: "Warming up" },
  { upTo: 0.5, name: "Building" },
  { upTo: 0.75, name: "Heavy" },
  { upTo: 0.95, name: "Critical" },
  { upTo: 1.01, name: "Redline" },
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// "AcePressure" stacks as "Ace" over "Pressure"; a name with spaces stacks word by word.
function wordmarkLines(name: string): string[] {
  const lines = name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/).filter(Boolean);
  return lines.length ? lines.slice(0, 3) : [name];
}

export function OwnerHero({
  displayName,
  pictureUrl,
  bannerUrl,
  bio,
  ytChannelName,
  ytChannelUrl,
  amountRupees,
  minRupees,
  previewMode,
}: {
  displayName: string;
  pictureUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  amountRupees: number;
  minRupees: number;
  previewMode: boolean;
}) {
  const low = Math.max(1, minRupees);
  const f = fraction(amountRupees, low, 5000);
  const level = LEVELS.find((l) => f < l.upTo)?.name ?? "Redline";
  const angle = -SWEEP / 2 + f * SWEEP;
  const lines = wordmarkLines(displayName);
  const marks = MARKS.filter((m) => m >= low).slice(0, 5);

  return (
    <section
      aria-label="Creator"
      className="ap-stage relative isolate overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-ground"
    >
      {bannerUrl && (
        <Image
          src={bannerUrl}
          alt=""
          fill
          priority
          unoptimized={isUploadedBannerUrl(bannerUrl)}
          sizes="100vw"
          className="-z-20 object-cover opacity-45"
        />
      )}
      <div aria-hidden="true" className="ap-grid absolute inset-0 -z-10" />
      <div aria-hidden="true" className="ap-glow absolute -right-24 -top-24 -z-10 size-[28rem] rounded-full" />

      <div className="grid gap-8 px-5 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ground/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <span aria-hidden="true" className="live-dot" />
            {previewMode ? "Preview" : "Tips open"}
          </p>
          <div className="flex items-center gap-4">
            <span className="ap-ring inline-block shrink-0 rounded-full border-2 border-accent p-1.5">
              {pictureUrl ? (
                <Image
                  src={pictureUrl}
                  alt={`${displayName}'s profile photo`}
                  loading="eager"
                  width={96}
                  height={96}
                  className="block size-20 rounded-full sm:size-24"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="display grid size-20 place-items-center rounded-full bg-accent text-4xl text-ink sm:size-24"
                >
                  {[...displayName][0]?.toUpperCase() ?? "F"}
                </span>
              )}
            </span>
            {ytChannelName && ytChannelUrl && (
              <a
                href={ytChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate rounded-full border border-line bg-ground/70 px-4 py-2 text-sm text-text backdrop-blur transition-colors hover:border-muted"
              >
                {ytChannelName}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
          <h1 className="display break-words text-[clamp(3.25rem,13vw,7.5rem)] leading-[0.9]">
            {lines.map((line, i) => (
              <span key={line + i} className={`block ${i === lines.length - 1 && lines.length > 1 ? "text-accent" : ""}`}>
                {line}
              </span>
            ))}
          </h1>
          {bio && <p className="max-w-md text-pretty text-lg text-muted">{bio}</p>}
        </div>

        <div className="mx-auto w-full max-w-sm">
          <svg
            viewBox="0 0 300 250"
            role="img"
            aria-label={`Pressure gauge: ${level}, ₹${amountRupees.toLocaleString("en-IN")}`}
            className="w-full"
          >
            <path d={arc(150, 140, 120, -SWEEP / 2, SWEEP / 2)} fill="none" stroke="var(--color-line)" strokeWidth="14" strokeLinecap="round" />
            {f > 0 && (
              <path
                d={arc(150, 140, 120, -SWEEP / 2, angle)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="14"
                strokeLinecap="round"
              />
            )}
            {Array.from({ length: 25 }, (_, i) => {
              const d = -SWEEP / 2 + (i / 24) * SWEEP;
              const big = i % 6 === 0;
              const a = polar(150, 140, big ? 96 : 102, d);
              const b = polar(150, 140, 108, d);
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-control)" strokeWidth={big ? 3 : 1.5} />
              );
            })}
            {marks.map((m) => {
              const d = -SWEEP / 2 + fraction(m, low, 5000) * SWEEP;
              const p = polar(150, 140, 80, d);
              return (
                <text key={m} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="numeric" fill="var(--color-muted)" fontSize="11">
                  {m >= 1000 ? `${m / 1000}k` : m}
                </text>
              );
            })}
            <g className={`ap-needle ${f >= 0.95 ? "ap-shake" : ""}`} style={{ transform: `rotate(${angle}deg)`, transformOrigin: "150px 140px" }}>
              <polygon points="146,140 154,140 150,52" fill="var(--color-accent)" />
            </g>
            <circle cx="150" cy="140" r="12" fill="var(--color-ground)" stroke="var(--color-accent)" strokeWidth="3" />
            <text x="150" y="196" textAnchor="middle" className="numeric" fill="var(--color-text)" fontSize="30" fontWeight="600">
              ₹{amountRupees.toLocaleString("en-IN")}
            </text>
            <text x="150" y="222" textAnchor="middle" fill="var(--color-accent)" fontSize="14" fontWeight="600" letterSpacing="3">
              {level.toUpperCase()}
            </text>
          </svg>
        </div>
      </div>

      <div aria-hidden="true" className="ap-ticker border-t border-line/60 bg-ground/70 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        <div className="ap-ticker-track">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k} className="flex shrink-0 gap-8 pr-8">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i}>
                  {displayName} <span className="text-accent">●</span> Send pressure <span className="text-accent">●</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
