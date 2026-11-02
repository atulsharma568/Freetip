import { formatINR } from "@/lib/admin/result";
import { TONE_MARK, TONE_TEXT } from "./tones";

// A negative balance keeps its minus sign and is never rounded up. Colour is not
// the only signal: a mark precedes the amount (hidden from screen readers, the
// minus sign already says it).
export function Signed({ minor }: { minor: number }) {
  if (minor >= 0) return <span>{formatINR(minor)}</span>;
  return (
    <span className={TONE_TEXT.bad}>
      <span aria-hidden="true">{TONE_MARK.bad} </span>
      {formatINR(minor)}
    </span>
  );
}
