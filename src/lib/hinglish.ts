// Roman Hindi to Devanagari ("Hinglish" cleanup) so a Hindi voice reads
// "bhai kya mast stream hai" as "भाई क्या मस्त stream है" and not with an English
// accent. Pure, so it can be tested without a speech engine. The method is from the
// owner's AcePressure project (it reads the sentence instead of swapping every
// word); the word tables are in hinglish-words.ts and hinglish-verbs.ts.
//
// Four kinds of word:
//   always    Hindi wherever they appear in a tipping chat (bhai, kya, gaya).
//   weak      verb forms made from a stem (dekhta, khelenge, bataunga): converted
//             only inside a clause that is already Hindi because of other words, and
//             never what makes a message look Hindi. Protects English lines that
//             contain "mile" or "nacho".
//   short     short words that are also names, abbreviations or other languages
//             (ka, se, lo, hum): converted only inside a Hindi clause.
//   context   Hindi words that are also English words (main, mat, to, do):
//             converted inside a Hindi clause unless the words around them make
//             them English ("the main role", "Jett main", "mouse mat").
// A clause is the text between . , ! ? ; : or a danda. It is Hindi when its Hindi
// words outnumber its English grammar words (the, is, my...), or tie and include
// an always-Hindi word.
//
// Stretched spellings ("bakwaas", "yaarr", "kyaa") are matched by cutting doubled
// letters back until the word is one the tables know.

import {
  CONTEXT_WORDS,
  ENGLISH_AFTER,
  ENGLISH_BEFORE,
  ENGLISH_GRAMMAR,
  GAME_WORDS,
  KI_THAT_AFTER,
  MAIN_ENGLISH_NEXT,
  MAT_ENGLISH_BEFORE,
  NOT_VARIANTS,
  NEEDS_HINDI_NEIGHBOUR,
  POSSESSIVES,
  RAM_AFTER,
  RAM_BEFORE,
  SHORT_WORDS,
  THE_AFTER_ENDING,
  WEAK_EXTRA,
  WORDS,
} from "@/lib/hinglish-words";
import { buildVerbForms } from "@/lib/hinglish-verbs";

const DEVANAGARI = /[ऀ-ॿ]/;

// Maps, not plain objects: "constructor" or "toString" typed by a fan must not
// find an inherited property.
const CONTEXT = new Map(Object.entries(CONTEXT_WORDS));

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

// Never made as a respelling: the Roman spelling of rude words ("chhod" respelt to
// "chod" would turn a rude word into a polite one before the voice reads it).
const RUDE_ROOT = /^(chod|chud|gand|lund|bhos|randi)/;

function respelled(base: ReadonlyMap<string, string>, blocked: (variant: string) => boolean): Map<string, string> {
  const variants = new Map<string, string | null>(); // null = ambiguous, dropped
  for (const [word, value] of base) {
    if (word.length < 4) continue;
    for (const [from, to] of RESPELL) {
      const v = word.replace(from, to);
      if (v === word || v.length < 5 || blocked(v)) continue;
      if (variants.has(v)) {
        if (variants.get(v) !== value) variants.set(v, null);
        continue;
      }
      variants.set(v, value);
    }
  }
  const out = new Map<string, string>();
  for (const [v, value] of variants) if (value !== null) out.set(v, value);
  return out;
}

function buildLookup(): { strong: Map<string, string>; weak: Map<string, string> } {
  const exact = new Map(Object.entries(WORDS));
  const weakExact = new Map(
    Object.entries({ ...buildVerbForms(), ...WEAK_EXTRA }).filter(([k]) => !exact.has(k) && !CONTEXT.has(k) && !SHORT_WORDS.has(k)),
  );
  const blocked = (v: string) =>
    exact.has(v) || weakExact.has(v) || NOT_VARIANTS.has(v) || CONTEXT.has(v) || SHORT_WORDS.has(v) || RUDE_ROOT.test(v);
  const strongVariants = respelled(exact, blocked);
  const weakVariants = respelled(weakExact, (v) => blocked(v) || strongVariants.has(v));
  return {
    strong: new Map([...exact, ...strongVariants]),
    weak: new Map([...weakExact, ...weakVariants]),
  };
}

