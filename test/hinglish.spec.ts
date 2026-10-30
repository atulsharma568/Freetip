import { expect, test } from "@playwright/test";
import { hindiSpeech, hinglishScore, isHinglish, knownSpellings, knownWeakSpellings, transliterateHinglish as t } from "../src/lib/hinglish";
import { WEAK_EXTRA, WORDS } from "../src/lib/hinglish-words";
import { buildVerbForms } from "../src/lib/hinglish-verbs";

test.describe("Hinglish converter", () => {
  test("converts Roman Hindi and leaves English and punctuation alone", () => {
    expect(t("bhai kya mast stream hai")).toBe("भाई क्या मस्त stream है");
    expect(t("Bhai, bahut accha khela!")).toBe("भाई, बहुत अच्छा खेला!");
    expect(t("BHAI KYA SCENE HAI")).toBe("भाई क्या SCENE है");
    expect(t("great stream today, keep it up")).toBe("great stream today, keep it up");
  });

  test("words that are also English only convert inside Hindi", () => {
    expect(t("welcome to the stream bhai")).toBe("welcome to the stream भाई");
    expect(t("mouse mat")).toBe("mouse mat");
    expect(t("main to gaya bhai")).toBe("मैं तो गया भाई");
    expect(t("Jett main hu bhai")).toBe("Jett main हूँ भाई");
    expect(t("mera main duelist hai")).toBe("मेरा main duelist है");
    expect(t("jai shri ram")).toBe("जय श्री राम");
    expect(t("I upgraded my ram to 16gb")).toBe("I upgraded my ram to 16gb");
  });

  test("things stuck to other characters are not words", () => {
    expect(t("@bhai is playing lo-fi")).toBe("@bhai is playing lo-fi");
    expect(t("visit bhai.com")).toBe("visit bhai.com");
    expect(t("2din ka plan hai")).toBe("2din का plan है");
  });

  test("common respellings reach the same word", () => {
    expect(t("acchaa bhaii")).toBe("अच्छा भाई");
    expect(t("nahii pata bhai")).toBe("नहीं पता भाई");
    expect(t("kyaa scene hai")).toBe("क्या scene है");
    expect(t("zyada mazaa")).toBe("ज़्यादा मज़ा");
    expect(t("jyada majaa")).toBe("ज़्यादा मज़ा");
  });

  test("English words and names are not caught by a respelling", () => {
    expect(t("a salon in a niche, Kamal said hello")).toBe("a salon in a niche, Kamal said hello");
    expect(t("the class sat at the bar to take water")).toBe("the class sat at the bar to take water");
  });

  test("every respelling points at the same Devanagari as its word", () => {
    const spellings = knownSpellings();
    expect(spellings.size).toBeGreaterThan(Object.keys(WORDS).length);
    for (const [word, dev] of Object.entries(WORDS)) expect(spellings.get(word)).toBe(dev);
    for (const dev of spellings.values()) expect(dev).toMatch(/[ऀ-ॿ]/);
  });

  test("detects Hindi messages and passes English through", () => {
    expect(isHinglish("bhai kya mast stream hai")).toBe(true);
    expect(isHinglish("मस्त stream")).toBe(true);
    expect(isHinglish("lo and behold, great stream")).toBe(false);
    expect(hinglishScore("")).toBe(0);
    expect(hindiSpeech("great stream today")).toEqual({ text: "great stream today", hindi: false });
    expect(hindiSpeech("bhai bahut mast")).toEqual({ text: "भाई बहुत मस्त", hindi: true });
  });
});

