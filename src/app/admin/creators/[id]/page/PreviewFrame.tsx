"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { buttonClass } from "@/components/admin/tones";
import { MSG_DOC, MSG_SELECT, isReadyMessage, readPickMessage } from "@/lib/page-doc/preview-message";
import type { BlockType, PageDoc } from "@/lib/page-doc/types";

export type PreviewView = "phone" | "laptop";

// The size of the screen the page is drawn for. The frame is really this big, so the page's own
// breakpoints (one column on a phone, two on a laptop) decide the layout, and it is shrunk to fit
// the panel with a CSS scale.
const SCREEN: Record<PreviewView, { width: number; height: number }> = {
  phone: { width: 390, height: 780 },
  laptop: { width: 1280, height: 800 },
};

// The real tip page in a frame, drawn from the working draft. The draft goes over by postMessage
// each time it changes (no reload, no save needed), and a click on a block in the frame comes back
// as the block to select. Only the frame this panel opened is believed (see preview-message.ts).
export function PreviewFrame({
  src,
  doc,
  selected,
  view,
  onView,
  onPick,
  reloadKey,
}: {
  src: string;
  doc: PageDoc;
  selected: BlockType | null;
  view: PreviewView;
  onView: (view: PreviewView) => void;
  onPick: (block: BlockType) => void;
  // Changes when the library changed, so the frame loads the page again and can draw a new file.
  reloadKey: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [scale, setScale] = useState(1);
  const screen = SCREEN[view];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (isReadyMessage(event, window.location.origin, win)) {
        setReady(true);
        return;
      }
      const pick = readPickMessage(event, window.location.origin, win);
      if (pick) onPick(pick);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPick]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: MSG_DOC, doc }, window.location.origin);
  }, [ready, doc, reloads]);

  // The library changed (a file was added or removed): the frame reads its files when it loads, so
  // load it again. The working draft is sent again as soon as it answers.
  const seenKey = useRef(reloadKey);
  useEffect(() => {
    if (seenKey.current === reloadKey) return;
    seenKey.current = reloadKey;
    setReady(false);
    setReloads((n) => n + 1);
  }, [reloadKey]);

  // The frame's "ready" can arrive before this panel is listening and is then lost. Until the frame
  // answers, offer it the draft every moment; the frame answers a draft with "ready" (see
  // PreviewHost), which ends this.
  const latest = useRef(doc);
  useEffect(() => {
    latest.current = doc;
  }, [doc]);
  useEffect(() => {
    if (ready) return;
    let tries = 0;
    const timer = setInterval(() => {
      frame.current?.contentWindow?.postMessage({ type: MSG_DOC, doc: latest.current }, window.location.origin);
      if (++tries >= 40) clearInterval(timer);
    }, 300);
    return () => clearInterval(timer);
  }, [ready, reloads]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: MSG_SELECT, id: selected }, window.location.origin);
  }, [ready, selected, reloads]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / screen.width) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [screen.width]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Preview size" className="inline-flex rounded-full border border-control p-0.5">
          {(["phone", "laptop"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              className={`min-h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
                view === v ? "bg-accent text-ink" : "text-muted hover:text-text"
              }`}
            >
              {v === "phone" ? "Phone" : "Laptop"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setReady(false);
            setReloads((n) => n + 1);
          }}
          className={buttonClass("quiet", "sm")}
        >
          <ArrowClockwise aria-hidden="true" />
          Reload preview
        </button>
      </div>
      <p className="text-xs text-muted">
        This is the real page with payments switched off. Click a piece of it to edit that block.
      </p>
      <div ref={box} className="w-full overflow-hidden">
        <div style={{ width: screen.width * scale, height: screen.height * scale }} className="mx-auto overflow-hidden rounded-surface border border-control bg-ground">
          <iframe
            key={reloads}
            ref={frame}
            src={src}
            title={`Tip page preview, ${view} size`}
            style={{ width: screen.width, height: screen.height, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