const LOOKUP = buildLookup();

// Stretched spellings people really type: a vowel held anywhere ("bakwaas", "kyaaa",
// "bhaii") or the last letter held ("yaarr", "bahutt"). A doubled consonant inside a
// word is an ordinary English spelling ("challenge", "happy"), so it is never cut.
const NOT_STRETCHED = new Set<string>(["boll", "bool", "dill", "tariff"]);

// Every way to cut stretched letters back, fewest cuts first: "yaarr" -> "yaar",
// "bakwaas" -> "bakwas", "kyaaa" -> "kya".
function cutBack(low: string): string[] {
  if (low.length > 20 || NOT_STRETCHED.has(low)) return [];
  const runs = low.match(/(.)\1*/g) ?? [];
  const canCut = (r: string, i: number) => r.length > 1 && (/[aeiou]/.test(r[0]) || i === runs.length - 1);
  const cuttable = runs.filter(canCut).length;
  if (cuttable === 0 || cuttable > 3) return [];
  const out: Array<{ word: string; cut: number }> = [];
  const walk = (i: number, acc: string, cut: number) => {
    if (i === runs.length) {
      if (cut > 0) out.push({ word: acc, cut });
      return;
    }
    const r = runs[i];
    const shortest = canCut(r, i) ? 1 : r.length;
    for (let len = r.length; len >= shortest; len--) walk(i + 1, acc + r[0].repeat(len), cut + r.length - len);
  };
  walk(0, "", 0);
  return out.sort((a, b) => a.cut - b.cut).map((o) => o.word);
}

interface Hit {
  dev: string;
  weak: boolean;
}

// The Devanagari for a Roman word that is Hindi everywhere or (weak) inside Hindi.
function resolve(low: string): Hit | undefined {
  const strong = LOOKUP.strong.get(low);
  if (strong) return { dev: strong, weak: false };
  const weak = LOOKUP.weak.get(low);
  if (weak) return { dev: weak, weak: true };
  if (CONTEXT.has(low) || ENGLISH_GRAMMAR.has(low)) return undefined;
  for (const c of cutBack(low)) {
    // A stretched spelling must land on a word that is Hindi in its own right, not a
    // short word or one that is also English.
    if (c.length < 3 || SHORT_WORDS.has(c) || CONTEXT.has(c) || ENGLISH_GRAMMAR.has(c)) continue;
    const s = LOOKUP.strong.get(c);
    if (s) return { dev: s, weak: false };
    const w = LOOKUP.weak.get(c);
    if (w) return { dev: w, weak: true };
  }
  return undefined;
}

