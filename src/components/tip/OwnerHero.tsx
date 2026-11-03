"use client";

import Image from "next/image";
import { isUploadedBannerUrl } from "@/lib/tip-banner";

// The owner's own tip page header (shown only on the owner's page, see `isOwnerTipPage`): a slim
// strip with the channel banner, the photo, the name and a thin pressure bar that fills as the
// amount goes up. The tip form underneath is the shared one.

const TOP_RUPEES = 5000;

// Where an amount sits on the bar: a log scale, so ₹20 and ₹5,000 both fit.
function fraction(amount: number, low: number): number {
  if (!(amount > low)) return 0;
  return Math.min(1, Math.log(amount / low) / Math.log(TOP_RUPEES / low));
}

const LEVELS = [
  { upTo: 0.25, name: "Warming up" },
  { upTo: 0.5, name: "Building" },
  { upTo: 0.75, name: "Heavy" },
  { upTo: 0.95, name: "Critical" },
  { upTo: 1.01, name: "Redline" },
];

// "AcePressure" splits into "Ace" and "Pressure"; a name with spaces splits at the first space.
function splitName(name: string): [string, string] {
  const parts = name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/).filter(Boolean);
  return parts.length > 1 ? [parts[0], parts.slice(1).join(" ")] : [name, ""];
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
  const f = fraction(amountRupees, Math.max(1, minRupees));
  const level = LEVELS.find((l) => f < l.upTo)?.name ?? "Redline";
  const [first, rest] = splitName(displayName);
  // A one-word brand such as "AcePressure" stays one word, only the second half is lime.
  const gap = /\s/.test(displayName.trim()) ? " " : "";

  return (
    <section
      aria-label="Creator"
      className="relative isolate overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface/80 backdrop-blur-sm"
    >
      <div className="relative h-28 sm:h-36" aria-hidden="true">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            priority
            unoptimized={isUploadedBannerUrl(bannerUrl)}
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="ap-strip absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/10 to-transparent" />
      </div>

      <div className="space-y-4 px-5 pb-5 sm:px-8 sm:pb-6">
        <div className="-mt-12 flex flex-wrap items-end gap-x-5 gap-y-3 sm:-mt-14">
          <span className="ap-ring relative inline-block shrink-0 rounded-full border-2 border-accent bg-ground p-1.5">
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
          <div className="order-3 min-w-0 basis-full pb-1 sm:order-2 sm:flex-1 sm:basis-0">
            <h1 className="display break-words text-[clamp(2.25rem,8vw,3.75rem)] leading-[0.95]">
              {first}
              {rest && <span className="text-accent">{gap}{rest}</span>}
            </h1>
          </div>
          <p className="order-2 ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-ground/70 px-3 py-1 text-xs font-medium text-muted sm:order-3 sm:ml-0">
            <span aria-hidden="true" className="live-dot" />
            {previewMode ? "Preview" : "Tips open"}
          </p>
        </div>

        {(bio || (ytChannelName && ytChannelUrl)) && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            {bio && <p className="max-w-xl text-pretty text-base text-muted">{bio}</p>}
            {ytChannelName && ytChannelUrl && (
              <a
                href={ytChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-muted transition-colors hover:text-text"
              >
                {ytChannelName}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}

        <div
          role="img"
          aria-label={`Pressure: ${level}, ₹${amountRupees.toLocaleString("en-IN")}`}
          className="flex items-center gap-3"
        >
          <span aria-hidden="true" className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-muted">
            Pressure
          </span>
          <span aria-hidden="true" className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/60">
            <span
              className={`ap-fill absolute inset-y-0 left-0 rounded-full bg-accent ${f >= 0.95 ? "ap-hot" : ""}`}
              style={{ width: `${Math.max(3, f * 100)}%` }}
            />
          </span>
          <span aria-hidden="true" className="w-24 text-right text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-accent">
            {level}
          </span>
        </div>
      </div>
    </section>
  );
}
