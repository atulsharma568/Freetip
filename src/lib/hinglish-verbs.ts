// Verb forms for the Hinglish converter (src/lib/hinglish.ts), made from a stem and
// a table of endings instead of typed out one by one: "dekh" gives dekhna, dekhta,
// dekhti, dekhte, dekho, dekhunga, dekhega, dekhenge and so on, each with its
// Devanagari ("देखना", "देखता", ...).
//
// Made forms are "weak" words: they are converted only inside a clause that is
// already Hindi because of other words, and they never make a message look Hindi
// by themselves. So an English line that happens to contain "mile" or "nacho" is
// left alone, while "bhai tu nacho" is converted. A hand-typed word in
// hinglish-words.ts always wins over a made form.
//
// Two kinds of stem:
//   "c"  ends in a consonant (देख, बोल, खेल): endings attach as vowel signs (ा, ी, े).
//   "a"  ends in the vowel आ (बता, सुना, खा): endings attach as whole vowels (या, ई, ए).
// Irregular verbs (kar, ja, aa, de, le, ho) take only the endings that are regular
// for them (`only`); their other forms are typed in hinglish-words.ts.

type StemKind = "c" | "a";

interface Stem {
  roman: string[];
  dev: string;
  kind: StemKind;
  // Take only these endings from the table (irregular verbs).
  only?: string[];
  // Endings that belong to this stem alone, as [Roman, Devanagari].
  own?: Array<[string, string]>;
}

type Endings = Array<[string, string]>;

// The bare stem ("") is the "you" command: dekh, likh, padh, chhod.
const C_ENDINGS: Endings = [
  ["", ""], ["na", "ना"], ["ne", "ने"], ["ta", "ता"], ["ti", "ती"], ["te", "ते"],
  ["a", "ा"], ["i", "ी"], ["e", "े"], ["o", "ो"], ["u", "ूँ"], ["un", "ूँ"],
  ["en", "ें"], ["ein", "ें"], ["iye", "िए"], ["ega", "ेगा"], ["egi", "ेगी"],
  ["enge", "ेंगे"], ["unga", "ूँगा"], ["ungi", "ूँगी"], ["oge", "ोगे"],
  ["ogi", "ोगी"], ["kar", "कर"], ["ke", "के"],
];

const A_ENDINGS: Endings = [
  ["", ""], ["na", "ना"], ["ne", "ने"], ["ta", "ता"], ["ti", "ती"], ["te", "ते"],
  ["ya", "या"], ["yi", "ई"], ["i", "ई"], ["ye", "ए"], ["e", "ए"], ["o", "ओ"],
  ["iye", "इए"], ["un", "ऊँ"], ["unga", "ऊँगा"], ["ungi", "ऊँगी"],
  ["yega", "एगा"], ["ega", "एगा"], ["yegi", "एगी"], ["egi", "एगी"],
  ["yenge", "एँगे"], ["enge", "एँगे"], ["oge", "ओगे"], ["ogi", "ओगी"],
  ["yen", "एँ"], ["en", "एँ"], ["kar", "कर"], ["ke", "के"],
];

// "de" and "le" make their future with ga/gi/nge (देगा, लेंगे), not ega/enge.
const DE_LE_OWN: Endings = [["ga", "गा"], ["gi", "गी"], ["nge", "ंगे"]];

