// Message cleanup and the word filter. Pure, so it can be tested without a
// database or a speech engine.
//
// Two jobs:
//   - cleanForSpeech: tidy a fan's message so the voice reads it sensibly
//     (no links, emoji, symbol noise or letter floods).
//   - findBlockedWord: refuse a message or name that holds a word from our
//     built-in profanity list or the creator's own banned words.
//
// Words are matched as whole words after the text is normalised (case, accents,
// look-alike digits and symbols, repeated letters, spaced-out letters), so
// "f u c k" and "fuuuck" are caught but "class" and "peacock" are not.

// Built-in list: common English and Roman-script Hindi abuse, plus a few in
// Devanagari. Whole words only, so keep entries unambiguous. The creator's own
// list covers anything else. Stored as written; normalised once below.
const PROFANITY = [
  // English
  "fuck", "fucker", "motherfucker", "fucking", "shit", "bitch", "bastard", "asshole",
  "dickhead", "cunt", "whore", "slut", "pussy", "nigger", "nigga", "faggot", "retard",
  // Roman Hindi
  "madarchod", "maderchod", "behenchod", "bhenchod", "benchod", "bhosdike", "bhosdi",
  "bhosda", "chutiya", "chutiye", "chutia", "gandu", "gaandu", "gand", "gaand", "harami",
  "haramzada", "haramkhor", "randi", "raand", "lund", "loda", "lauda", "bhadwa", "bhadwe",
  // Devanagari
  "मादरचोद", "बहनचोद", "भोसड़ीके", "चूतिया", "चुतिया", "गांडू", "हरामी", "हरामखोर", "रंडी",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

// Endings a fan may add to a listed word ("fucked", "bitches", "randiyan").
const SUFFIXES = ["", "s", "es", "ed", "er", "ers", "ing", "in", "y", "ya", "yan", "wale", "wala"];

export const MAX_BANNED_WORDS = 100;
export const MAX_BANNED_WORD_CHARS = 30;
export const MAX_BANNED_LIST_CHARS = 2000;

function squashRepeats(s: string): string {
  return s.replace(/(\p{L})\1+/gu, "$1");
}

// Lower-cased words, with look-alike digits and symbols turned into letters only
// inside a word that already holds a letter (so a plain "100" or "!!!" is left
// alone) and letters spaced out one by one joined up.
function tokensOf(text: string): string[] {
  let t = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // "f u c k", "f.u.c.k" -> "fuck".
  t = t.replace(/(?<![\p{L}\p{N}])(?:\p{L}[\s._*-]){2,}\p{L}(?![\p{L}\p{N}])/gu, (m) =>
    m.replace(/[\s._*-]/g, ""),
  );

  return t
    .split(/[^\p{L}\p{M}\p{N}@$!]+/u)
    .map((tok) => tok.replace(/^[@$!]+|[@$!]+$/g, ""))
    .map((tok) => (/\p{L}/u.test(tok) ? tok.replace(/[013457@$!]/g, (c) => LEET[c] ?? c) : tok))
    .filter(Boolean);
}

export function normalizeForMatch(text: string): string {
  return tokensOf(text).join(" ");
}

const BUILT_IN = PROFANITY.map(normalizeForMatch);

function hits(haystack: string, word: string): boolean {
  if (!word) return false;
  return SUFFIXES.some((end) => haystack.includes(` ${word}${end} `));
}

// The first blocked word found, or null. `custom` is the creator's list. A word
// stretched out ("fuuuuck") is also caught, but only when it holds a run of three
// or more of the same letter, so a real word with a double letter is not squashed
// into another ("Niger" is not a slur).
export function findBlockedWord(text: string | null | undefined, custom: readonly string[] = []): string | null {
  if (!text) return null;
  const tokens = tokensOf(text);
  const plain = ` ${tokens.join(" ")} `;
  // Only the stretched words, squashed: a word that was not stretched never
  // matches through its squashed form.
  const stretched = ` ${tokens
    .filter((t) => /(\p{L})\1\1/u.test(t))
    .map(squashRepeats)
    .join(" ")} `;
  for (const word of [...BUILT_IN, ...custom.map(normalizeForMatch)]) {
    if (hits(plain, word) || hits(stretched, squashRepeats(word))) return word;
  }
  return null;
}

// The creator's words, from the settings box: separated by commas or new lines,
// trimmed, de-duplicated, with silly lengths dropped.
export function parseBannedWords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.slice(0, MAX_BANNED_LIST_CHARS).split(/[,\n]/)) {
    const word = part.replace(/\s+/g, " ").trim().toLowerCase();
    if (word.length < 2 || word.length > MAX_BANNED_WORD_CHARS || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= MAX_BANNED_WORDS) break;
  }
  return out;
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_PATTERN = /\S+@\S+\.\S+/g;
// Control characters (and the zero-width ones used to hide text).
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff]/g;
// Emoji and pictographs, their joiners, skin tones and variation selectors: the
// ones nameEmoji does not know are skipped.
const EMOJI = /[\p{Extended_Pictographic}\u{1f3fb}-\u{1f3ff}\u{fe0e}\u{fe0f}\u{20e3}\u{e0020}-\u{e007f}]/gu;
// One emoji with its skin tone, variation selector and joined parts (a family or
// a flag-like sequence is one symbol, so it is named once).
const MARKS = "[\\u{1f3fb}-\\u{1f3ff}\\u{fe0e}\\u{fe0f}\\u{20e3}]*";
const EMOJI_CLUSTER = new RegExp(
  `\\p{Extended_Pictographic}${MARKS}(?:\\u200d\\p{Extended_Pictographic}${MARKS})*`,
  "gu",
);
const DEVANAGARI = /[ऀ-ॿ]/;

