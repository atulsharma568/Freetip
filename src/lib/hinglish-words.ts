// Word tables for the Hinglish converter (src/lib/hinglish.ts). Roman Hindi to
// Devanagari, so a Hindi voice says "भाई" and not "bai". The base lists come from
// the owner's AcePressure project; the section at the bottom is new here.

// Hindi words that are only Hindi in a tipping chat: converted wherever they appear.
const BASE: Record<string, string> = {
  "bhai": "भाई", "bhaai": "भाई", "bhaiya": "भैया", "bhaiyya": "भैया",
  "bhaiyo": "भाइयो", "bhaiyon": "भाइयों", "didi": "दीदी", "behen": "बहन",
  "yaar": "यार", "yar": "यार", "yaaro": "यारो", "yaaron": "यारों",
  "dost": "दोस्त", "dosto": "दोस्तो", "doston": "दोस्तों", "banda": "बंदा",
  "bande": "बंदे", "ladka": "लड़का", "ladki": "लड़की", "aadmi": "आदमी",
  "aap": "आप", "tum": "तुम", "mai": "मैं", "apun": "अपुन",
  "tu": "तू", "hum": "हम", "mera": "मेरा", "meri": "मेरी",
  "tera": "तेरा", "teri": "तेरी", "tere": "तेरे", "hamara": "हमारा",
  "hamari": "हमारी", "tumhara": "तुम्हारा", "tumhari": "तुम्हारी", "apna": "अपना",
  "apni": "अपनी", "apne": "अपने", "uska": "उसका", "uski": "उसकी",
  "uske": "उसके", "iska": "इसका", "iski": "इसकी", "iske": "इसके",
  "unka": "उनका", "unki": "उनकी", "unke": "उनके", "aapka": "आपका",
  "aapki": "आपकी", "aapke": "आपके", "mujhe": "मुझे", "tujhe": "तुझे",
  "tumhe": "तुम्हें", "tumhein": "तुम्हें", "hume": "हमें", "humein": "हमें",
  "mujhko": "मुझको", "tumko": "तुमको", "aapko": "आपको", "sabko": "सबको",
  "usko": "उसको", "isko": "इसको", "unko": "उनको", "maine": "मैंने",
  "humne": "हमने", "tumne": "तुमने", "aapne": "आपने", "usne": "उसने",
  "unhone": "उन्होंने", "ye": "ये", "woh": "वो", "wo": "वो",
  "vo": "वो", "kis": "किस", "kisko": "किसको", "kiska": "किसका",
  "kisi": "किसी", "ka": "का", "ki": "की", "ke": "के",
  "se": "से", "ne": "ने", "pe": "पे", "mein": "में",
  "bhi": "भी", "toh": "तो", "tak": "तक", "liye": "लिए",
  "saath": "साथ", "sath": "साथ", "aur": "और", "lekin": "लेकिन",
  "magar": "मगर", "kyunki": "क्योंकि", "agar": "अगर", "bas": "बस",
  "sirf": "सिर्फ़", "ji": "जी", "haan": "हाँ", "wala": "वाला",
  "wali": "वाली", "wale": "वाले", "waala": "वाला", "waali": "वाली",
  "waale": "वाले", "yahan": "यहाँ", "wahan": "वहाँ", "idhar": "इधर",
  "udhar": "उधर", "kidhar": "किधर", "kya": "क्या", "kyun": "क्यों",
  "kyu": "क्यों", "kyon": "क्यों", "kaise": "कैसे", "kaisa": "कैसा",
  "kaisi": "कैसी", "kahan": "कहाँ", "kaha": "कहा", "kab": "कब",
  "kaun": "कौन", "kitna": "कितना", "kitni": "कितनी", "kitne": "कितने",
  "hai": "है", "hain": "हैं", "tha": "था", "thi": "थी",
  "hoga": "होगा", "hogi": "होगी", "honge": "होंगे", "hoon": "हूँ",
  "hu": "हूँ", "hua": "हुआ", "hui": "हुई", "hue": "हुए",
  "hota": "होता", "hoti": "होती", "hote": "होते", "hogaya": "हो गया",
  "hogya": "हो गया", "raha": "रहा", "rahi": "रही", "rahe": "रहे",
  "rha": "रहा", "rhi": "रही", "rhe": "रहे", "nahi": "नहीं",
  "nahin": "नहीं", "nhi": "नहीं", "naa": "ना", "kar": "कर",
  "karo": "करो", "karna": "करना", "karke": "करके", "karte": "करते",
  "karta": "करता", "karti": "करती", "kari": "करी", "kiya": "किया",
  "kiye": "किए", "karunga": "करूँगा", "karenge": "करेंगे", "gaya": "गया",
  "gayi": "गई", "gaye": "गए", "aaya": "आया", "aayi": "आई",
  "aaye": "आए", "aa": "आ", "aaja": "आजा", "aao": "आओ",
  "aana": "आना", "aunga": "आऊँगा", "aaunga": "आऊँगा", "ja": "जा",
  "jaa": "जा", "jao": "जाओ", "jana": "जाना", "jaana": "जाना",
  "jaunga": "जाऊँगा", "de": "दे", "dena": "देना", "diya": "दिया",
  "di": "दी", "dedo": "दे दो", "dunga": "दूँगा", "le": "ले",
  "lo": "लो", "lena": "लेना", "liya": "लिया", "lunga": "लूँगा",
  "dekh": "देख", "dekha": "देखा", "dekhna": "देखना", "dekhte": "देखते",
  "dekho": "देखो", "suna": "सुना", "sunna": "सुनना", "suno": "सुनो",
  "bol": "बोल", "bola": "बोला", "bolo": "बोलो", "bolna": "बोलना",
  "bata": "बता", "batao": "बताओ", "batana": "बताना", "samajh": "समझ",
  "samjha": "समझा", "samjhe": "समझे", "chal": "चल", "chala": "चला",
  "chalo": "चलो", "chalega": "चलेगा", "ruk": "रुक", "ruko": "रुको",
  "sakta": "सकता", "sakti": "सकती", "sakte": "सकते", "chahiye": "चाहिए",
  "chahta": "चाहता", "chahti": "चाहती", "mila": "मिला", "mili": "मिली",
  "laga": "लगा", "lagi": "लगी", "lage": "लगे", "lagta": "लगता",
  "lagti": "लगती", "pata": "पता", "maar": "मार", "maara": "मारा",
  "maro": "मारो", "rakh": "रख", "rakho": "रखो", "bhej": "भेज",
  "bhejo": "भेजो", "soch": "सोच", "socha": "सोचा", "jaldi": "जल्दी",
  "dheere": "धीरे", "khel": "खेल", "khela": "खेला", "khelna": "खेलना",
  "khelo": "खेलो", "khelte": "खेलते", "khelta": "खेलता", "khelti": "खेलती",
  "khelunga": "खेलूँगा", "jeet": "जीत", "jeeta": "जीता", "jeeto": "जीतो",
  "jeetna": "जीतना", "jeetega": "जीतेगा", "haar": "हार", "haara": "हारा",
  "bahut": "बहुत", "bohot": "बहुत", "bahot": "बहुत", "bohut": "बहुत",
  "bhot": "बहुत", "thoda": "थोड़ा", "zyada": "ज़्यादा", "kam": "कम",
  "sab": "सब", "kuch": "कुछ", "koi": "कोई", "kaafi": "काफ़ी",
  "kafi": "काफ़ी", "itna": "इतना", "itni": "इतनी", "itne": "इतने",
  "achha": "अच्छा", "accha": "अच्छा", "acha": "अच्छा", "achhi": "अच्छी",
  "achhe": "अच्छे", "acche": "अच्छे", "bura": "बुरा", "buri": "बुरी",
  "badiya": "बढ़िया", "badhiya": "बढ़िया", "jhakaas": "झकास", "jhakas": "झकास",
  "theek": "ठीक", "thik": "ठीक", "sahi": "सही", "galat": "ग़लत",
  "bilkul": "बिल्कुल", "ekdum": "एकदम", "bada": "बड़ा", "badi": "बड़ी",
  "bade": "बड़े", "chota": "छोटा", "chhota": "छोटा", "choti": "छोटी",
  "pyara": "प्यारा", "pyari": "प्यारी", "sundar": "सुंदर", "zabardast": "ज़बरदस्त",
  "jabardast": "ज़बरदस्त", "kamaal": "कमाल", "shaandaar": "शानदार", "shandaar": "शानदार",
  "shandar": "शानदार", "gazab": "ग़ज़ब", "ghazab": "ग़ज़ब", "khatarnak": "ख़तरनाक",
  "khatarnaak": "ख़तरनाक", "kadak": "कड़क", "bindaas": "बिंदास", "dhamaal": "धमाल",
  "dhamaka": "धमाका", "bawaal": "बवाल", "bawal": "बवाल", "faadu": "फाड़ू",
  "aag": "आग", "pagal": "पागल", "sach": "सच", "sachi": "सच्ची",
  "sacchi": "सच्ची", "asli": "असली", "naya": "नया", "nayi": "नई",
  "purana": "पुराना", "namaste": "नमस्ते", "namaskar": "नमस्कार", "dhanyavaad": "धन्यवाद",
  "dhanyawad": "धन्यवाद", "shukriya": "शुक्रिया", "badhai": "बधाई", "mubarak": "मुबारक",
  "janamdin": "जन्मदिन", "arre": "अरे", "arrey": "अरे", "oye": "ओए",
  "abe": "अबे", "abey": "अबे", "waah": "वाह", "wah": "वाह",
  "ohho": "ओहो", "oho": "ओहो", "haye": "हाय", "uff": "उफ़",
  "kal": "कल", "aaj": "आज", "parso": "परसों", "abhi": "अभी",
  "kabhi": "कभी", "ab": "अब", "phir": "फिर", "fir": "फिर",
  "pehle": "पहले", "baad": "बाद", "hamesha": "हमेशा", "subah": "सुबह",
  "shaam": "शाम", "raat": "रात", "saal": "साल", "baar": "बार",
  "baat": "बात", "kaam": "काम", "naam": "नाम", "dil": "दिल",
  "jaan": "जान", "duniya": "दुनिया", "zindagi": "ज़िंदगी", "gaana": "गाना",
  "khushi": "ख़ुशी", "khana": "खाना", "pani": "पानी", "paani": "पानी",
  "chai": "चाय", "ghar": "घर", "paisa": "पैसा", "paise": "पैसे",
  "rupaye": "रुपये", "rupay": "रुपये", "rupaiya": "रुपया", "maza": "मज़ा",
  "mazaa": "मज़ा", "maja": "मज़ा", "majaa": "मज़ा", "mazaak": "मज़ाक़",
  "pyaar": "प्यार", "pyar": "प्यार", "mohabbat": "मोहब्बत", "mehnat": "मेहनत",
  "koshish": "कोशिश", "agla": "अगला", "agli": "अगली", "agle": "अगले",
  "pakka": "पक्का", "zaroor": "ज़रूर", "zarur": "ज़रूर", "jarur": "ज़रूर",
  "jaroor": "ज़रूर", "sabse": "सबसे", "shabaash": "शाबाश", "shabash": "शाबाश",
  "bekaar": "बेकार", "bekar": "बेकार", "bakwas": "बकवास", "acchi": "अच्छी",
  "achchi": "अच्छी", "jeetenge": "जीतेंगे", "bolu": "बोलूँ", "dekhenge": "देखेंगे",
  "milenge": "मिलेंगे", "raho": "रहो", "rehna": "रहना", "ek": "एक",
  "paanch": "पाँच", "saat": "सात", "aath": "आठ", "sau": "सौ",
  "hazaar": "हज़ार", "hazar": "हज़ार", "lakh": "लाख", "bhagwan": "भगवान",
  "ishwar": "ईश्वर", "jai": "जय", "shri": "श्री", "shree": "श्री",
  "mahadev": "महादेव", "radhe": "राधे", "bharat": "भारत", "hindustan": "हिन्दुस्तान",
  "desi": "देसी",
};

