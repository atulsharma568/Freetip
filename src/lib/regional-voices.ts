// Regional language voices (paid feature "regionalVoices"). Pure and free of Node
// imports, so the dashboard form can use the list too.
//
// The creator picks at most one regional language (users.tts_lang, migration 0039).
// A message is read in it only when the fan wrote it in that language's own script;
// everything else keeps today's behaviour (Hindi for Devanagari and Hinglish, Indian
// English otherwise). A message typed in Roman letters ("Tanglish") is read by the
// English voice, because nothing here can tell which language it is.
//
// These are other languages, not accents of Hindi. Every voice name below was checked
// against Microsoft's list of Azure Speech neural voices (language-support page,
// 2026-11-01): standard neural voices, one female and one male for each language,
// offered in every text-to-speech region including centralindia. A wrong name makes
// Azure answer 400 and the alert plays silently (Polly has no regional voice), so
// re-check the names against that page before changing one.

import { hasFeature, type FeatureSource } from "@/lib/plans";

export type RegionalLang = "ta-IN" | "te-IN" | "kn-IN" | "ml-IN" | "bn-IN" | "gu-IN" | "mr-IN";

export interface RegionalLanguage {
  code: RegionalLang;
  label: string;
  // The label in its own script, shown beside the English one in the picker.
  native: string;
  // Any letter of the language's Unicode block.
  script: RegExp;
  female: string;
  male: string;
  // A short, polite message for the dashboard's test button, in the language's own script.
  sample: string;
}

export const REGIONAL_LANGUAGES: readonly RegionalLanguage[] = [
  {
    code: "ta-IN",
    label: "Tamil",
    native: "தமிழ்",
    script: /[஀-௿]/,
    female: "ta-IN-PallaviNeural",
    male: "ta-IN-ValluvarNeural",
    sample: "இன்றைய ஸ்ட்ரீம் மிகவும் அருமை, தொடர்ந்து கலக்குங்கள்",
  },
  {
    code: "te-IN",
    label: "Telugu",
    native: "తెలుగు",
    script: /[ఀ-౿]/,
    female: "te-IN-ShrutiNeural",
    male: "te-IN-MohanNeural",
    sample: "ఈ రోజు స్ట్రీమ్ చాలా బాగుంది, ఇలాగే కొనసాగించండి",
  },
  {
    code: "kn-IN",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    script: /[ಀ-೿]/,
    female: "kn-IN-SapnaNeural",
    male: "kn-IN-GaganNeural",
    sample: "ಇವತ್ತಿನ ಸ್ಟ್ರೀಮ್ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ, ಹೀಗೇ ಮುಂದುವರಿಸಿ",
  },
  {
    code: "ml-IN",
    label: "Malayalam",
    native: "മലയാളം",
    script: /[ഀ-ൿ]/,
    female: "ml-IN-SobhanaNeural",
    male: "ml-IN-MidhunNeural",
    sample: "ഇന്നത്തെ സ്ട്രീം വളരെ നന്നായിരുന്നു, ഇങ്ങനെ തുടരൂ",
  },
  {
    code: "bn-IN",
    label: "Bengali",
    native: "বাংলা",
    script: /[ঀ-৿]/,
    female: "bn-IN-TanishaaNeural",
    male: "bn-IN-BashkarNeural",
    sample: "আজকের স্ট্রিম খুব ভালো ছিল, এভাবেই চালিয়ে যাও",
  },
  {
    code: "gu-IN",
    label: "Gujarati",
    native: "ગુજરાતી",
    script: /[઀-૿]/,
    female: "gu-IN-DhwaniNeural",
    male: "gu-IN-NiranjanNeural",
    sample: "આજની સ્ટ્રીમ બહુ સરસ હતી, આમ જ ચાલુ રાખો",
  },
  {
    // Marathi is written in Devanagari, like Hindi: see prepareSpeech for the tie-break.
    code: "mr-IN",
    label: "Marathi",
    native: "मराठी",
    script: /[ऀ-ॿ]/,
    female: "mr-IN-AarohiNeural",
    male: "mr-IN-ManoharNeural",
    sample: "आजचा स्ट्रीम खूप छान होता, असाच सुरू ठेवा",
  },
];

const BY_CODE = new Map<string, RegionalLanguage>(REGIONAL_LANGUAGES.map((l) => [l.code, l]));

export function regionalLanguage(code: RegionalLang): RegionalLanguage {
  return BY_CODE.get(code)!;
}

// A stored or posted value as a language code, or null for anything else (including
// an empty string, which means "none").
export function parseRegionalLang(value: unknown): RegionalLang | null {
  return typeof value === "string" && BY_CODE.has(value) ? (value as RegionalLang) : null;
}

// Whether the text holds a letter of any of the six scripts that only one language of
// ours uses (Devanagari is left out: Hindi uses it too).
const OWN_SCRIPT = REGIONAL_LANGUAGES.filter((l) => l.code !== "mr-IN").map((l) => l.script);

export function hasRegionalScript(text: string): boolean {
  return OWN_SCRIPT.some((re) => re.test(text));
}

// The language a creator's alerts are read in, or null: the voice is read only while
// the creator's switch is on, whatever is stored. Used at play time, so turning the
// feature off drops the voice at once and the message is read as it was before.
export function effectiveRegionalLang(row: (FeatureSource & { tts_lang?: unknown }) | null | undefined): RegionalLang | null {
  if (!row || !hasFeature(row, "regionalVoices")) return null;
  return parseRegionalLang(row.tts_lang);
}