const STEMS: Stem[] = [
  // Regular, stems ending in a consonant.
  { roman: ["dekh"], dev: "देख", kind: "c" },
  { roman: ["bol"], dev: "बोल", kind: "c" },
  { roman: ["khel"], dev: "खेल", kind: "c" },
  { roman: ["chal"], dev: "चल", kind: "c" },
  { roman: ["sun"], dev: "सुन", kind: "c" },
  { roman: ["mil"], dev: "मिल", kind: "c" },
  { roman: ["lag"], dev: "लग", kind: "c" },
  { roman: ["rakh"], dev: "रख", kind: "c" },
  { roman: ["bhej"], dev: "भेज", kind: "c" },
  { roman: ["soch"], dev: "सोच", kind: "c" },
  { roman: ["samajh", "samjh"], dev: "समझ", kind: "c" },
  { roman: ["padh"], dev: "पढ़", kind: "c" },
  { roman: ["likh"], dev: "लिख", kind: "c" },
  { roman: ["uth"], dev: "उठ", kind: "c" },
  { roman: ["baith", "beth"], dev: "बैठ", kind: "c" },
  { roman: ["ruk"], dev: "रुक", kind: "c" },
  { roman: ["seekh", "sikh"], dev: "सीख", kind: "c" },
  { roman: ["keh", "kah"], dev: "कह", kind: "c" },
  { roman: ["rah", "reh"], dev: "रह", kind: "c" },
  { roman: ["sak"], dev: "सक", kind: "c", only: ["e", "ega", "egi", "enge", "unga", "ungi", "oge", "ogi", "en"] },
  { roman: ["jaag"], dev: "जाग", kind: "c" },
  { roman: ["bhool", "bhul"], dev: "भूल", kind: "c" },
  { roman: ["bhaag", "bhag"], dev: "भाग", kind: "c" },
  { roman: ["badh"], dev: "बढ़", kind: "c" },
  { roman: ["pahunch", "pahuch"], dev: "पहुँच", kind: "c" },
  { roman: ["ghum"], dev: "घूम", kind: "c" },
  { roman: ["nikal"], dev: "निकल", kind: "c" },
  { roman: ["laut"], dev: "लौट", kind: "c" },
  { roman: ["sambhal"], dev: "संभल", kind: "c" },
  { roman: ["chhod"], dev: "छोड़", kind: "c" },
  { roman: ["tod"], dev: "तोड़", kind: "c" },
  { roman: ["kaat"], dev: "काट", kind: "c" },
  { roman: ["khol"], dev: "खोल", kind: "c" },
  { roman: ["maang", "mang"], dev: "माँग", kind: "c" },
  { roman: ["maar"], dev: "मार", kind: "c" },
  { roman: ["pakad"], dev: "पकड़", kind: "c" },
  { roman: ["hans", "has"], dev: "हँस", kind: "c" },
  { roman: ["gir"], dev: "गिर", kind: "c" },
  { roman: ["jeet"], dev: "जीत", kind: "c" },
  { roman: ["haar"], dev: "हार", kind: "c" },
  { roman: ["chah", "chaah"], dev: "चाह", kind: "c" },
  { roman: ["ban"], dev: "बन", kind: "c" },
  { roman: ["pehchan", "pahchan"], dev: "पहचान", kind: "c" },
  { roman: ["jaan"], dev: "जान", kind: "c" },
  { roman: ["pooch", "puch"], dev: "पूछ", kind: "c" },
  { roman: ["thak"], dev: "थक", kind: "c" },
  { roman: ["khareed", "kharid"], dev: "ख़रीद", kind: "c" },
  { roman: ["bech"], dev: "बेच", kind: "c" },
  { roman: ["nach"], dev: "नाच", kind: "c" },
  { roman: ["mar"], dev: "मर", kind: "c" },
  { roman: ["chhup"], dev: "छुप", kind: "c" },
  { roman: ["phenk", "fenk"], dev: "फेंक", kind: "c" },
  { roman: ["bhar"], dev: "भर", kind: "c" },
  { roman: ["dikh"], dev: "दिख", kind: "c" },
  { roman: ["bik"], dev: "बिक", kind: "c" },
  { roman: ["jhuk"], dev: "झुक", kind: "c" },
  { roman: ["chadh"], dev: "चढ़", kind: "c" },
  // Regular, stems ending in the vowel आ.
  { roman: ["bata"], dev: "बता", kind: "a" },
  { roman: ["dikha"], dev: "दिखा", kind: "a" },
  { roman: ["sikha"], dev: "सिखा", kind: "a" },
  { roman: ["suna"], dev: "सुना", kind: "a" },
  { roman: ["chala"], dev: "चला", kind: "a" },
  { roman: ["utha"], dev: "उठा", kind: "a" },
  { roman: ["laga"], dev: "लगा", kind: "a" },
  { roman: ["bula"], dev: "बुला", kind: "a" },
  { roman: ["kama"], dev: "कमा", kind: "a" },
  { roman: ["hata"], dev: "हटा", kind: "a" },
  { roman: ["ghuma"], dev: "घुमा", kind: "a" },
  { roman: ["nikala"], dev: "निकाला", kind: "a" },
  { roman: ["khila"], dev: "खिला", kind: "a" },
  { roman: ["samjha"], dev: "समझा", kind: "a" },
  { roman: ["bana"], dev: "बना", kind: "a" },
  { roman: ["jala"], dev: "जला", kind: "a" },
  { roman: ["gaa"], dev: "गा", kind: "a" },
  { roman: ["khaa", "kha"], dev: "खा", kind: "a" },
  { roman: ["laa"], dev: "ला", kind: "a" },
  { roman: ["pila"], dev: "पिला", kind: "a" },
  { roman: ["rula"], dev: "रुला", kind: "a" },
  { roman: ["hansa"], dev: "हँसा", kind: "a" },
  { roman: ["chhupa"], dev: "छुपा", kind: "a" },
  // Irregular: only the endings that are regular for them.
  {
    roman: ["kar"], dev: "कर", kind: "c",
    only: ["na", "ne", "ta", "ti", "te", "o", "u", "un", "e", "en", "ein", "iye", "ega", "egi", "enge", "unga", "ungi", "oge", "ogi", "ke"],
  },
  {
    roman: ["ja"], dev: "जा", kind: "a",
    only: ["na", "ne", "ta", "ti", "te", "o", "iye", "un", "unga", "ungi", "yega", "ega", "yegi", "egi", "yenge", "enge", "oge", "ogi", "ye", "yen", "kar", "ke"],
  },
  {
    roman: ["aa"], dev: "आ", kind: "a",
    only: ["na", "ne", "ta", "ti", "te", "iye", "un", "unga", "ungi", "yega", "ega", "yegi", "egi", "yenge", "enge", "oge", "ogi", "yen", "kar", "ke"],
  },
  { roman: ["de"], dev: "दे", kind: "c", only: ["ta", "ti", "te", "ne", "ke", "kar"], own: DE_LE_OWN },
  { roman: ["le"], dev: "ले", kind: "c", only: ["ta", "ti", "te", "ne", "ke", "kar"], own: DE_LE_OWN },
  { roman: ["ho"], dev: "हो", kind: "c", only: ["na", "ne", "ke", "kar"], own: [["ge", "गे"]] },
];

