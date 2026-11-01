"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pillOutline, pillText } from "./styles";

// A button that, when it would undo something, asks once in place instead of
// opening a browser dialog (the same two steps as Close my account). Press the
// button, read the question, then confirm or keep things as they are. When
// `ask` is false the first press goes straight through.
export function ConfirmAction({
  ask = true,
  prompt,
  confirmLabel,
  keepLabel = "Keep it",
  onConfirm,
  disabled,
  className,
  children,
}: {
  ask?: boolean;
  prompt: string;
  confirmLabel: string;
  keepLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
  children: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  // Move focus to the answer when the question opens, and back to the button when it closes.
  useEffect(() => {
    if (asking) confirm.current?.focus();
    else if (wasAsking.current) trigger.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => (ask ? setAsking(true) : onConfirm())}
      >
        {children}
      </button>
    );
  }

  return (
    <div role="group" aria-label={prompt} className="flex flex-wrap items-center gap-2">
      <p className="w-full text-sm text-text">{prompt}</p>
      <button
        ref={confirm}
        type="button"
        className={pillOutline}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className={pillText} onClick={() => setAsking(false)}>
        {keepLabel}
      </button>
    </div>
  );
}