test.describe("Hinglish converter: verb forms, stretched spellings and safety", () => {
  test("verb forms made from a stem are converted inside Hindi", () => {
    expect(t("bhai kal ka match dekhna, mai bhi dekhunga")).toBe("भाई कल का match देखना, मैं भी देखूँगा");
    expect(t("tum log khelenge toh main bhi aaunga")).toBe("तुम लोग खेलेंगे तो मैं भी आऊँगा");
    expect(t("mujhe bataunga nahi, tum khud dekho")).toBe("मुझे बताऊँगा नहीं, तुम ख़ुद देखो");
    expect(t("yaar kuch bhi bolo, sunta hu main")).toBe("यार कुछ भी बोलो, सुनता हूँ मैं");
    expect(t("bhai kal aayega kya, mere dost bhi aayenge")).toBe("भाई कल आएगा क्या, मेरे दोस्त भी आएँगे");
    expect(t("wo kal bol raha tha ki hum milenge")).toBe("वो कल बोल रहा था कि हम मिलेंगे");
    expect(t("bhai padh ke aa, likh ke bhej")).toBe("भाई पढ़ के आ, लिख के भेज");
    expect(t("sab theek hai? kuch problem ho toh bata dena")).toBe("सब ठीक है? कुछ problem हो तो बता देना");
  });

  test("made forms never turn an English line into Hindi", () => {
    // Weak words need a Hindi clause around them and never make a message Hindi.
    const english = [
      "I walked a mile to eat nachos",
      "Jake and Karen say hi from Mumbai",
      "bane of my existence is that boss",
      "doge to the moon, nice stream",
      "nachos and a banana for the stream",
    ];
    for (const line of english) {
      expect(t(line)).toBe(line);
      expect(hindiSpeech(line)).toEqual({ text: line, hindi: false });
    }
    expect(isHinglish("dekhta hu")).toBe(false);
    // Even in a Hindi clause these stay English.
    expect(t("bhai mera bike kharab hai")).toBe("भाई मेरा bike kharab है");
    expect(t("bhai banana khana hai")).toBe("भाई banana खाना है");
    expect(t("bhai challenge accept karo")).toBe("भाई challenge accept करो");
  });

  test("the as-much-as family is not read as winning", () => {
    expect(t("jitna ho sake utna khelo")).toBe("जितना हो सके उतना खेलो");
    expect(t("tu jitna bhi bole, hum tere saath hain")).toBe("तू जितना भी बोले, हम तेरे साथ हैं");
    expect(t("kal ka match jeetna hai")).toBe("कल का match जीतना है");
  });

  test("stretched spellings reach the same word", () => {
    expect(t("yaarr bhaaii kyaa stream tha")).toBe("यार भाई क्या stream था");
    expect(t("bakwaas mat karo bhai")).toBe("बकवास मत करो भाई");
    expect(t("nahiii yaarr")).toBe("नहीं यार");
    expect(t("bahutt mastt bhai")).toBe("बहुत मस्त भाई");
    expect(t("aapki awaaz bahut pyaari hai")).toBe("आपकी आवाज़ बहुत प्यारी है");
    // A doubled consonant inside an English word is never cut back.
    expect(t("bhai challenge hai")).toBe("भाई challenge है");
  });

  test("the after a Hindi verb is थे, and ki before a clause is कि", () => {
    expect(t("tum thoda over ho rahe the")).toBe("तुम थोड़ा over हो रहे थे");
    expect(t("hum jeete the bhai")).toBe("हम जीते थे भाई");
    expect(t("mujhe the best lagta hai")).toBe("मुझे the best लगता है");
    expect(t("dost ne bola ki tera channel dekho")).toBe("दोस्त ने बोला कि तेरा channel देखो");
    expect(t("meri maa ki dua hai")).toBe("मेरी माँ की दुआ है");
  });

  test("words like constructor and toString are plain text", () => {
    expect(t("toString constructor valueOf bhai kya hai")).toBe("toString constructor valueOf भाई क्या है");
    expect(hindiSpeech("constructor __proto__ hasOwnProperty")).toEqual({ text: "constructor __proto__ hasOwnProperty", hindi: false });
  });

  test("a rude word is never respelt into a polite one", () => {
    const all = [...knownSpellings().keys(), ...knownWeakSpellings().keys()];
    expect(all.filter((w) => /^(chod|chud|gand|lund|bhos|randi)/.test(w))).toEqual([]);
    expect(t("bhai chhod do yaar")).toBe("भाई छोड़ दो यार");
  });

  test("a hand-typed word wins over a made form", () => {
    const made = buildVerbForms();
    const spellings = knownSpellings();
    const weak = knownWeakSpellings();
    for (const [word, dev] of Object.entries(made)) {
      if (word in WORDS) expect(spellings.get(word)).toBe(WORDS[word]);
      else if (word in WEAK_EXTRA) expect(weak.get(word)).toBe(WEAK_EXTRA[word]);
      else expect(weak.get(word)).toBe(dev);
    }
    expect(t("bhai maro isko")).toBe("भाई मारो इसको");
    expect(t("chalu karo bhai")).toBe("चालू करो भाई");
  });

  test("every Devanagari value in every table is well formed", () => {
    // No joining sign at the start, no two vowel signs in a row, nothing but
    // Devanagari and spaces, and no word left ending in a half letter.
    const SIGN = /[\u093E-\u094C\u0901-\u0903\u094D\u0962\u0963\u093C]/;
    const values = [...knownSpellings().values(), ...knownWeakSpellings().values()];
    expect(values.length).toBeGreaterThan(5000);
    for (const dev of values) {
      expect(dev, dev).toMatch(/^[\u0900-\u097F ]+$/);
      expect(SIGN.test(dev[0]), dev).toBe(false);
      expect(/[\u093E-\u094C][\u093E-\u094C]/.test(dev), dev).toBe(false);
      expect(/\u094D$/.test(dev), dev).toBe(false);
    }
  });

  test("no spelling is ambiguous between two meanings", () => {
    // A respelling that two different words share is dropped, never guessed.
    const strong = knownSpellings();
    const weak = knownWeakSpellings();
    for (const [word, dev] of weak) if (strong.has(word)) expect(strong.get(word), word).toBe(dev);
  });

  test("a realistic batch of messages comes out right", () => {
    const cases: Array<[string, string]> = [
      ["bhai aaj ka stream ekdum fire tha, maza aa gaya", "भाई आज का stream एकदम fire था, मज़ा आ गया"],
      ["aapka content bahut pasand aata hai, roz dekhta hu", "आपका content बहुत पसंद आता है, रोज़ देखता हूँ"],
      ["mere liye ek shoutout dedo bhai, main kal se subscribe kar raha hu", "मेरे लिए एक shoutout दे दो भाई, मैं कल से subscribe कर रहा हूँ"],
      ["abhi tak kuchh samajh nahi aaya, phir se batao", "अभी तक कुछ समझ नहीं आया, फिर से बताओ"],
      ["utna hi khelo jitna mann kare, thak jaoge", "उतना hi खेलो जितना मन करे, थक जाओगे"],
      ["sunao bhai koi achha sa gaana", "सुनाओ भाई कोई अच्छा सा गाना"],
      ["kahin se bhi aao, yahan sab ka welcome hai", "कहीं से भी आओ, यहाँ सब का welcome है"],
      ["pehle bhi bola tha, aaj phir bol raha hu", "पहले भी बोला था, आज फिर बोल रहा हूँ"],
      ["BHAI KYA KHEL DIYA TUNE", "भाई क्या खेल दिया TUNE"],
      ["Happy Diwali bhai, tum sabko badhai ho", "Happy दिवाली भाई, तुम सबको बधाई हो"],
    ];
    for (const [input, expected] of cases) expect(t(input), input).toBe(expected);
  });

  test("ordinary English tip messages are left exactly as typed", () => {
    const english = [
      "great stream today, keep it up",
      "love your content bro, here is a tip for your next game",
      "happy birthday to my brother Rohit, give him a shoutout",
      "can you do a 1v5 clutch on ranked",
      "welcome to the main stage, the crowd is going wild",
      "I bought 16gb of ram for my pc thanks to you",
      "mile after mile, you never give up",
      "the tariff on chips is crazy, anyway nice game",
      "My dog Tara loves your voice",
      "lets go, ace on ascent, what a play",
      "I beat the boss because of your tips",
    ];
    for (const line of english) expect(hindiSpeech(line), line).toEqual({ text: line, hindi: false });
  });

  test("a long message converts quickly", () => {
    const line = "bhai kya mast stream hai yaarrr, aaj dekhenge kal phir milenge ";
    const long = line.repeat(40).slice(0, 2400);
    const started = Date.now();
    for (let i = 0; i < 20; i++) t(long);
    expect(Date.now() - started).toBeLessThan(2000);
    const odd = "aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbb aabbccddeeffgg " + "x".repeat(500);
    expect(t(odd)).toBe(odd);
  });
});

