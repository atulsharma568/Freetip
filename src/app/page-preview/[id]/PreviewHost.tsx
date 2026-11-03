"use client";

import { useEffect, useState } from "react";
import { TipPageView, type TipPageData } from "@/app/[handle]/TipPageView";
import { MSG_READY, MSG_SELECT, readDocMessage, readSelectMessage } from "@/lib/page-doc/preview-message";
import type { BlockType } from "@/lib/page-doc/types";

// The editor's preview: the real tip page, drawn from whatever draft the editor sends. It starts
// with the saved draft and redraws on each message, with no reload. Payments are off (previewMode)
// and links do nothing, so nothing here can reach a fan or take a payment. A click picks a block
// for the editor to show settings for.
export function PreviewHost({ data }: { data: TipPageData }) {
  const [doc, setDoc] = useState(data.doc);
  const [selected, setSelected] = useState<BlockType | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = readDocMessage(event, window.location.origin, window.parent);
      if (next) {
        setDoc(next);
        // Answer a draft with "ready", so an editor that missed the first one stops asking.
        window.parent.postMessage({ type: MSG_READY }, window.location.origin);
        return;
      }
      const pick = readSelectMessage(event, window.location.origin, window.parent);
      if (pick) setSelected(pick.block);
    };
    window.addEventListener("message", onMessage);
    // Tell the editor it can send the draft now.
    if (window.parent !== window) window.parent.postMessage({ type: MSG_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function onClickCapture(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("a")) event.preventDefault();
    const id = target.closest("[data-block-id]")?.getAttribute("data-block-id");
    if (id && window.parent !== window) window.parent.postMessage({ type: MSG_SELECT, id }, window.location.origin);
  }

  return (
    <div onClickCapture={onClickCapture}>
      {/* The editor's own colours, not the page's, so the outline is never mistaken for the design. */}
      <style>{`
        [data-block-id]:hover { outline: 1px dashed #4da3ff; outline-offset: 4px; cursor: pointer; }
        ${selected ? `[data-block-id="${selected}"] { outline: 2px solid #4da3ff; outline-offset: 4px; }` : ""}
      `}</style>
      <TipPageView data={{ ...data, doc, previewMode: true, editing: true }} />
    </div>
  );
}