// Hindi words that are also English words (main, mat, to, do): converted inside a
// Hindi clause unless the words around them make them English.
export const CONTEXT_WORDS: Record<string, string> = {
  "main": "मैं", "mat": "मत", "mere": "मेरे", "din": "दिन",
  "mast": "मस्त", "na": "ना", "ho": "हो", "to": "तो",
  "do": "दो", "ko": "को", "ram": "राम", "yeh": "यह",
  "sun": "सुन", "log": "लोग", "par": "पर", "jab": "जब", "ban": "बन",
};

// Short Hindi words that are also names, abbreviations or other languages: Hindi
// only inside a Hindi clause.
export const SHORT_WORDS = new Set<string>([
  "aa", "ab", "abe", "bas", "bata", "de", "dena", "di",
  "ek", "fir", "haye", "hu", "hue", "hum", "ja", "jaa",
  "jana", "ji", "ka", "kafi", "kari", "ke", "ki", "kis",
  "le", "lena", "lo", "mila", "naa", "ne", "oho", "pe",
  "dum", "har", "jo", "mil", "pi", "sa", "sau", "se", "si", "tak", "tu", "uff", "vo", "wo", "ye",
]);

// "welcome to stream bhai" keeps its "to": these need a Hindi word beside them.
export const NEEDS_HINDI_NEIGHBOUR = new Set<string>([
  "ban", "do", "jab", "ko", "log", "par", "to",
]);

