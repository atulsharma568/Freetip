"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Lightning, MonitorPlay, UserMinus } from "@phosphor-icons/react";
import { INK_HEX, SITE_HOST } from "@/lib/site";
import { isUploadedBannerUrl } from "@/lib/tip-banner";
import { useBannerTint } from "./use-banner-tint";
import { AvatarPicture, BannerEffect, PhotoFrame, type DecorRender } from "./Decor";
import { FlipName } from "./Signature";

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
  avatar = null,
  frame = null,
  bannerFx = null,
  bannerPic = null,
  fxWholeHeader = false,
  signature = false,
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
  // An animated frame over the photo and an effect over the banner (custom tip page); null draws none.
  // `avatar` is an animated profile picture in the photo's place; `frame` is the ring drawn over it.
  avatar?: DecorRender;
  frame?: DecorRender;
  bannerFx?: DecorRender;
  // A ready-made animated banner picture. It is drawn over the banner picture and under the effect, so
  // an effect (embers, petals, clutch) plays on top of it.
  bannerPic?: DecorRender;
  // The effect covers the banner, photo, name and bio instead of only the banner strip.
  fxWholeHeader?: boolean;
  // The owner's own page: the name flips in (Signature.tsx) in the heavy italic face.
  signature?: boolean;
}) {
  // The picture the visitor sees on the banner (a ready-made animated picture covers the creator's own
  // banner); the effect over it is drawn in that picture's main colour. No picture keeps the accent.
  // A ready-made picture is read from its small still, not the whole animation.
  const tint = useBannerTint(bannerPic?.kind === "custom" ? (bannerPic.posterUrl ?? bannerPic.url) : bannerUrl);
  // A channel with the same name as the display name would just repeat it.
  const showChannel = ytChannelName && ytChannelUrl && ytChannelName.trim().toLowerCase() !== displayName.trim().toLowerCase();
  // An effect with no banner picture gets a banner strip of its own (the page colour fading to the
  // ground), so a creator can have an animated banner without uploading one.
  const hasBanner = Boolean(bannerUrl) || bannerPic !== null || (bannerFx !== null && !fxWholeHeader);
  // A finished whole-header animation (drawn with dark fog and a forest) plays behind the photo and the
  // words, so it never hides them; an uploaded one plays over everything, as its maker drew it.
  const fxBehind = fxWholeHeader && bannerFx?.kind === "custom" && bannerFx.wholeHeader === true;
  return (
    <section className="space-y-6" aria-label="Creator">
      <div className="relative space-y-4">
        {fxWholeHeader && (
          <div className={`pointer-events-none absolute inset-0 ${fxBehind ? "z-[1]" : "z-20"}`}>
            <BannerEffect render={bannerFx} tint={tint} />
          </div>
        )}
        {hasBanner && (
          <div
            className="relative aspect-[16/5] overflow-hidden rounded-[var(--radius-surface)] border border-line/60 bg-surface"
            style={bannerUrl || bannerPic ? undefined : { background: "linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 30%, var(--color-ground)), var(--color-ground) 80%)" }}
          >
            {bannerUrl && (
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
            )}
            <BannerEffect render={bannerPic} />
            {!fxWholeHeader && <BannerEffect render={bannerFx} tint={tint} />}
          </div>
        )}
        <span className={`relative inline-block rounded-full border-2 border-accent p-1.5 ${hasBanner ? "z-10 -mt-14 bg-ground sm:-mt-16" : fxBehind ? "z-[2]" : ""} ${hasBanner ? (frame ? "ml-6" : "ml-4") : frame ? "m-4" : ""}`}>
          <AvatarPicture render={avatar} />
          <PhotoFrame render={frame} />
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
        <div className={`min-w-0 space-y-3 ${fxBehind ? "relative z-[2]" : ""}`}>
          <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
            <span aria-hidden="true" className="live-dot" />
            {previewMode ? "Preview" : "Tips open"}
          </p>
          {signature ? (
            <FlipName name={displayName} as={Heading} />
          ) : (
            <Heading className="display text-[clamp(2.5rem,7vw,3.75rem)] break-words">{displayName}</Heading>
          )}
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
