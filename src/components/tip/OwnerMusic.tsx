"use client";

import dynamic from "next/dynamic";
import type { PageMusic } from "@/lib/page-music";

// The owner's tip-page player. Its own chunk, fetched only on the owner's page when a track is saved.
// Starts collapsed and silent (no autoplay), so a visitor presses play. Sits at the bottom-left, clear
// of the page content, and takes the page accent.
const MusicPlayer = dynamic(() => import("@/components/vui/music-player"), { ssr: false });

export function OwnerMusic({ music, artist }: { music: PageMusic; artist: string }) {
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <MusicPlayer tracks={[{ title: music.title, artist, src: music.url }]} defaultCollapsed accentColor="var(--color-accent)" loop />
    </div>
  );
}
