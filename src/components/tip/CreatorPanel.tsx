"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Lightning, MonitorPlay, UserMinus } from "@phosphor-icons/react";
import { INK_HEX, SITE_HOST } from "@/lib/site";
import { isUploadedBannerUrl } from "@/lib/tip-banner";

const PERKS = [
  { Icon: Lightning, text: "UPI and cards" },
  { Icon: UserMinus, text: "No account or email needed" },
  { Icon: MonitorPlay, text: "Shows as an alert on their stream" },
];

// The creator column: a big avatar with an accent ring, name, channel link, bio, three
// plain facts with icons and (from lg up, where there is room and a second device is
// useful) a scannable QR of this page's address.
export function CreatorPanel({
  displayName,
  pictureUrl,
  bannerUrl = null,
  ytChannelName,
  ytChannelUrl,
  bio,
  previewMode,
  headingAs: Heading = "h1",
}: {
  displayName: string;
  pictureUrl: string | null;
  // The creator's YouTube banner (paid), drawn behind their photo; null is the plain header.
  bannerUrl?: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  bio: string | null;
  previewMode: boolean;
  // The tip page's one h1; the dashboard preview sits under its own h1, so it passes "h3".
  headingAs?: "h1" | "h3";
}) {
  // A channel with the same name as the display name would just repeat it.
  const showChannel = ytChannelName && ytChannelUrl && ytChannelName.trim().toLowerCase() !== displayName.trim().toLowerCase();
  return (
    <section className="space-y-6" aria-label="Creator">
      <div className="space-y-4">
        {bannerUrl && (
          <div className="relative aspect-[16/5] overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface">
            <Image
              src={bannerUrl}
              alt=""
              fill
              priority
              // An upload goes out as it is: the image optimiser would flatten an animated banner.
              unoptimized={isUploadedBannerUrl(bannerUrl)}
              sizes="(min-width: 1024px) 400px, 100vw"
              className="object-cover"
            />
          </div>
        )}
        <span className={`inline-block rounded-full border-2 border-accent p-1.5 ${bannerUrl ? "relative z-10 -mt-14 ml-4 bg-ground sm:-mt-16" : ""}`}>
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
              className="display grid size-20 place-items-center rounded-full bg-accent text-4xl text-ink sm:size-24 sm:text-5xl"
            >
              {[...displayName][0]?.toUpperCase() ?? "F"}
            </span>
          )}
        </span>
        <div className="min-w-0 space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
            <span aria-hidden="true" className="live-dot" />
            {previewMode ? "Preview" : "Tips open"}
          </p>
          <Heading className="display text-[clamp(2.5rem,7vw,3.75rem)] break-words">{displayName}</Heading>
          {showChannel && (
            <a
              href={ytChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-muted transition-colors hover:text-text"
            >
              {ytChannelName}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {bio && <p className="text-pretty text-lg text-muted [overflow-wrap:anywhere]">{bio}</p>}
        </div>
      </div>
      <ul className="divide-y divide-line/60 rounded-[var(--radius-surface)] border border-line/60">
        {PERKS.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 px-4 py-3 text-sm text-text">
            <Icon weight="bold" aria-hidden="true" className="size-5 shrink-0 text-accent" />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

// A scannable QR of this page's address, for a second device. Wide screens only, where
// there is room beside the form.
export function QrTile({ handle }: { handle: string }) {
  const url = `https://${SITE_HOST}/${handle}`;
  return (
    <div className="on-accent hidden items-center gap-4 rounded-[var(--radius-surface)] bg-accent p-4 text-ink lg:flex">
      <div
        role="img"
        aria-label={`QR code for ${SITE_HOST}/${handle}`}
        className="shrink-0 rounded-[var(--radius-field)] border-2 border-ink p-2"
      >
        <QRCodeSVG value={url} size={104} fgColor={INK_HEX} bgColor="transparent" level="M" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">Scan to tip from your phone</p>
        <p className="numeric break-all text-xs text-ink/85">
          {SITE_HOST}/{handle}
        </p>
      </div>
    </div>
  );
}
