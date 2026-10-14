import type { CSSProperties } from "react";

// A button label that rolls up letter by letter when its link or button is
// hovered or keyboard-focused (see `.roll` in globals.css). Each letter
// carries a copy of itself underneath, so the label lands on the same text.
// Screen readers get the plain label; the letters are hidden from them.
export function RollText({ children }: { children: string }) {
  return (
    <>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="roll">
        {[...children].map((char, i) => (
          <span key={i} data-char={char} style={{ "--i": i } as CSSProperties}>
            {char}
          </span>
        ))}
      </span>
    </>
  );
}
