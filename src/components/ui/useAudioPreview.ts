"use client";

import { useSyncExternalStore } from "react";

// One preview clip at a time, shared by the tip page and the dashboard. Pressing the clip
// that is playing pauses it; pressing another one stops the first and plays the new one.
let audio: HTMLAudioElement | null = null;
let playingUrl: string | null = null;
const listeners = new Set<() => void>();

function set(url: string | null) {
  playingUrl = url;
  listeners.forEach((l) => l());
}

function stop() {
  audio?.pause();
  audio = null;
  set(null);
}

function toggle(url: string, volumePercent = 100) {
  if (playingUrl === url) {
    stop();
    return;
  }
  play(url, volumePercent);
}

// Always starts the clip from the beginning, even if the same file is already playing
// (two picks can share one sound).
function play(url: string, volumePercent = 100) {
  audio?.pause();
  const next = new Audio(url);
  next.volume = Math.min(1, Math.max(0, volumePercent / 100));
  const done = () => {
    if (audio === next) {
      audio = null;
      set(null);
    }
  };
  next.addEventListener("ended", done);
  next.addEventListener("error", done);
  audio = next;
  set(url);
  next.play().catch(done);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useAudioPreview() {
  const playing = useSyncExternalStore(subscribe, () => playingUrl, () => null);
  return { playing, toggle, play, stop };
}
