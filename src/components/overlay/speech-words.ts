// When each word of a message is spoken, for the alert's word-by-word highlight.
// The speech clip's length is known; the words share it by weight (longer words and
// the pause after punctuation take more time). Pure, so it can be tested.

export interface WordTiming {
  word: string;
  startMs: number;
  durMs: number;
}

const MIN_WORD_MS = 120;

export function wordTimings(message: string, speechMs: number, leadMs = 0): WordTiming[] {
  const words = message.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w) => {
    const letters = w.replace(/[^\p{L}\p{N}]/gu, "").length || 1;
    const pause = /[.!?…।]$/.test(w) ? 4 : /[,;:]$/.test(w) ? 2 : 0;
    return letters + pause;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let at = 0;
  return words.map((word, i) => {
    const share = (weights[i] / total) * speechMs;
    const timing = {
      word,
      startMs: Math.round(leadMs + at),
      durMs: Math.max(MIN_WORD_MS, Math.round(share)),
    };
    at += share;
    return timing;
  });
}
