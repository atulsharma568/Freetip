"use client";

import Image from "next/image";
import { isUploadedBannerUrl } from "@/lib/tip-banner";
import { OWNER_COPY, pressureFraction, pressureLevel } from "@/lib/owner-page";
import { ownerFont } from "./owner-font";

// The owner's own tip page header (shown only on the owner's page, see `isOwnerTipPage`): the
// channel banner shown properly, the photo over its corner, the cut-out of the face on wide
// screens, and the small lines from the owner's stream screens. The tip form is the shared one.

export function OwnerHero({
  displayName,
  pictureUrl,
  bannerUrl,
  bio,
  ytChannelName,
  ytChannelUrl,
  previewMode,
}: {
  displayName: string;
  pictureUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  previewMode: boolean;
}) {
  return (
    <section
      aria-label="Creator"
      className="ap-hero relative isolate overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface/80 backdrop-blur-sm"
    >
      <div className="relative aspect-[16/7] sm:aspect-[16/5]" aria-hidden="true">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            priority
            unoptimized={isUploadedBannerUrl(bannerUrl)}
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover object-center"
          />
        ) : (
          <div className="ap-strip absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
      </div>

      <div className="relative px-5 pb-6 sm:px-8">
        {/* The face, cut out, standing up out of the card on wide screens. */}
        <Image
          src="/owner/avatar-cutout.webp"
          alt=""
          width={560}
          height={560}
          aria-hidden="true"
          className="ap-bust pointer-events-none absolute bottom-0 right-6 hidden h-60 w-auto lg:block xl:right-10 xl:h-72"
        />

        <div className="-mt-12 flex items-end gap-4 sm:-mt-14 lg:mt-5">
          <span className="ap-ring relative inline-block shrink-0 rounded-full border-2 border-accent bg-ground p-1.5 lg:hidden">
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
                {[...displayName][0]?.toUpperCase() ?? "A"}
              </span>
            )}
          </span>
          <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-line bg-ground/70 px-3 py-1 text-xs font-medium text-muted">
            <span aria-hidden="true" className="live-dot" />
            {previewMode ? "Preview" : "Tips open"}
          </p>
        </div>

        <div className="mt-5 max-w-xl space-y-3 lg:max-w-[55%]">
          <h1 className="sr-only">{displayName}</h1>
          <p
            aria-hidden="true"
            className={`${ownerFont.className} text-[clamp(1.9rem,6.5vw,3rem)] font-black uppercase italic leading-[0.95] tracking-tight`}
          >
            <span className="block text-text">Tip the</span>
            <span className="ap-ghost block">Squad</span>
          </p>
          <p className="flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-muted">
            <span aria-hidden="true" className="h-px w-6 bg-accent" />
            {OWNER_COPY.tagline}
          </p>
          {bio && <p className="text-pretty text-base text-muted">{bio}</p>}
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {ytChannelName && ytChannelUrl && (
              <a
                href={ytChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-text"
              >
                {ytChannelName}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <a
              href={`https://www.instagram.com/${OWNER_COPY.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-text"
            >
              @{OWNER_COPY.instagram}
              <span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

// The thin bar in the amount box: it fills as the amount rises, with a One Piece bounty word.
export function PressureBar({ amountRupees, minRupees }: { amountRupees: number; minRupees: number }) {
  const f = pressureFraction(amountRupees, minRupees);
  const level = pressureLevel(f);
  return (
    <div
      role="img"
      aria-label={`Pressure: ${level}, ₹${amountRupees.toLocaleString("en-IN")}`}
      className="flex items-center gap-3 pt-1"
    >
      <span aria-hidden="true" className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted">
        Pressure
      </span>
      <span aria-hidden="true" className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line/60">
        <span
          className={`ap-fill absolute inset-y-0 left-0 rounded-full bg-accent ${f >= 0.95 ? "ap-hot" : ""}`}
          style={{ width: `${Math.max(3, f * 100)}%` }}
        />
      </span>
      <span aria-hidden="true" className="w-24 text-right text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-accent">
        {level}
      </span>
    </div>
  );
}

// The line under the form card, like the strip at the bottom of the stream screens.
export function OwnerStrip() {
  return (
    <p
      className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line/60 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted"
    >
      <span>{OWNER_COPY.youtubeLabel}</span>
      <span>@{OWNER_COPY.instagram}</span>
    </p>
  );
}
