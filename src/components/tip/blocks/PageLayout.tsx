"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Block, PageDoc, Slot } from "@/lib/page-doc/types";
import { useTipForm } from "@/components/tip/TipFormContext";
import { AlertPreviewBlock } from "./AlertPreviewBlock";
import { AmountBlock } from "./AmountBlock";
import { CreatorLinksBlock } from "./CreatorLinksBlock";
import { HeaderBlock } from "./HeaderBlock";
import { NoteBlock } from "./NoteBlock";
import { QrBlock } from "./QrBlock";
import { SendBlock } from "./SendBlock";
import { StripBlock } from "./StripBlock";

const step = (i: number) => ({ "--i": i }) as CSSProperties;

// Places the blocks of a page document: the side column (on top on a phone), the form card, and
// whatever sits under the card. Each section keeps the wrappers it had before the page was
// drawn from blocks, so the DOM order, the tab order and the entrance order are the same.
export function PageLayout({ doc }: { doc: PageDoc }) {
  const { announce } = useTipForm();
  const inSlot = (slot: Slot) => doc.blocks.filter((b) => b.slot === slot && b.visible);
  const side = inSlot("side");
  const main = inSlot("main");
  const bottom = inSlot("bottom");
  const preview = side.find((b): b is Block<"alertPreview"> => b.type === "alertPreview");

  const sideNodes: ReactNode[] = [];
  for (let i = 0; i < side.length; i++) {
    const block = side[i];
    switch (block.type) {
      case "header": {
        // The links sit in the header's own wrapper when they come straight after it.
        const next = side[i + 1];
        const links = next?.type === "creatorLinks" ? next : null;
        if (links) i++;
        sideNodes.push(
          <div key={block.id} className="enter space-y-5" style={step(0)}>
            <HeaderBlock />
            {links && <CreatorLinksBlock block={links} />}
          </div>,
        );
        break;
      }
      case "creatorLinks":
        sideNodes.push(
          <div key={block.id} className="enter space-y-5" style={step(0)}>
            <CreatorLinksBlock block={block} />
          </div>,
        );
        break;
      case "alertPreview":
        sideNodes.push(
          <section key={block.id} className="enter hidden space-y-3 lg:block" style={step(2)} aria-label="Alert preview">
            <AlertPreviewBlock />
          </section>,
        );
        break;
      case "qr":
        sideNodes.push(
          <div key={block.id} className="enter hidden lg:block" style={step(3)}>
            <QrBlock />
          </div>,
        );
        break;
    }
  }

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-14">
        {/* Left on wide screens (sticky), above the form on phones */}
        <div className="contents lg:sticky lg:top-24 lg:block lg:space-y-8">{sideNodes}</div>

        {/* The tip */}
        <div
          className="enter space-y-8 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5 sm:p-8"
          style={step(1)}
        >
          <p role="status" className="sr-only">
            {announce}
          </p>
          {main.map((block) => {
            switch (block.type) {
              case "amount":
                return (
                  <Fragment key={block.id}>
                    <AmountBlock block={block} />
                    {/* The alert as it will look, between the amount and the note on phones */}
                    {preview && (
                      <section className="space-y-3 lg:hidden" aria-label="Alert preview">
                        <AlertPreviewBlock />
                      </section>
                    )}
                  </Fragment>
                );
              case "note":
                return <NoteBlock key={block.id} />;
              case "send":
                return <SendBlock key={block.id} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
      {bottom.map((block) => (block.type === "strip" ? <StripBlock key={block.id} block={block} /> : null))}
    </>
  );
}