type Kind = "dev" | "short" | "always" | "weak" | "context" | "english" | "other";
interface Tok {
  start: number;
  end: number;
  word: string;
  low: string;
  kind: Kind;
  dev?: string;
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
    const isShort = !DEVANAGARI.test(word[0]) && SHORT_WORDS.has(low);
    const hit = DEVANAGARI.test(word[0]) || isShort ? undefined : resolve(low);
    let kind: Kind;
    let dev: string | undefined;
    if (DEVANAGARI.test(word[0])) kind = "dev";
    else if (isShort) {
      kind = "short";
      dev = LOOKUP.strong.get(low);
    } else if (hit) {
      kind = hit.weak ? "weak" : "always";
      dev = hit.dev;
    } else if (CONTEXT.has(low)) {
      kind = "context";
      dev = CONTEXT.get(low);
    } else kind = ENGLISH_GRAMMAR.has(low) ? "english" : "other";
    const before = start ? text[start - 1] : " ";
    const after = end < text.length ? text[end] : " ";
    // Part of "lo-fi", "bhai's", @name, #tag, 2din or a web address: not a word on its own.
    const chunk = chunkAround(text, start, end);
    const attached =
      ATTACHED.has(before) || ATTACHED.has(after) || /\d/.test(before) || /\d/.test(after) || /\w\.\w/.test(chunk);
    toks.push({ start, end, word, low: ROMAN_OF.get(word) ?? low, kind, dev, clause, attached, hindi: false });
    last = end;
  }

  toks.forEach((t, i) => {
    const p = i > 0 && toks[i - 1].clause === t.clause ? toks[i - 1] : null;
    const n = i + 1 < toks.length && toks[i + 1].clause === t.clause ? toks[i + 1] : null;
    // "rahe the", "gaye the bhai": the is थे after a Hindi verb form, unless an English
    // word follows ("mujhe the best").
    if (
      t.kind === "english" &&
      t.low === "the" &&
      !t.attached &&
      p &&
      (p.kind === "always" || p.kind === "weak") &&
      p.dev &&
      THE_AFTER_ENDING.test(p.dev) &&
      (!n || n.kind === "always" || n.kind === "short" || n.kind === "weak" || n.kind === "dev")
    ) {
      t.kind = "weak";
      t.dev = "थे";
    }
    // "bola ki tera" says कि ("that"); "meri maa ki" says की ("of").
    if (t.low === "ki" && t.kind === "short" && i > 0 && KI_THAT_AFTER.has(toks[i - 1].low)) t.dev = "कि";
  });

  const clauses = new Map<number, { hindiWords: number; english: number; strong: number; letters: string[]; isHindi: boolean; shouting: boolean }>();
  for (const t of toks) {
    let c = clauses.get(t.clause);
    if (!c) {
      c = { hindiWords: 0, english: 0, strong: 0, letters: [], isHindi: false, shouting: false };
      clauses.set(t.clause, c);
    }
    // Weak words are not evidence: a clause is Hindi because of the other words.
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
    } else if (t.kind === "weak") {
      t.hindi = c.isHindi && !(isUpper(t.word) && !c.shouting);
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
    if (t.hindi && t.kind !== "dev" && t.dev) {
      out += text.slice(pos, t.start) + t.dev;
      pos = t.end;
    }
  }
  return out + text.slice(pos);
}

// How Hindi a message looks, 0 to 1. At 0.15 or more it has meaningful Hindi in it.
// Short words (ka, se, lo) count only beside an always-Hindi word or each other,
// so "lo and behold" stays English. Weak (made verb) forms do not count.
export function hinglishScore(text: string): number {
  if (!text) return 0;
  if (DEVANAGARI.test(text)) return 1;
  const tokens = text.toLowerCase().match(/\b[a-z]{2,20}\b/g) ?? [];
  if (!tokens.length) return 0;
  let strong = 0;
  let short = 0;
  for (const t of tokens) {
    if (SHORT_WORDS.has(t)) {
      short++;
      continue;
    }
    const hit = resolve(t);
    if (hit && !hit.weak) strong++;
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

// Roman words in a Hindi-looking message that the tables do not know: either Hindi
// words to add to the dictionary or English words that are fine as they are. The
// owner reads them in /admin/tts-words. Only words, never the message, are kept.
export function unknownHinglishWords(text: string): string[] {
  if (!text || !isHinglish(text)) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(TOKEN)) {
    const word = m[0];
    if (DEVANAGARI.test(word[0])) continue;
    const start = m.index!;
    const end = start + word.length;
    const before = start ? text[start - 1] : " ";
    const after = end < text.length ? text[end] : " ";
    if (ATTACHED.has(before) || ATTACHED.has(after) || /\d/.test(before + after)) continue;
    const low = word.toLowerCase();
    if (low.length < 3 || low.length > 20) continue;
    if (SHORT_WORDS.has(low) || CONTEXT.has(low) || ENGLISH_GRAMMAR.has(low) || resolve(low)) continue;
    found.add(low);
    if (found.size >= 20) break;
  }
  return [...found];
}

// For tests and tuning: every spelling the converter knows, by kind.
export function knownSpellings(): ReadonlyMap<string, string> {
  return LOOKUP.strong;
}

export function knownWeakSpellings(): ReadonlyMap<string, string> {
  return LOOKUP.weak;
}