// Made forms that are everyday English words and would read wrongly even inside a
// Hindi clause ("bhai mera bike kharab hai" must keep its bike).
const NOT_FORMS = new Set<string>(["banana", "bike"]);

function endingsFor(stem: Stem): Endings {
  const table = stem.kind === "c" ? C_ENDINGS : A_ENDINGS;
  const chosen = stem.only ? table.filter(([r]) => stem.only!.includes(r)) : table;
  return [...chosen, ...(stem.own ?? [])];
}

// Roman form -> Devanagari. A form made by two stems with different results is
// dropped as ambiguous, and nothing shorter than 4 letters is made (the short ones
// are typed by hand where they are safe).
export function buildVerbForms(): Record<string, string> {
  const made = new Map<string, string | null>();
  for (const stem of STEMS) {
    for (const [romanEnd, devEnd] of endingsFor(stem)) {
      const dev = stem.dev + devEnd;
      for (const root of stem.roman) {
        const roman = root + romanEnd;
        if (roman.length < 4 || NOT_FORMS.has(roman)) continue;
        const have = made.get(roman);
        if (have === undefined) made.set(roman, dev);
        else if (have !== dev) made.set(roman, null);
      }
    }
  }
  const out: Record<string, string> = {};
  for (const [roman, dev] of made) if (dev !== null) out[roman] = dev;
  return out;
}
