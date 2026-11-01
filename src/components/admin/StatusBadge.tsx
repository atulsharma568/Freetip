import { TONE_BADGE, TONE_MARK, toneOf } from "./tones";

export function StatusBadge({ status }: { status: string }) {
  const tone = toneOf(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}
    >
      {TONE_MARK[tone] && <span aria-hidden="true">{TONE_MARK[tone]}</span>}
      {status.replace(/_/g, " ")}
    </span>
  );
}