// "ki" is कि ("that") after these ("bola ki", "lagta hai ki") and की ("of") anywhere else.
export const KI_THAT_AFTER = new Set<string>([
  "bola", "bolta", "bolte", "batao", "bataya", "dekha", "dua", "hai", "hain", "hoga", "hogi", "hua",
  "kaha", "kehta", "kehte", "khabar", "laga", "lagta", "lagti", "maloom", "matlab", "pata", "sach",
  "socha", "sochta", "suna", "tha", "the", "thi", "umeed", "yaad", "yakeen",
]);

// "the" is थे ("they were") right after a Hindi verb form such as "rahe the".
export const THE_AFTER_ENDING = /(ते|े|ए)$/;

export const ENGLISH_GRAMMAR = new Set<string>([
  "a", "about", "also", "am", "an", "and", "are", "at",
  "be", "because", "been", "being", "but", "by", "can", "cant",
  "could", "did", "didnt", "does", "dont", "for", "from", "had",
  "has", "have", "he", "her", "here", "him", "his", "how",
  "i", "if", "im", "in", "into", "is", "isnt", "it",
  "its", "ive", "just", "lets", "may", "might", "must", "my",
  "not", "of", "on", "or", "our", "really", "shall", "she",
  "should", "so", "than", "that", "thats", "the", "their", "them",
  "then", "there", "these", "they", "this", "those", "too", "us",
  "very", "was", "we", "were", "what", "when", "where", "which",
  "who", "why", "will", "with", "wont", "would", "you", "your",
  "youre",
]);
export const ENGLISH_BEFORE = new Set<string>([
  "a", "an", "any", "each", "every", "her", "his", "its",
  "my", "no", "our", "some", "that", "the", "their", "these",
  "this", "those", "your",
]);
export const ENGLISH_AFTER = new Set<string>([
  "a", "an", "are", "for", "her", "his", "in", "is",
  "it", "my", "of", "off", "on", "our", "out", "that",
  "the", "their", "these", "this", "those", "was", "were", "with",
  "you", "your",
]);
export const POSSESSIVES = new Set<string>([
  "aapka", "aapke", "aapki", "apna", "apne", "apni", "hamara", "hamari",
  "iska", "iske", "iski", "kiska", "mera", "mere", "meri", "tera",
  "tere", "teri", "tumhara", "tumhari", "unka", "unke", "unki", "uska",
  "uske", "uski",
]);
// "Jett main", "op main": a main in a game (Valorant agents and guns, roles, games).
export const GAME_WORDS = new Set<string>([
  "adc", "apex", "astra", "awp", "awper", "bgmi", "breach", "brim",
  "brimstone", "bulldog", "chamber", "clove", "controller", "csgo", "cypher", "deadlock",
  "dps", "duelist", "entry", "fade", "flex", "fortnite", "gekko", "ghost",
  "gta", "guardian", "harbor", "healer", "igl", "initiator", "iso", "jett",
  "judge", "jungle", "kayo", "killjoy", "kj", "lurker", "marshal", "mid",
  "minecraft", "neon", "odin", "omen", "op", "operator", "outlaw", "phantom",
  "phoenix", "pubg", "raze", "reyna", "sage", "sentinel", "sheriff", "skye",
  "sniper", "sova", "spectre", "support", "tank", "tejo", "valo", "valorant",
  "vandal", "viper", "vyse", "waylay", "yoru",
]);
export const MAIN_ENGLISH_NEXT = new Set<string>([
  "acc", "account", "agent", "branch", "channel", "char", "character", "course",
  "door", "event", "gate", "hero", "id", "lobby", "menu", "page",
  "part", "point", "quest", "reason", "road", "role", "screen", "server",
  "source", "stage", "story", "street", "thing", "weapon",
]);
export const MAT_ENGLISH_BEFORE = new Set<string>([
  "bath", "big", "desk", "door", "exercise", "floor", "gaming", "mouse",
  "new", "nice", "play", "prayer", "rgb", "rubber", "table", "welcome",
  "xl", "yoga",
]);
export const RAM_BEFORE = new Set<string>([
  "hare", "jai", "jay", "ram", "shree", "shri", "siya", "sri",
]);
export const RAM_AFTER = new Set<string>([
  "ji", "ram",
]);

