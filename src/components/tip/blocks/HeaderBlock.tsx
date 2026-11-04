"use client";

import { CreatorPanel } from "@/components/tip/CreatorPanel";
import type { DecorRender } from "@/components/tip/Decor";
import { useTipForm } from "@/components/tip/TipFormContext";
import { usableFor, type AssetUse, type ResolvedAsset } from "@/lib/page-doc/assets";
import type { Block } from "@/lib/page-doc/types";
import { useMotionAllowed } from "./use-motion";

// A GIF banner shows its still until the device may play motion (see motion.ts). Only this part
// listens for that, so a page without a GIF banner does no extra work.
function GifBanner({ asset, render }: { asset: ResolvedAsset; render: (url: string | null) => React.ReactNode }) {
  const motion = useMotionAllowed();
  return <>{render(motion ? asset.url : asset.posterUrl)}</>;
}

// What to draw for the frame or the effect: the ready-made look, or the library file when the choice
// is "custom" and the file is there and fits (otherwise nothing, so the page is plain).
function decor(style: string, id: number | null, use: AssetUse, assets: Record<number, ResolvedAsset | undefined>): DecorRender {
  if (style === "none") return null;
  if (style !== "custom") return { kind: "preset", style } as DecorRender;
  const asset = id === null ? undefined : assets[id];
  if (!asset || !usableFor(asset.kind, use)) return null;
  return { kind: "custom", url: asset.url, posterUrl: asset.posterUrl, animated: asset.kind === "gif" };
}

// The creator's photo, banner, name, channel and bio. Everything but the banner is the creator's
// own account data. A banner picture chosen from the library replaces the creator's own banner. A
// picture that is missing, taken down or the wrong kind leaves the creator's own banner.
export function HeaderBlock({ block }: { block: Block<"header"> }) {
  const { displayName, pictureUrl, bannerUrl, ytChannelName, ytChannelUrl, bio, previewMode, assets } = useTipForm();
  const id = block.settings.bannerAsset;
  const asset = id === null ? undefined : assets[id];
  const { frame, frameAsset, bannerFx, bannerFxAsset } = block.settings;
  const frameRender = decor(frame, frameAsset, "frame", assets);
  const fxRender = decor(bannerFx, bannerFxAsset, "fx", assets);
  const panel = (banner: string | null) => (
    <CreatorPanel
      frame={frameRender}
      bannerFx={fxRender}
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
