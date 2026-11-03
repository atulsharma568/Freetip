"use client";

import { useEffect, useRef, useState } from "react";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import { useMotionAllowed } from "./use-motion";

// The picture, GIF or video behind a tip page. The still picture (the file itself for a picture,
// the first frame for a GIF or video) is drawn in the served page. Where the device allows motion
// (see motion.ts) and after the page has loaded, a GIF replaces its still and a muted, looping
// video fades in over it; the video stops while the tab is hidden. If the video cannot play, the
// still stays.
export function BackdropMedia({ asset }: { asset: ResolvedAsset }) {
  const motion = useMotionAllowed();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const playsVideo = asset.kind === "webm" && motion;

  useEffect(() => {
    if (!playsVideo) return;
    const onVisibility = () => {
      const el = video.current;
      if (!el) return;
      if (document.hidden) el.pause();
      else el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playsVideo]);

  const still = asset.kind === "image" ? asset.url : asset.posterUrl;
  const cover = "absolute inset-0 size-full object-cover";
  return (
    <>
      {asset.kind === "gif" && motion ? (
        // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, kept animated and unoptimised
        <img src={asset.url} alt="" decoding="async" className={cover} />
      ) : (
        still && (
          // eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, unoptimised
          <img src={still} alt="" decoding="async" className={cover} />
        )
      )}
      {playsVideo && (
        <video
          ref={video}
          src={asset.url}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
          className={`${cover} transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}
