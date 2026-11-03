"use client";

import { useState } from "react";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { BLOCK_LABELS, PROTECTED } from "@/lib/page-doc/blocks";
import { resetBlock, setChoice, setLadder, setText, setTheme, type EditResult, type ThemeResult } from "@/lib/page-doc/edit";
import { CHOICE_FIELDS, textFieldsFor } from "@/lib/page-doc/fields";
import type { Block, BlockType, PageDoc } from "@/lib/page-doc/types";
import type { Selection } from "./BlockList";
import { ColourEditor } from "./ColourEditor";
import { LadderEditor } from "./LadderEditor";

const ABOUT: Record<BlockType, string> = {
  backdrop: "The smoke, slashes and embers behind the whole page. Use the eye in the list to turn it off.",
  header: "The creator's photo, banner, name and bio. They come from the creator's account, so there is nothing to word here. This block has to stay on the page.",
  creatorLinks: "A line of words and an Instagram link under the header. Leave both empty to show nothing.",
  alertPreview: "The alert as it will look on stream, drawn from what the fan types.",
  qr: "The QR code to this page, shown on a laptop. Nothing to edit.",
  amount: "The amount boxes, with the rank bar. The smallest tip and the amounts offered are fixed. This block has to stay on the page.",
  note: "The name, the message and the extras. The message limit and the anonymous option are fixed. This block has to stay on the page.",
  send: "The Pay button. What it does, and the amount it shows, are fixed. This block has to stay on the page.",
  strip: "A line of small text under the form.",
  successScreen: "What a fan sees after a tip. It is not part of the preview.",
};

// The settings of the picked block, drawn from the field table, or the page colours. A change that
// the document would not keep (too long, a handle with a slash) is refused here and says why.
export function BlockSettings({
  doc,
  selected,
  run,
}: {
  doc: PageDoc;
  selected: Selection;
  run: <R extends EditResult>(change: (doc: PageDoc) => R) => R;
}) {
  const [problem, setProblem] = useState<{ key: string; message: string } | null>(null);

  if (selected === "theme") {
    return (
      <section aria-labelledby="settings-title" className="space-y-4">
        <h2 id="settings-title" className="text-sm font-semibold text-text">
          Page colours
        </h2>
        <ColourEditor theme={doc.theme} onChange={(accent, ink) => run((d): ThemeResult => setTheme(d, accent, ink))} />
      </section>
    );
  }

  const block = doc.blocks.find((b) => b.type === selected);
  if (!block) {
    return <p className="text-sm text-muted">This block is not on the page.</p>;
  }
  const settings = block.settings as Record<string, unknown>;
  const fields = textFieldsFor(block.type, block.settings as never);
  const choices = CHOICE_FIELDS[block.type];
  const nothing = fields.length === 0 && choices.length === 0 && block.type !== "amount";

  return (
    <section aria-labelledby="settings-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="settings-title" className="text-sm font-semibold text-text">
          {BLOCK_LABELS[block.type]}
          {PROTECTED.includes(block.type) && <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-[0.65rem] font-medium text-muted">Required</span>}
        </h2>
        <p className="text-xs text-muted">{ABOUT[block.type]}</p>
      </div>

      {choices.map((c) => (
        <label key={c.key} className="block space-y-1 text-xs text-muted">
          {c.label}
          <select
            value={String(settings[c.key])}
            onChange={(e) => run((d) => setChoice(d, block.type, c.key, e.target.value))}
            className={`${FIELD_CLASS} block w-full`}
          >
            {c.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {fields.map((f) => {
        const value = String(settings[f.key] ?? "");
        const id = `field-${block.type}-${f.key}`;
        const mine = problem?.key === id ? problem.message : null;
        return (
          <div key={f.key} className="space-y-1">
            <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-xs text-muted">
              <span>{f.label}</span>
              <span className="numeric">
                {Array.from(value).length}/{f.max}
              </span>
            </label>
            <div className="flex items-center gap-1">
              {f.prefix && <span aria-hidden="true" className="text-sm text-muted">{f.prefix}</span>}
              <input
                id={id}
                value={value}
                maxLength={f.max}
                placeholder={f.standard || undefined}
                spellCheck={false}
                aria-invalid={mine ? true : undefined}
                aria-describedby={`${id}-hint`}
                onChange={(e) => {
                  const r = run((d) => setText(d, block.type, f.key, e.target.value));
                  setProblem(r.problems.length ? { key: id, message: r.problems[0] } : null);
                }}
                className={`${FIELD_CLASS} block w-full [overflow-wrap:anywhere]`}
              />
            </div>
            <p id={`${id}-hint`} className={`text-xs ${mine ? "text-warn" : "text-muted"}`}>
              {mine ? (
                <>
                  <span aria-hidden="true">● </span>
                  {mine}
                </>
              ) : f.standard ? (
                <>Left empty it says &ldquo;{f.standard}&rdquo;.</>
              ) : (
                <>Left empty it shows nothing.</>
              )}
            </p>
          </div>
        );
      })}

      {block.type === "amount" && (
        <LadderEditor ladder={(block as Block<"amount">).settings.ladder} onChange={(ladder) => run((d) => setLadder(d, ladder))} />
      )}

      {nothing && <p className="text-xs text-muted">There is nothing to edit in this block.</p>}

      {(fields.length > 0 || choices.length > 0 || block.type === "amount") && (
        <button type="button" onClick={() => run((d) => resetBlock(d, block.type))} className={buttonClass("quiet", "sm")}>
          Put this block&apos;s words back to standard
        </button>
      )}
    </section>
  );
}
