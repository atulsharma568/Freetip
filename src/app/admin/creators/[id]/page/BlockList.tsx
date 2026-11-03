"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Gauge, DotsSixVertical, Eye, EyeSlash, ImageSquare, Palette } from "@phosphor-icons/react";
import { BLOCK_LABELS, PROTECTED } from "@/lib/page-doc/blocks";
import type { Block, BlockType, PageDoc, Slot } from "@/lib/page-doc/types";

export type Selection = BlockType | "theme";

const SECTIONS: { slot: Slot; label: string }[] = [
  { slot: "background", label: "Behind the page" },
  { slot: "side", label: "Left column (on top on a phone)" },
  { slot: "main", label: "The form" },
  { slot: "bottom", label: "Under the form" },
  { slot: "success", label: "After a tip" },
];

const iconButton =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-text aria-disabled:cursor-not-allowed aria-disabled:opacity-30";

// Every block of the page by section, with the controls to move it up or down inside its section
// (buttons first, dragging as an extra), to hide or show it, and to pick it for editing. The page
// colours sit on top as their own entry.
export function BlockList({
  doc,
  selected,
  onSelect,
  onMove,
  onDrop,
  onVisible,
  onAdd,
  meterSwitchOn,
}: {
  doc: PageDoc;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  onMove: (type: BlockType, direction: "up" | "down") => void;
  onDrop: (type: BlockType, target: BlockType) => void;
  onVisible: (type: BlockType, visible: boolean) => void;
  onAdd: (type: "backdrop" | "pressureMeter") => void;
  // Whether the creator has the "Pressure meter" switch, which is what lets the meter be added.
  meterSwitchOn: boolean;
}) {
  const [dragging, setDragging] = useState<Block | null>(null);

  const pick = (key: Selection) =>
    `flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-field px-2 text-left text-sm transition-colors ${
      selected === key ? "bg-raised font-semibold text-text" : "text-muted hover:text-text"
    }`;

  return (
    <nav aria-label="Blocks on the page" className="space-y-4">
      <button type="button" onClick={() => onSelect("theme")} aria-current={selected === "theme" ? "true" : undefined} className={`${pick("theme")} w-full`}>
        <Palette aria-hidden="true" className="shrink-0" />
        Page colours
      </button>
      {!doc.blocks.some((b) => b.type === "backdrop") && (
        <button type="button" onClick={() => onAdd("backdrop")} className={`${pick("backdrop")} w-full`}>
          <ImageSquare aria-hidden="true" className="shrink-0" />
          Add a picture or video behind the page
        </button>
      )}
      {!doc.blocks.some((b) => b.type === "pressureMeter") &&
        (meterSwitchOn ? (
          <button type="button" onClick={() => onAdd("pressureMeter")} className={`${pick("pressureMeter")} w-full`}>
            <Gauge aria-hidden="true" className="shrink-0" />
            Add a Pressure meter
          </button>
        ) : (
          <p className="px-2 text-xs text-muted">To add a Pressure meter, switch on &ldquo;Pressure meter&rdquo; for this creator first (under Paid features).</p>
        ))}
      {SECTIONS.map(({ slot, label }) => {
        const blocks = doc.blocks.filter((b) => b.slot === slot);
        if (blocks.length === 0) return null;
        return (
          <section key={slot} aria-label={label} className="space-y-1">
            <h3 className="px-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</h3>
            <ul className="space-y-0.5">
              {blocks.map((block, i) => {
                const required = PROTECTED.includes(block.type);
                const name = BLOCK_LABELS[block.type];
                return (
                  <li
                    key={block.id}
                    draggable={blocks.length > 1}
                    onDragStart={(e) => {
                      setDragging(block);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", block.type);
                    }}
                    onDragOver={(e) => {
                      if (dragging && dragging.slot === block.slot) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging && dragging.slot === block.slot && dragging.type !== block.type) onDrop(dragging.type, block.type);
                      setDragging(null);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={`flex items-center gap-1 rounded-field ${dragging?.type === block.type ? "opacity-50" : ""} ${block.visible ? "" : "opacity-60"}`}
                  >
                    {blocks.length > 1 && <DotsSixVertical aria-hidden="true" className="shrink-0 cursor-grab text-control" />}
                    <button type="button" onClick={() => onSelect(block.type)} aria-current={selected === block.type ? "true" : undefined} className={pick(block.type)}>
                      <span className="truncate">{name}</span>
                      {required && <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[0.65rem] font-medium text-muted">Required</span>}
                      {!block.visible && <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[0.65rem] font-medium text-muted">Hidden</span>}
                    </button>
                    <button type="button" aria-label={`Move ${name} up`} aria-disabled={i === 0} onClick={() => i > 0 && onMove(block.type, "up")} className={iconButton}>
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`Move ${name} down`} aria-disabled={i === blocks.length - 1} onClick={() => i < blocks.length - 1 && onMove(block.type, "down")} className={iconButton}>
                      <ArrowDown aria-hidden="true" />
                    </button>
                    {required ? (
                      <span aria-hidden="true" className="size-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        aria-label={block.visible ? `Hide ${name}` : `Show ${name}`}
                        onClick={() => onVisible(block.type, !block.visible)}
                        className={iconButton}
                      >
                        {block.visible ? <Eye aria-hidden="true" /> : <EyeSlash aria-hidden="true" />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
