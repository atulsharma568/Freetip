"use client";

import { CreatorPanel } from "@/components/tip/CreatorPanel";
import type { DecorRender } from "@/components/tip/Decor";
import { useTipForm } from "@/components/tip/TipFormContext";
import { usableFor, type AssetUse, type ResolvedAsset } from "@/lib/page-doc/assets";
import { FILE_FRAMES, FILE_FX, isFileFrame, isFileFx } from "@/lib/page-doc/decor";
import type { Block } from "@/lib/page-doc/types";
import { useMotionAllowed } from "./use-motion";

// A GIF banner shows its still until the device may play motion (see motion.ts). Only this part
// listens for that, so a page without a GIF banner does no extra work.
function GifBanner({ asset, render }: { asset: ResolvedAsset; render: (url: string | null) => React.ReactNode }) {
  const motion = useMotionAllowed();
  return <>{render(motion ? asset.url : asset.posterUrl)}</>;
}

// What to draw for the frame or the effect: the ready-made look (drawn in CSS, or a finished animation
// that ships with the site), or the library file when the choice is "custom" and the file is there and fits (otherwise nothing, so the page is plain).
function decor(style: string, id: number | null, use: AssetUse, assets: Record<number, ResolvedAsset | undefined>, scale?: number): DecorRender {
  if (style === "none") return null;
  if (use === "frame" && isFileFrame(style)) {
    const f = FILE_FRAMES[style];
    return { kind: "custom", url: f.url, posterUrl: f.posterUrl, animated: true, scale: f.scale };
  }
  if (use === "fx" && isFileFx(style)) {
    const f = FILE_FX[style];
    return { kind: "custom", url: f.url, posterUrl: f.posterUrl, animated: f.animated, wholeHeader: f.wholeHeader };
  }
  if (style !== "custom") return { kind: "preset", style } as DecorRender;
  const asset = id === null ? undefined : assets[id];
  if (!asset || !usableFor(asset.kind, use)) return null;
  return { kind: "custom", url: asset.url, posterUrl: asset.posterUrl, animated: asset.kind === "gif", scale };
}

// The creator's photo, banner, name, channel and bio. Everything but the banner is the creator's
// own account data. A banner picture chosen from the library replaces the creator's own banner. A
// picture that is missing, taken down or the wrong kind leaves the creator's own banner.
export function HeaderBlock({ block }: { block: Block<"header"> }) {
  const { displayName, pictureUrl, bannerUrl, ytChannelName, ytChannelUrl, bio, previewMode, assets } = useTipForm();
  const id = block.settings.bannerAsset;
  const asset = id === null ? undefined : assets[id];
  const { frame, frameAsset, frameScale, bannerFx, bannerFxAsset, fxArea } = block.settings;
  const frameRender = decor(frame, frameAsset, "frame", assets, frameScale);
  const fxRender = decor(bannerFx, bannerFxAsset, "fx", assets);
  const panel = (banner: string | null) => (
    <CreatorPanel
      frame={frameRender}
      bannerFx={fxRender}
      // Only a picture or animation of the library can cover the whole header; a ready-made effect is
      // drawn for the banner's own box.
      fxWholeHeader={fxRender?.kind === "custom" && (fxRender.wholeHeader === true || fxArea === "header")}
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