// New in Freetip: more everyday and stream words, only ones that are not also
// common English words (so no "band", "so", "beta", "sona").
const EXTRA: Record<string, string> = {
  // People
  "bhabhi": "भाभी", "chacha": "चाचा", "beti": "बेटी", "bachcha": "बच्चा", "bacche": "बच्चे", "launda": "लौंडा",
  "chhora": "छोरा", "bhaisaab": "भाईसाब", "bhaisahab": "भाईसाहब", "sahab": "साहब", "malik": "मालिक",
  // More pronoun forms
  "tumhare": "तुम्हारे", "hamare": "हमारे", "humare": "हमारे", "mujhse": "मुझसे", "tumse": "तुमसे",
  "usse": "उससे", "isse": "इससे", "humse": "हमसे", "aapse": "आपसे", "jisse": "जिससे", "kisse": "किससे",
  "wahi": "वही", "yahi": "यही", "sabhi": "सभी", "sabka": "सबका", "sabki": "सबकी", "sabke": "सबके",
  // Joining words
  "isliye": "इसलिए", "islie": "इसलिए", "kyuki": "क्योंकि", "kyoki": "क्योंकि", "jaise": "जैसे", "waise": "वैसे",
  "vaise": "वैसे", "aise": "ऐसे", "aisa": "ऐसा", "aisi": "ऐसी", "jaisa": "जैसा", "jaisi": "जैसी", "warna": "वरना",
  "varna": "वरना", "matlab": "मतलब", "yaani": "यानी", 
  // Verbs: doing, giving, showing
  "karenge": "करेंगे", "karungi": "करूँगी", "karega": "करेगा", "karegi": "करेगी", "karlo": "कर लो", "kardo": "कर दो",
  "kijiye": "कीजिए", "kariye": "करिए", "boliye": "बोलिए", "dijiye": "दीजिए", "lijiye": "लीजिए", "bataiye": "बताइए",
  "aaiye": "आइए", "jaiye": "जाइए", "dikha": "दिखा", "dikhao": "दिखाओ", "dikhta": "दिखता", "dikhna": "दिखना",
  "dikhega": "दिखेगा", "sunao": "सुनाओ", "chalao": "चलाओ", "chalta": "चलता", "chalti": "चलती", "chalte": "चलते",
  "rukna": "रुकना", "aajao": "आ जाओ", "lagao": "लगाओ", "lagana": "लगाना", "lagega": "लगेगा", "milega": "मिलेगा",
  "milta": "मिलता", "milti": "मिलती", "baithe": "बैठे", "baitho": "बैठो", "uthao": "उठाओ",
  "utha": "उठा", "khao": "खाओ", "khaya": "खाया", "piya": "पिया", "piyo": "पियो", "soja": "सो जा", "sojao": "सो जाओ",
  "jagna": "जागना", "khatam": "ख़त्म", "shuru": "शुरू", "chalu": "चालू", "bandh": "बंद", "intezaar": "इंतज़ार",
  "intezar": "इंतज़ार", "hoyega": "होएगा", "ruka": "रुका", "bhool": "भूल", "bhoolna": "भूलना", "yaad": "याद",
  "pasand": "पसंद", "paya": "पाया", "pao": "पाओ", "dikhai": "दिखाई", "sunai": "सुनाई", "samajhna": "समझना",
  "samjhao": "समझाओ", "samajhdaar": "समझदार", "likha": "लिखा", "likho": "लिखो", "padho": "पढ़ो", "padha": "पढ़ा",
  // Being and not (short spellings the respelling rule skips)
  "nahii": "नहीं", "nahee": "नहीं", "nhii": "नहीं", "kyaa": "क्या", "kyaaa": "क्या", "haii": "है", "haiin": "हैं",
  "haanji": "हाँ जी", 
  // Praise and feelings
  "mazedaar": "मज़ेदार", "mazedar": "मज़ेदार", "tagda": "तगड़ा", "tagdi": "तगड़ी", "tagde": "तगड़े",
  "dhansu": "धांसू", "zordaar": "ज़ोरदार", "jordaar": "ज़ोरदार", "lajawab": "लाजवाब", "laajawab": "लाजवाब",
  "behtareen": "बेहतरीन", "umda": "उम्दा", "mushkil": "मुश्किल", "aasan": "आसान", "asaan": "आसान",
  "khatra": "ख़तरा", "khoobsurat": "ख़ूबसूरत", "khubsurat": "ख़ूबसूरत", "dukh": "दुख", "gussa": "ग़ुस्सा",
  "darr": "डर", "himmat": "हिम्मत", "umeed": "उम्मीद", "ummeed": "उम्मीद", "taqat": "ताक़त", "shakti": "शक्ति",
  "kismat": "क़िस्मत", "qismat": "क़िस्मत", "naseeb": "नसीब", "mauka": "मौक़ा", "waqt": "वक़्त", "vakt": "वक़्त",
  "dua": "दुआ", "duaen": "दुआएँ", "duayein": "दुआएँ", "salaam": "सलाम", "salam": "सलाम", "alvida": "अलविदा",
  "khuda": "ख़ुदा", "sabr": "सब्र", "ijazat": "इजाज़त", "mehfil": "महफ़िल", "tareef": "तारीफ़",
  // Time and place
  "hafte": "हफ़्ते", "mahine": "महीने", "saalon": "सालों", "dopahar": "दोपहर", "savere": "सवेरे", "aajkal": "आजकल",
  "pichle": "पिछले", "agle": "अगले", "rozana": "रोज़ाना", "roz": "रोज़", "dinbhar": "दिनभर", "shehar": "शहर",
  "gaon": "गाँव", "desh": "देश", "sadak": "सड़क", "bahar": "बाहर", "andar": "अंदर", "upar": "ऊपर", "neeche": "नीचे",
  "aage": "आगे", "peeche": "पीछे", "saamne": "सामने", "paas": "पास", 
  // Stream and money
  "chanda": "चंदा", "tohfa": "तोहफ़ा", "inaam": "इनाम", "daan": "दान", "kamai": "कमाई", "khareedo": "ख़रीदो",
  "dukaan": "दुकान", "mehengai": "महँगाई", "sasta": "सस्ता", "mehenga": "महँगा", "crore": "करोड़", "karod": "करोड़",
  // Numbers
  "chaar": "चार", "chhe": "छह", "nau": "नौ", "dus": "दस", "pachaas": "पचास",
  "sattar": "सत्तर", "nabbe": "नब्बे", "pachas": "पचास",
  // Faith and festivals
  "diwali": "दिवाली", "holi": "होली", "eid": "ईद", "rakhi": "राखी", "navratri": "नवरात्रि", "ganpati": "गणपति",
  "bappa": "बप्पा", "morya": "मोरया", "krishna": "कृष्ण", "allah": "अल्लाह", "waheguru": "वाहेगुरु",
  "sitaram": "सीताराम", "jaishreeram": "जय श्री राम", "harharmahadev": "हर हर महादेव",
};

