"use client";

import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { useTipForm } from "@/components/tip/TipFormContext";
import { usableFor, type ResolvedAsset } from "@/lib/page-doc/assets";
import type { Block } from "@/lib/page-doc/types";
import { useMotionAllowed } from "./use-motion";

// A GIF banner shows its still until the device may play motion (see motion.ts). Only this part
// listens for that, so a page without a GIF banner does no extra work.
function GifBanner({ asset, render }: { asset: ResolvedAsset; render: (url: string | null) => React.ReactNode }) {
  const motion = useMotionAllowed();
  return <>{render(motion ? asset.url : asset.posterUrl)}</>;
}

// The creator's photo, banner, name, channel and bio. Everything but the banner is the creator's
// own account data. A banner picture chosen from the library replaces the creator's own banner. A
// picture that is missing, taken down or the wrong kind leaves the creator's own banner.
export function HeaderBlock({ block }: { block: Block<"header"> }) {
  const { displayName, pictureUrl, bannerUrl, ytChannelName, ytChannelUrl, bio, previewMode, assets } = useTipForm();
  const id = block.settings.bannerAsset;
  const asset = id === null ? undefined : assets[id];
  const panel = (banner: string | null) => (
    <CreatorPanel
      displayName={displayName}
      pictureUrl={pictureUrl}
      bannerUrl={banner ?? bannerUrl}
      ytChannelName={ytChannelName}
      ytChannelUrl={ytChannelUrl}
      bio={bio}
      previewMode={previewMode}
    />
  );
  if (asset && usableFor(asset.kind, "banner")) {
    return asset.kind === "gif" ? <GifBanner asset={asset} render={panel} /> : panel(asset.url);
  }
  return panel(null);
}
