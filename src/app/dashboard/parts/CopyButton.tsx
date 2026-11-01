"use client";

import { useEffect, useRef, useState } from "react";
import ClickSpark, { type ClickSparkHandle } from "@/components/react-bits/ClickSpark";
import { RollText } from "@/components/motion/RollText";
import { INK_HEX } from "@/lib/site";

const LIME = "#bfe84a";

// A pill that copies `value`, sparks once and says "Copied" for a moment (the
// words rise into place; a hidden live region says it too). The sparks are
// lime on dark and Field Ink on a lime field. Reduced motion shortens the
// sparks and the rise is switched off in globals.css.
export function CopyButton({
  value,
  label,
  className,
  onLime = false,
  wrap = "inline-flex shrink-0",
}: {
  value: string;
  label: string;
  className: string;
  onLime?: boolean;
  // Classes for the element around the button, when it must stretch.
  wrap?: string;
}) {
  const spark = useRef<ClickSparkHandle>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      spark.current?.spark();
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <span className={wrap}>
      <ClickSpark
        ref={spark}
        manual
        sparkColor={onLime ? INK_HEX : LIME}
        sparkCount={10}
        sparkRadius={36}
        sparkSize={10}
        sparkWidth={2.5}
        duration={650}
      >
        <button type="button" onClick={copy} className={`overflow-hidden ${className}`}>
          {state === "copied" ? (
            <span key="copied" className="rise inline-block">
              Copied
            </span>
          ) : state === "failed" ? (
            <span key="failed">Copy by hand</span>
          ) : (
            <RollText>{label}</RollText>
          )}
        </button>
      </ClickSpark>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied to the clipboard" : state === "failed" ? "Could not copy. Select the text and copy it by hand." : ""}
      </span>
    </span>
  );
}
