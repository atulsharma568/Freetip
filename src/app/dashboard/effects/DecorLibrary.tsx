"use client";

import Image from "next/image";
import type { DecorItem } from "@/lib/decor-library";
import { DECOR_ANCHOR_LABELS, DECOR_NUDGE, DECOR_PLACED_SIZE, FRAME_SCALE, parsePlacement, type DecorAnchor, type DecorPlacement } from "@/lib/page-doc/decor";

// The creator's saved pictures of one kind (their own and those the owner shared with them) as a
// grid of thumbnails to pick from, and the placement controls for a decoration.

const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function LibraryGrid({
  title,
  items,
  pickedId,
  wornId,
  onPick,
  empty,
}: {
  title: string;
  items: DecorItem[];
  pickedId: number | null;
  wornId: number | null;
  onPick: (item: DecorItem) => void;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul role="group" aria-label={title} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((it) => {
            const on = pickedId === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(it)}
                  className={`flex min-h-11 w-full flex-col items-stretch gap-1 rounded-field border p-2 text-left text-xs transition-colors duration-150 ${
                    on ? "border-accent bg-accent/10 text-text" : "border-line/60 text-muted hover:border-control"
                  }`}
                >
                  <span
                    className="relative block aspect-square w-full overflow-hidden rounded-field"
                    style={{ backgroundImage: "repeating-conic-gradient(rgb(128 128 128 / 0.18) 0% 25%, transparent 0% 50%)", backgroundSize: "12px 12px" }}
                  >
                    <Image src={it.posterUrl ?? it.url} alt="" fill unoptimized sizes="160px" className="object-contain" />
                  </span>
                  <span className="truncate font-medium text-text">{it.name}</span>
                  <span>
                    {it.width} × {it.height}, {sizeText(it.sizeBytes)}
                    {it.animated ? ", animated" : ""}
                  </span>
                  {it.ownerHandle && <span className="font-medium text-accent">Shared with you by @{it.ownerHandle}</span>}
                  {wornId === it.id && <span className="font-medium text-text">On your tip page now</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const ANCHOR_GRID: DecorAnchor[][] = [
  ["top-left", "top", "top-right"],
  ["left", "ring", "right"],
  ["bottom-left", "bottom", "bottom-right"],
];

// Where the decoration sits on the photo: a 3 × 3 pad (the middle is "around the photo"), a size slider
// and two nudge sliders. Every control has a text label and a number, so it works by keyboard and by
// screen reader; the preview next to it shows the result.
export function PlacementEditor({ value, onChange }: { value: DecorPlacement; onChange: (next: DecorPlacement) => void }) {
  const set = (patch: Partial<DecorPlacement>) => onChange(parsePlacement({ ...value, ...patch }));
  const ring = value.anchor === "ring";
  const range = ring ? FRAME_SCALE : DECOR_PLACED_SIZE;
  const label = "text-sm text-muted";
  return (
    <fieldset className="space-y-3 rounded-field border border-line/60 p-3">
      <legend className="px-1 text-sm font-semibold text-text">Where it goes on your photo</legend>
      <div role="radiogroup" aria-label="Spot on your photo" className="grid w-44 grid-cols-3 gap-1.5">
        {ANCHOR_GRID.flat().map((a) => {
          const on = value.anchor === a;
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={DECOR_ANCHOR_LABELS[a]}
              title={DECOR_ANCHOR_LABELS[a]}
              onClick={() => set({ anchor: a, size: a === "ring" ? FRAME_SCALE.standard : value.anchor === "ring" ? DECOR_PLACED_SIZE.standard : value.size, dx: 0, dy: 0 })}
              className={`flex size-14 items-center justify-center rounded-field border text-[10px] leading-tight transition-colors duration-150 ${
                on ? "border-accent bg-accent text-ink" : "border-line/60 text-muted hover:border-control"
              }`}
            >
              {a === "ring" ? "Around" : DECOR_ANCHOR_LABELS[a].replace(" ", "\n")}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">Now: {DECOR_ANCHOR_LABELS[value.anchor]}.</p>
      <label className="block space-y-1">
        <span className={label}>Size: {value.size}% of your photo</span>
        <input type="range" min={range.min} max={range.max} step={range.step} value={value.size} onChange={(e) => set({ size: Number(e.target.value) })} className="block w-full accent-[var(--color-accent)]" />
      </label>
      <label className="block space-y-1">
        <span className={label}>Left or right: {value.dx > 0 ? `${value.dx}% right` : value.dx < 0 ? `${-value.dx}% left` : "centred"}</span>
        <input type="range" min={DECOR_NUDGE.min} max={DECOR_NUDGE.max} step={DECOR_NUDGE.step} value={value.dx} onChange={(e) => set({ dx: Number(e.target.value) })} className="block w-full accent-[var(--color-accent)]" />
      </label>
      <label className="block space-y-1">
        <span className={label}>Up or down: {value.dy > 0 ? `${value.dy}% down` : value.dy < 0 ? `${-value.dy}% up` : "centred"}</span>
        <input type="range" min={DECOR_NUDGE.min} max={DECOR_NUDGE.max} step={DECOR_NUDGE.step} value={value.dy} onChange={(e) => set({ dy: Number(e.target.value) })} className="block w-full accent-[var(--color-accent)]" />
      </label>
      <button
        type="button"
        onClick={() => onChange(parsePlacement(null))}
        className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted"
      >
        Reset position
      </button>
    </fieldset>
  );
}

