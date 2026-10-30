// Roman Hindi to Devanagari ("Hinglish" cleanup) so a Hindi voice reads
// "bhai kya mast stream hai" as "भाई क्या मस्त stream है" and not with an English
// accent. Pure, so it can be tested without a speech engine. The method is from the
// owner's AcePressure project (it reads the sentence instead of swapping every
// word); the word tables are in hinglish-words.ts.
//
// Three kinds of word:
//   always    Hindi wherever they appear in a tipping chat (bhai, kya, gaya).
//   short     short words that are also names, abbreviations or other languages
//             (ka, se, lo, hum): converted only inside a Hindi clause.
//   context   Hindi words that are also English words (main, mat, to, do):
//             converted inside a Hindi clause unless the words around them make
//             them English ("the main role", "Jett main", "mouse mat").
// A clause is the text between . , ! ? ; : or a danda. It is Hindi when its Hindi
// words outnumber its English grammar words (the, is, my...), or tie and include
// an always-Hindi word.

import {
  CONTEXT_WORDS,
  ENGLISH_AFTER,
  ENGLISH_BEFORE,
  ENGLISH_GRAMMAR,
  GAME_WORDS,
  MAIN_ENGLISH_NEXT,
  MAT_ENGLISH_BEFORE,
  NOT_VARIANTS,
  NEEDS_HINDI_NEIGHBOUR,
  POSSESSIVES,
  RAM_AFTER,
  RAM_BEFORE,
  SHORT_WORDS,
  WORDS,
} from "@/lib/hinglish-words";

const DEVANAGARI = /[ऀ-ॿ]/;

// Spelling variants. Hindi has no fixed Roman spelling ("achha", "accha", "acha";
// "nahi", "nahii", "nahee"), so each long word also matches its common respellings.
// Only words of 4+ letters are varied into respellings of 5+ letters, and a variant never replaces a listed word or
// matches two different words, so a short English word is never caught by it.
const RESPELL: Array<[RegExp, string]> = [
  [/aa/g, "a"],
  [/ee/g, "i"],
  [/ii/g, "i"],
  [/oo/g, "u"],
  [/w/g, "v"],
  [/v/g, "w"],
  [/z/g, "j"],
  [/j/g, "z"],
  [/chh/g, "ch"],
  [/i$/, "ee"],
  [/i$/, "ii"],
  [/a$/, "aa"],
];

function buildLookup(): Map<string, string> {
  const exact = new Map(Object.entries(WORDS));
  const variants = new Map<string, string | null>(); // null = ambiguous, dropped
  let layer = [...exact.keys()].filter((k) => k.length >= 4);
  for (let depth = 0; depth < 1; depth++) {
    const next: string[] = [];
    for (const word of layer) {
      const value = exact.get(word) ?? (variants.get(word) as string);
      for (const [from, to] of RESPELL) {
        const v = word.replace(from, to);
        if (v === word || v.length < 5 || exact.has(v) || NOT_VARIANTS.has(v) || CONTEXT_WORDS[v] || SHORT_WORDS.has(v)) continue;
        if (variants.has(v)) {
          if (variants.get(v) !== value) variants.set(v, null);
          continue;
        }
        variants.set(v, value);
        next.push(v);
      }
    }
    layer = next;
  }
  for (const [v, value] of variants) if (value !== null) exact.set(v, value);
  return exact;
}

const LOOKUP = buildLookup();

type Kind = "dev" | "short" | "always" | "context" | "english" | "other";
interface Tok {
  start: number;
  end: number;
  word: string;
  low: string;
  kind: Kind;
  clause: number;
  attached: boolean;
  hindi: boolean;
}

const TOKEN = /[A-Za-z]+|[ऀ-ॣ०-ॿ]+/g;
const CLAUSE_BREAK = /[.!?;:,\n।॥]|\s[-–—]\s/;
const ATTACHED = new Set(["-", "'", "’", "_", "/", "@", "#"]);

// "मेरा main" is as possessive as "mera main": map Devanagari back to Roman.
const ROMAN_OF = new Map<string, string>();
for (const [roman, dev] of [...Object.entries(WORDS), ...Object.entries(CONTEXT_WORDS)]) {
  if (!ROMAN_OF.has(dev)) ROMAN_OF.set(dev, roman);
}

function chunkAround(text: string, start: number, end: number): string {
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;
  return text.slice(start, end);
}

function isUpper(w: string): boolean {
  return w === w.toUpperCase() && w !== w.toLowerCase();
}