// What the voice says for the common emoji: [English, Hindi]. Anything not listed
// is skipped, as before. Only the first symbol of a joined sequence is looked up.
const EMOJI_NAMES: Record<string, [string, string]> = {
  "😀": ["smile", "मुस्कान"], "😃": ["smile", "मुस्कान"], "😄": ["smile", "मुस्कान"], "😁": ["grin", "मुस्कान"],
  "😊": ["smile", "मुस्कान"], "🙂": ["smile", "मुस्कान"], "😆": ["laughing", "हँसी"], "😂": ["laughing", "हँसी"],
  "🤣": ["laughing", "हँसी"], "😅": ["nervous laugh", "हँसी"], "😍": ["heart eyes", "दिल वाली आँखें"],
  "🥰": ["love", "प्यार"], "😘": ["kiss", "किस"], "😎": ["cool", "कूल"], "🤩": ["wow", "वाह"],
  "😮": ["wow", "वाह"], "😲": ["wow", "वाह"], "🤯": ["mind blown", "दिमाग उड़ गया"], "😢": ["crying", "रोना"],
  "😭": ["crying", "रोना"], "😡": ["angry", "गुस्सा"], "🤬": ["angry", "गुस्सा"], "😴": ["sleepy", "नींद"],
  "🤔": ["thinking", "सोच"], "🙏": ["thank you", "धन्यवाद"], "👍": ["thumbs up", "बढ़िया"], "👎": ["thumbs down", "थम्स डाउन"],
  "👏": ["clap", "तालियाँ"], "🙌": ["hooray", "वाह"], "💪": ["strong", "ताकत"], "👌": ["perfect", "बढ़िया"],
  "✌": ["peace", "शांति"], "🤝": ["deal", "हाथ मिलाओ"], "👋": ["wave", "हाय"], "❤": ["heart", "दिल"],
  "💖": ["heart", "दिल"], "💕": ["heart", "दिल"], "💗": ["heart", "दिल"], "💙": ["heart", "दिल"],
  "💚": ["heart", "दिल"], "💛": ["heart", "दिल"], "💜": ["heart", "दिल"], "🧡": ["heart", "दिल"],
  "🖤": ["black heart", "काला दिल"], "💔": ["broken heart", "टूटा दिल"], "🔥": ["fire", "आग"], "💯": ["hundred", "सौ"],
  "⭐": ["star", "तारा"], "🌟": ["star", "तारा"], "✨": ["sparkles", "चमक"], "🎉": ["party", "पार्टी"],
  "🎊": ["party", "पार्टी"], "🎂": ["cake", "केक"], "🎁": ["gift", "तोहफा"], "🏆": ["trophy", "ट्रॉफी"],
  "👑": ["crown", "ताज"], "💰": ["money", "पैसे"], "💸": ["money", "पैसे"], "🎮": ["gaming", "गेमिंग"],
  "🎧": ["headphones", "हेडफ़ोन"], "🎵": ["music", "संगीत"], "🎶": ["music", "संगीत"], "🚀": ["rocket", "रॉकेट"],
  "👀": ["eyes", "आँखें"], "💀": ["skull", "खोपड़ी"], "🤡": ["clown", "जोकर"], "😈": ["devil", "शैतान"],
  "🐐": ["goat", "बकरी"], "☕": ["coffee", "कॉफ़ी"], "🍕": ["pizza", "पिज़्ज़ा"], "🍺": ["beer", "बियर"],
};
// Naming every emoji of a long run would hold up the stream.
const MAX_SPOKEN_EMOJI = 3;

// Swaps the common emoji for their spoken name (Hindi when the message has
// Devanagari), once per consecutive repeat and at most MAX_SPOKEN_EMOJI times.
function nameEmoji(message: string): string {
  const hindi = DEVANAGARI.test(message);
  let spoken = 0;
  let last = "";
  return message.replace(EMOJI_CLUSTER, (cluster) => {
    const base = Array.from(cluster)[0];
    const names = EMOJI_NAMES[base];
    if (!names) return " ";
    const name = hindi ? names[1] : names[0];
    if (name === last) return " ";
    if (spoken >= MAX_SPOKEN_EMOJI) return " ";
    spoken++;
    last = name;
    return ` ${name} `;
  });
}

// Marks that are read aloud as noise.
const SYMBOLS = /[*_~#|<>^\\\[\]{}=+`]/g;

// The text to read aloud, or null when nothing readable is left. `maxChars` cuts
// the result (after cleaning, so removed junk doesn't use up the allowance).
export function cleanForSpeech(message: string | null | undefined, maxChars: number): string | null {
  if (!message) return null;
  const cleaned = nameEmoji(message)
    .replace(INVISIBLE, " ")
    .replace(URL_PATTERN, " ")
    .replace(EMAIL_PATTERN, " ")
    .replace(EMOJI, " ")
    .replace(SYMBOLS, " ")
    // "sooooo" -> "soo", "!!!!!" -> "!", "......" -> "."
    .replace(/(\p{L})\1{2,}/gu, "$1$1")
    .replace(/([!?.,;:-])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars)
    .trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : null;
}
