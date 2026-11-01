"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { INK_HEX, SITE_HOST } from "@/lib/site";

const PERKS = ["UPI and cards", "No account or email", "Alert on their stream"];

// The creator column: avatar with an accent ring, name, channel link, bio, a
// few plain facts as chips and (from lg up, where there is room and a second
// device is useful) a scannable QR of this page's address.
export function CreatorPanel({
  handle,
  displayName,
  pictureUrl,
  ytChannelName,
  ytChannelUrl,
  bio,
  previewMode,
}: {
  handle: string;
  displayName: string;
  pictureUrl: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  bio: string | null;
  previewMode: boolean;
}) {
  const url = `https://${SITE_HOST}/${handle}`;
  return (
    <section className="space-y-5" aria-label="Creator">
      <div className="flex items-center gap-4">
        <span className="shrink-0 rounded-full border-2 border-accent p-1">
          {pictureUrl ? (
            <Image
              src={pictureUrl}
              alt={`${displayName}'s profile photo`}
              loading="eager"
              width={64}
              height={64}
              className="block size-16 rounded-full"
            />
          ) : (
            <span
              aria-hidden="true"
              className="display grid size-16 place-items-center rounded-full bg-accent text-3xl text-ink"
            >
              {[...displayName][0]?.toUpperCase() ?? "F"}
            </span>
          )}
        </span>
        <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
          <span aria-hidden="true" className="live-dot" />
          {previewMode ? "Preview" : "Tips open"}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <h1 className="display text-[clamp(2rem,6vw,3rem)] break-words">{displayName}</h1>
        {ytChannelName && ytChannelUrl && (
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
        {bio && <p className="text-pretty text-base text-muted">{bio}</p>}
      </div>
      <ul className="flex flex-wrap gap-2">
        {PERKS.map((perk) => (
          <li key={perk} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
            {perk}
          </li>
        ))}
      </ul>
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
    </section>
  );
}