// Second expansion (2026-10-30), from test messages that showed words missing. Same
// rule as EXTRA: only words that are not also common English words. Spellings with
// a doubled vowel ("bakwaas", "sawaal") are not listed; hinglish.ts matches them to
// the single-vowel spelling.
const MORE: Record<string, string> = {
  // The "as much as" family (jitna must not become "to win")
  "jitna": "जितना", "jitni": "जितनी", "jitne": "जितने", "utna": "उतना", "utni": "उतनी", "utne": "उतने",
  "jaisa": "जैसा", "waisa": "वैसा", "waisi": "वैसी", "kuchh": "कुछ", "kuchch": "कुछ",
  // Where, when, which
  "kahin": "कहीं", "jahan": "जहाँ", "yahin": "यहीं", "wahin": "वहीं", "tabhi": "तभी", "jisko": "जिसको",
  "jisne": "जिसने", "jiska": "जिसका", "jiski": "जिसकी", "jiske": "जिसके", "kisne": "किसने",
  "inhe": "इन्हें", "unhe": "उन्हें", "inhein": "इन्हें", "unhein": "उन्हें", "inka": "इनका", "inki": "इनकी",
  "inke": "इनके", "kaunsa": "कौनसा", "kaunsi": "कौनसी", "kaunse": "कौनसे", "konsa": "कौनसा", "konsi": "कौनसी",
  "konse": "कौनसे", "bina": "बिना", "bagair": "बग़ैर", "baghair": "बग़ैर", "khilaf": "ख़िलाफ़",
  "wajah": "वजह", "beech": "बीच", "taraf": "तरफ़", "tarah": "तरह", "baare": "बारे", "kareeb": "क़रीब", "doori": "दूरी",
  // Amount and order
  "shayad": "शायद", "poora": "पूरा", "pura": "पूरा", "poori": "पूरी", "adhura": "अधूरा", "saara": "सारा",
  "saari": "सारी", "saare": "सारे", "lagbhag": "लगभग", "takriban": "तक़रीबन", "dusra": "दूसरा", "dusri": "दूसरी",
  "dusre": "दूसरे", "doosra": "दूसरा", "doosri": "दूसरी", "doosre": "दूसरे", "pehla": "पहला", "pehli": "पहली",
  "pahla": "पहला", "pahli": "पहली", "tisra": "तीसरा", "aakhri": "आख़िरी", "aakhir": "आख़िर", "pichhla": "पिछला",
  "pichhli": "पिछली", "kayi": "कई", "achanak": "अचानक", "chupchap": "चुपचाप", "chup": "चुप", "khamosh": "ख़ामोश",
  "tez": "तेज़", "seedha": "सीधा", "sidha": "सीधा", "ulta": "उल्टा", "halka": "हल्का", "garam": "गरम",
  "thanda": "ठंडा", "mitha": "मीठा", "teekha": "तीखा", "tikha": "तीखा", "alag": "अलग", "khaas": "ख़ास",
  "bemisaal": "बेमिसाल", "anokha": "अनोखा", "sachcha": "सच्चा", "saccha": "सच्चा", "jhootha": "झूठा",
  "jhooth": "झूठ", "mehnga": "महँगा", "dhamakedaar": "धमाकेदार", "bindass": "बिंदास", "faltu": "फ़ालतू",
  "jugaad": "जुगाड़", "jugad": "जुगाड़", "vasool": "वसूल", "dilchasp": "दिलचस्प", "imaandar": "ईमानदार",
  "mehnati": "मेहनती",
  // Time
  "tarikh": "तारीख़", "hafta": "हफ़्ता", "mahina": "महीना", "ghanta": "घंटा", "ghante": "घंटे", "lamha": "लम्हा",
  "samay": "समय", "turant": "तुरंत", "fauran": "फ़ौरन", "dobara": "दोबारा", "dubara": "दोबारा", "raatbhar": "रातभर",
  // People and things
  "maa": "माँ", "baap": "बाप", "dadi": "दादी", "nani": "नानी", "mausi": "मौसी", "insaan": "इंसान",
  "aurat": "औरत", "mard": "मर्द", "bachchon": "बच्चों", "bacchon": "बच्चों", "parivar": "परिवार",
  "pariwar": "परिवार", "saathi": "साथी", "dushman": "दुश्मन", "janta": "जनता", "khiladi": "खिलाड़ी",
  "haath": "हाथ", "aankh": "आँख", "aankhen": "आँखें", "dimaag": "दिमाग़", "dimag": "दिमाग़", "munh": "मुँह",
  "chehra": "चेहरा", "awaaz": "आवाज़", "awaz": "आवाज़", "aawaz": "आवाज़", "gaane": "गाने", "geet": "गीत",
  "sangeet": "संगीत", "kahani": "कहानी", "khabar": "ख़बर", "sawal": "सवाल", "jawab": "जवाब", "gaadi": "गाड़ी",
  "kamra": "कमरा", "darwaza": "दरवाज़ा", "khidki": "खिड़की", "chhat": "छत", "naukri": "नौकरी",
  "padhai": "पढ़ाई", "pariksha": "परीक्षा", "madad": "मदद", "dhoka": "धोखा", "kaand": "कांड",
  // Feelings
  "udaas": "उदास", "pareshan": "परेशान", "pareshaan": "परेशान", "khush": "ख़ुश", "naraz": "नाराज़",
  "dard": "दर्द", "aansu": "आँसू", "muskaan": "मुस्कान", "chinta": "चिंता", "ishq": "इश्क़", "yaadein": "यादें",
  "sapna": "सपना", "sapne": "सपने", "khwab": "ख़्वाब", "hosla": "हौसला", "hausla": "हौसला", "junoon": "जुनून",
  "jazba": "जज़्बा", "hasi": "हँसी", "hansi": "हँसी", "mann": "मन", "dhyan": "ध्यान",
  // Money
  "udhaar": "उधार", "kharcha": "ख़र्चा", "kharch": "ख़र्च", "bachat": "बचत", "keemat": "क़ीमत", "kimat": "क़ीमत",
  // Greetings and wishes
  "pranam": "प्रणाम", "shubh": "शुभ", "shubhkamnaye": "शुभकामनाएँ", "shubhkamnayein": "शुभकामनाएँ",
  "shubhkamna": "शुभकामना", "abhaar": "आभार", "kripya": "कृपया", "zara": "ज़रा", "jara": "ज़रा",
  "chaliye": "चलिए", "haal": "हाल",
  // Faith
  "hanuman": "हनुमान", "bajrangbali": "बजरंगबली", "ganesh": "गणेश", "shiv": "शिव", "bholenath": "भोलेनाथ",
  "durga": "दुर्गा", "lakshmi": "लक्ष्मी", "saraswati": "सरस्वती", "ganga": "गंगा", "prabhu": "प्रभु",
  "rab": "रब", "mashallah": "माशाअल्लाह", "inshallah": "इंशाअल्लाह", "alhamdulillah": "अल्हम्दुलिल्लाह",
  "subhanallah": "सुभानअल्लाह",
  // Exclamations and small words
  "arey": "अरे", "aree": "अरे", "sa": "सा", "si": "सी", "pi": "पी", "mil": "मिल", "dum": "दम",
  "har": "हर", "jo": "जो", "thak": "थक", "khud": "ख़ुद", "mastt": "मस्त", "acchha": "अच्छा", "achchha": "अच्छा",
  // Numbers
  "chhah": "छह", "gyarah": "ग्यारह", "barah": "बारह", "terah": "तेरह", "chaudah": "चौदह", "pandrah": "पंद्रह",
  "solah": "सोलह", "satrah": "सत्रह", "atharah": "अठारह", "unnis": "उन्नीस", "chalis": "चालीस", "assi": "अस्सी",
  "dedh": "डेढ़", "dhai": "ढाई", "aadha": "आधा", "aadhi": "आधी", "aadhe": "आधे",
};