test.describe("Unknown word log", () => {
  test("lists unknown Roman words in Hindi-looking messages only", async () => {
    const { unknownHinglishWords } = await import("../src/lib/hinglish");
    expect(unknownHinglishWords("bhai kya zorbaxy stream hai")).toEqual(expect.arrayContaining(["zorbaxy"]));
    expect(unknownHinglishWords("bhai kya mast hai")).toEqual([]);
    expect(unknownHinglishWords("zorbaxy great stream today")).toEqual([]);
    expect(unknownHinglishWords("bhai kya zorbaxy @qwertyu lo-fiq hai")).not.toContain("qwertyu");
  });
});

test.describe("Automatic learning rules", () => {
  const verdict = (o: Partial<import("../src/lib/tts-learn").Verdict>) => ({
    word: "pasandida", is_hindi: true, devanagari: "पसंदीदा", also_english: false, offensive: false, confident: true, ...o,
  });

  test("learns only what the model is sure of and our own rules accept", async () => {
    const { decide } = await import("../src/lib/tts-learn");
    const asked = new Set(["pasandida", "stream", "chodu", "main"]);
    expect(decide(asked, verdict({}))).toEqual({ outcome: "learned", devanagari: "पसंदीदा" });
    expect(decide(asked, verdict({ word: "stream", is_hindi: false, devanagari: "" }))).toEqual({ outcome: "english" });
    expect(decide(asked, verdict({ confident: false }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ also_english: true }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ offensive: true }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ word: "chodu", devanagari: "चोदू" }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ devanagari: "pasandida" }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ devanagari: "पसंदीदा hai" }))?.outcome).toBe("rejected");
    expect(decide(asked, verdict({ word: "unasked" }))).toBeNull();
  });

  test("learned words convert inside Hindi clauses, never override, and stop being logged", async () => {
    const { setLearnedWords, transliterateHinglish: tr, unknownHinglishWords } = await import("../src/lib/hinglish");
    try {
      setLearnedWords([["pasandida", "पसंदीदा"], ["bhai", "WRONG"], ["main", "WRONG"]]);
      expect(tr("bhai ye pasandida hai")).toBe("भाई ये पसंदीदा है");
      expect(tr("my pasandida game")).toBe("my pasandida game");
      expect(tr("bhai kya hai")).toBe("भाई क्या है");
      expect(unknownHinglishWords("bhai ye pasandida hai")).not.toContain("pasandida");
    } finally {
      setLearnedWords([]);
    }
    expect(unknownHinglishWords("bhai ye pasandida hai")).toContain("pasandida");
  });
});
