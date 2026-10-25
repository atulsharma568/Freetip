"use client";

import { useRef } from "react";

interface Step {
  number: string;
  title: string;
  text: string;
}

// The three text-to-speech safety steps. On hover a lime-tinted block glides
// between them. It is a pointer-only extra: the list reads the same without it.
export function SafetySteps({ steps }: { steps: readonly Step[] }) {
  const list = useRef<HTMLOListElement>(null);
  const block = useRef<HTMLDivElement>(null);

  function moveTo(item: HTMLElement | null) {
    const el = block.current;
    const parent = list.current;
    if (!el || !parent) return;
    if (!item) {
      el.style.opacity = "0";
      return;
    }
    const p = parent.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    el.style.width = `${r.width + 24}px`;
    el.style.height = `${r.height + 24}px`;
    el.style.transform = `translate(${r.left - p.left - 12}px, ${r.top - p.top - 12}px)`;
    el.style.opacity = "1";
  }

  return (
    <ol
      ref={list}
      aria-label="Text-to-speech safety steps"
      onPointerLeave={() => moveTo(null)}
      className="relative grid gap-8 md:col-span-7 md:grid-cols-3 md:gap-5"
    >
      <div ref={block} aria-hidden="true" className="step-highlight hidden md:block" />
      {steps.map((step) => (
        <li
          key={step.number}
          onPointerEnter={(e) => e.pointerType === "mouse" && moveTo(e.currentTarget)}
          className="relative border-t border-line pt-4"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink">
            {step.number}
          </span>
          <h4 className="mt-5 text-lg font-semibold">{step.title}</h4>
          <p className="mt-2 text-muted">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