// Verb forms of the irregular verbs (kar, ja, aa, de, le, ho, kah, pi, ro, so), which
// the stem endings in hinglish-verbs.ts do not cover. Weak words: converted only in a
// clause that is already Hindi, because several are English too ("jane", "jake",
// "karen", "hone", "doge").
export const WEAK_EXTRA: Record<string, string> = {
  "kehna": "कहना", "kehta": "कहता", "kehti": "कहती", "kehte": "कहते", "kehne": "कहने", "kehke": "कहके",
  "kaho": "कहो", "kahe": "कहे", "kahunga": "कहूँगा", "kahega": "कहेगा", "bolega": "बोलेगा", "bolegi": "बोलेगी",
  "karogi": "करोगी", "karein": "करें", "karen": "करें", "karun": "करूँ",
  "hone": "होने", "hoke": "होके", "hokar": "होकर", "hoge": "होगे", "hogayi": "हो गई", "hogaye": "हो गए",
  "hogyi": "हो गई", "hogye": "हो गए", "jaoge": "जाओगे", "jayega": "जाएगा", "jaega": "जाएगा",
  "jayegi": "जाएगी", "jayenge": "जाएँगे", "jaenge": "जाएँगे", "jaye": "जाए", "jaaye": "जाए", "jata": "जाता",
  "jati": "जाती", "jate": "जाते", "jaata": "जाता", "jaati": "जाती", "jaate": "जाते", "jane": "जाने",
  "jaane": "जाने", "jake": "जाके", "jakar": "जाकर", "aaoge": "आओगे", "aayega": "आएगा", "ayega": "आएगा",
  "aayegi": "आएगी", "aayenge": "आएँगे", "aata": "आता", "aati": "आती", "aane": "आने",
  "aake": "आके", "aakar": "आकर", "aaungi": "आऊँगी", "dega": "देगा", "degi": "देगी", "denge": "देंगे",
  "doge": "दोगे", "dungi": "दूँगी", "deta": "देता", "deti": "देती", "dene": "देने",
  "dekar": "देकर", "deke": "देके", "diye": "दिए", "lega": "लेगा", "legi": "लेगी", "lenge": "लेंगे",
  "loge": "लोगे", "lungi": "लूँगी", "leta": "लेता", "leti": "लेती", "lene": "लेने",
  "lekar": "लेकर", "leke": "लेके", "khaunga": "खाऊँगा", "peena": "पीना", "peeta": "पीता", "peeti": "पीती",
  "peene": "पीने", "piyega": "पिएगा", "piyenge": "पिएँगे", "piunga": "पिऊँगा",
  "pioge": "पियोगे", "rona": "रोना", "roya": "रोया", "royi": "रोई", "rone": "रोने", "soyega": "सोएगा",
  "soyegi": "सोएगी", "soyenge": "सोएँगे",
};

// Every word that is Hindi wherever it appears.
export const WORDS: Record<string, string> = { ...BASE, ...EXTRA, ...MORE };

// Respellings that would catch an English word or a common name: never generated.
export const NOT_VARIANTS = new Set<string>(["chora", "salon", "niche", "kamal"]);