// Converts Roman Hindi words to Devanagari, clause by clause. Everything else is
// left as typed.
export function transliterateHinglish(text: string): string {
  if (!text) return text;
  const toks: Tok[] = [];
  let clause = 0;
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index!;
    const word = m[0];
    const end = start + word.length;
    if (toks.length && CLAUSE_BREAK.test(text.slice(last, start))) clause++;
    const low = word.toLowerCase();
    const kind: Kind = DEVANAGARI.test(word[0])
      ? "dev"
      : SHORT_WORDS.has(low)
        ? "short"
        : LOOKUP.has(low)
          ? "always"
          : low in CONTEXT_WORDS
            ? "context"
            : ENGLISH_GRAMMAR.has(low)
              ? "english"
              : "other";
    const before = start ? text[start - 1] : " ";
    const after = end < text.length ? text[end] : " ";
    // Part of "lo-fi", "bhai's", @name, #tag, 2din or a web address: not a word on its own.
    const chunk = chunkAround(text, start, end);
    const attached =
      ATTACHED.has(before) || ATTACHED.has(after) || /\d/.test(before) || /\d/.test(after) || /\w\.\w/.test(chunk);
    toks.push({ start, end, word, low: ROMAN_OF.get(word) ?? low, kind, clause, attached, hindi: false });
    last = end;
  }

  const clauses = new Map<number, { hindiWords: number; english: number; strong: number; letters: string[]; isHindi: boolean; shouting: boolean }>();
  for (const t of toks) {
    let c = clauses.get(t.clause);
    if (!c) {
      c = { hindiWords: 0, english: 0, strong: 0, letters: [], isHindi: false, shouting: false };
      clauses.set(t.clause, c);
    }
    if (t.kind === "dev" || t.kind === "always" || t.kind === "short") c.hindiWords++;
    if (t.kind === "dev" || t.kind === "always") c.strong++;
    if (t.kind === "english") c.english++;
    if (t.kind !== "dev" && t.word.length > 1) c.letters.push(t.word);
  }
  for (const c of clauses.values()) {
    c.isHindi = c.hindiWords > c.english || (c.hindiWords === c.english && c.strong > 0);
    c.shouting = c.letters.length > 0 && c.letters.every(isUpper); // "BHAI MAIN AA GAYA"
  }

  for (const t of toks) {
    const c = clauses.get(t.clause)!;
    if (t.attached || t.kind === "dev") t.hindi = t.kind === "dev";
    else if (t.kind === "always") t.hindi = true;
    else if (t.kind === "short") {
      t.hindi = c.isHindi && !(t.word.length === 2 && isUpper(t.word) && !c.shouting);
    }
  }

  const neighbour = (i: number, step: number): Tok | null => {
    const j = i + step;
    return j >= 0 && j < toks.length && toks[j].clause === toks[i].clause ? toks[j] : null;
  };

  const contextIsHindi = (i: number): boolean => {
    const t = toks[i];
    const c = clauses.get(t.clause)!;
    // NA, RAM, KO, DO: an acronym inside lower-case text.
    if (t.attached || !c.isHindi || (t.word.length > 1 && isUpper(t.word) && !c.shouting)) return false;
    const p = neighbour(i, -1);
    const n = neighbour(i, 1);
    const pl = p?.low ?? "";
    const nl = n?.low ?? "";
    if (t.low === "ram") return RAM_BEFORE.has(pl) || RAM_AFTER.has(nl); // "jai shri ram", never "16gb ram"
    if (ENGLISH_BEFORE.has(pl) || ENGLISH_AFTER.has(nl)) return false;
    if (t.low === "main" && (POSSESSIVES.has(pl) || GAME_WORDS.has(pl) || MAIN_ENGLISH_NEXT.has(nl))) return false;
    if (t.low === "mat" && MAT_ENGLISH_BEFORE.has(pl)) return false;
    if (NEEDS_HINDI_NEIGHBOUR.has(t.low)) return !!(p?.hindi || n?.hindi);
    return true;
  };

  for (let pass = 0; pass < 2; pass++) {
    // A second pass lets "main to gaya" convert "main" once "to" has.
    toks.forEach((t, i) => {
      if (t.kind === "context" && !t.hindi && contextIsHindi(i)) t.hindi = true;
    });
  }

  let out = "";
  let pos = 0;
  for (const t of toks) {
    if (t.hindi && t.kind !== "dev") {
      const low = t.word.toLowerCase();
      out += text.slice(pos, t.start) + (LOOKUP.get(low) ?? CONTEXT_WORDS[low]);
      pos = t.end;
    }
  }
  return out + text.slice(pos);
}

// How Hindi a message looks, 0 to 1. At 0.15 or more it has meaningful Hindi in it.
// Short words (ka, se, lo) count only beside an always-Hindi word or each other,
// so "lo and behold" stays English.
export function hinglishScore(text: string): number {
  if (!text) return 0;
  if (DEVANAGARI.test(text)) return 1;
  const tokens = text.toLowerCase().match(/\b[a-z]{2,20}\b/g) ?? [];
  if (!tokens.length) return 0;
  let strong = 0;
  let short = 0;
  for (const t of tokens) {
    if (SHORT_WORDS.has(t)) short++;
    else if (LOOKUP.has(t)) strong++;
  }
  return (strong + (strong || short >= 2 ? short : 0)) / tokens.length;
}

export function isHinglish(text: string): boolean {
  return hinglishScore(text) >= 0.15;
}

// What a Hindi-capable voice should read, and whether the message is Hindi at all.
// English-only messages come back untouched.
export function hindiSpeech(text: string): { text: string; hindi: boolean } {
  if (!isHinglish(text)) return { text, hindi: false };
  return { text: transliterateHinglish(text), hindi: true };
}

// For tests and tuning: every spelling the converter knows.
export function knownSpellings(): ReadonlyMap<string, string> {
  return LOOKUP;
}
