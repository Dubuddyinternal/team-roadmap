/* =====================================================================
   HINGLISH: Devanagari → natural Hinglish (Roman), for the 🎤 mic.
   1. glossary words (copied from the dubuddy-short skill's glossary.json:
      "fix" for brand / exam names, "hinglish" for common Hindi words)
   2. English words people say in Hindi (कॉलेज → college …)
   3. a letter-by-letter fallback (the skill's translit.py, in JavaScript)
   To refresh the glossary part, re-copy glossary.json's fix/hinglish here.
   ===================================================================== */
(function(){
"use strict";
const G = {"fix": {"cet": "CUET", "cuet": "CUET", "q-et": "CUET", "क्यूट": "CUET", "सीयूईटी": "CUET", "du": "DU", "dubuddy": "Dubuddy", "dubadi": "Dubuddy", "dubaddy": "Dubuddy", "ncert": "NCERT", "एनसीईआरटी": "NCERT", "pyq": "PYQ", "pyqs": "PYQs", "पीवाईक्यू": "PYQ", "nta": "NTA", "srcc": "SRCC", "ug": "UG", "12th": "12th", "twelfth": "12th", "tenth": "10th", "cut": "CUET", "cuet's": "CUET's"}, "hinglish": {"है": "hai", "हैं": "hain", "था": "tha", "थी": "thi", "थे": "the", "हो": "ho", "होता": "hota", "होती": "hoti", "होते": "hote", "होगा": "hoga", "होगी": "hogi", "होंगे": "honge", "हुआ": "hua", "हुई": "hui", "क्या": "kya", "क्यों": "kyun", "कैसे": "kaise", "कब": "kab", "कहाँ": "kahan", "कहां": "kahan", "कौन": "kaun", "कितना": "kitna", "कितने": "kitne", "कितनी": "kitni", "नहीं": "nahi", "ना": "na", "न": "na", "हाँ": "haan", "हां": "haan", "भी": "bhi", "ही": "hi", "तो": "toh", "और": "aur", "या": "ya", "पर": "par", "लेकिन": "lekin", "अगर": "agar", "मतलब": "matlab", "यानी": "yaani", "बस": "bas", "सिर्फ": "sirf", "सिर्फ़": "sirf", "मैं": "main", "में": "mein", "मुझे": "mujhe", "मेरा": "mera", "मेरी": "meri", "मेरे": "mere", "हम": "hum", "हमें": "humein", "हमारा": "humara", "आप": "aap", "आपको": "aapko", "आपका": "aapka", "आपकी": "aapki", "आपके": "aapke", "आपने": "aapne", "तुम": "tum", "तुम्हें": "tumhe", "तुम्हारा": "tumhara", "यह": "yeh", "ये": "ye", "वह": "woh", "वो": "wo", "इस": "is", "उस": "us", "इसमें": "isme", "उसमें": "usme", "इसको": "isko", "उसको": "usko", "इसके": "iske", "उसके": "uske", "इसका": "iska", "उसका": "uska", "इनका": "inka", "उनका": "unka", "उन्हें": "unhe", "का": "ka", "की": "ki", "के": "ke", "को": "ko", "से": "se", "ने": "ne", "तक": "tak", "लिए": "liye", "साथ": "saath", "बाद": "baad", "पहले": "pehle", "अंदर": "andar", "बाहर": "bahar", "ऊपर": "upar", "नीचे": "neeche", "कर": "kar", "करो": "karo", "करना": "karna", "करने": "karne", "करते": "karte", "करता": "karta", "करती": "karti", "करेंगे": "karenge", "करें": "karein", "किया": "kiya", "रहा": "raha", "रही": "rahi", "रहे": "rahe", "गया": "gaya", "गई": "gayi", "गए": "gaye", "जाता": "jaata", "जाती": "jaati", "जाते": "jaate", "जाएगा": "jaayega", "जाएगी": "jaayegi", "जाओ": "jao", "जाना": "jaana", "सकता": "sakta", "सकती": "sakti", "सकते": "sakte", "चाहिए": "chahiye", "मिलेगा": "milega", "मिलेगी": "milegi", "मिलते": "milte", "मिल": "mil", "देना": "dena", "दो": "do", "दे": "de", "लो": "lo", "ले": "le", "लेना": "lena", "देखो": "dekho", "देखिए": "dekhiye", "बताओ": "batao", "बताता": "batata", "बताती": "batati", "बताऊं": "bataun", "बताता हूं": "batata hoon", "हूं": "hoon", "हूँ": "hoon", "अच्छा": "accha", "अच्छे": "acche", "अच्छी": "acchi", "बहुत": "bahut", "ज्यादा": "zyada", "ज़्यादा": "zyada", "कम": "kam", "सब": "sab", "सारे": "saare", "सारी": "saari", "कुछ": "kuch", "कोई": "koi", "एक": "ek", "दोनों": "dono", "अब": "ab", "फिर": "phir", "जब": "jab", "तब": "tab", "आज": "aaj", "कल": "kal", "साल": "saal", "दिन": "din", "टाइम": "time", "समय": "samay", "बात": "baat", "चीज़": "cheez", "चीज": "cheez", "तरह": "tarah", "सवाल": "sawaal", "जवाब": "jawaab", "पेपर": "paper", "पेपर्स": "papers", "एग्जाम": "exam", "एग्ज़ाम": "exam", "कॉलेज": "college", "यूनिवर्सिटी": "university", "सिलेबस": "syllabus", "मार्क्स": "marks", "नंबर": "number", "रिजल्ट": "result", "सब्जेक्ट": "subject", "सब्जेक्ट्स": "subjects", "पढ़ाई": "padhai", "पढ़ो": "padho", "पढ़ना": "padhna", "तैयारी": "taiyaari", "बच्चे": "bacche", "बच्चों": "bacchon", "स्टूडेंट्स": "students", "स्टूडेंट": "student", "ठीक": "theek", "सही": "sahi", "गलत": "galat", "ज़रूरी": "zaroori", "जरूरी": "zaroori", "आसान": "aasaan", "मुश्किल": "mushkil", "पूरा": "poora", "पूरी": "poori", "पूरे": "poore", "वाला": "wala", "वाली": "wali", "वाले": "wale", "जो": "jo", "जैसे": "jaise", "वैसे": "waise", "ऐसे": "aise", "इसलिए": "isliye", "क्योंकि": "kyunki", "चलो": "chalo", "पड़ेगा": "padega", "पड़ेगी": "padegi", "पड़ता": "padta", "सबसे": "sabse", "कि": "ki", "किसी": "kisi", "उसी": "usi", "इसी": "isi", "पे": "pe", "जितने": "jitne", "जितना": "jitna", "पूछे": "pooche", "पूछा": "poocha", "ताकि": "taaki", "जाए": "jaaye", "जाएं": "jaayen", "पास": "paas", "जा": "ja", "चुके": "chuke", "चुका": "chuka", "लगता": "lagta", "लगेगा": "lagega", "समझो": "samjho", "समझ": "samajh", "बोलो": "bolo", "मानो": "maano", "बढ़िया": "badhiya", "याद": "yaad", "रखो": "rakho", "रखना": "rakhna", "तीन": "teen", "काफी": "kaafi", "होएगी": "hogi", "पांच": "paanch", "पहला": "pehla", "पढ़ता": "padhta", "साथ-साथ": "saath-saath", "तीसरी": "teesri", "पढ़": "padh", "भागता": "bhaagta", "एक-दो": "ek-do", "गलतियों": "galtiyon", "सीखते": "seekhte", "आएगा": "aayega", "बढ़": "badh", "पांचवी": "paanchvi", "अलग-अलग": "alag-alag", "दूसरे": "doosre", "भाई": "bhai", "समझना": "samajhna", "अभी": "abhi", "किस": "kis", "उसकी": "uski", "जिससे": "jisse", "मिलता": "milta", "सा": "sa", "लाई": "laayi", "जिस": "jis", "करके": "karke", "चीजों": "cheezon", "अपनी": "apni", "बनाओ": "banao"}, "loan": {"कॉलेज": "college", "कालेज": "college", "यूनिवर्सिटी": "university", "एडमिशन": "admission", "फॉर्म": "form", "फार्म": "form", "कटऑफ": "cutoff", "कट": "cut", "ऑफ": "off", "एग्जाम": "exam", "एग्ज़ाम": "exam", "परीक्षा": "pariksha", "सब्जेक्ट": "subject", "सब्जेक्ट्स": "subjects", "स्टूडेंट": "student", "स्टूडेंट्स": "students", "कोर्स": "course", "मार्क्स": "marks", "रिजल्ट": "result", "रिज़ल्ट": "result", "सीट": "seat", "सीट्स": "seats", "डेट": "date", "लास्ट": "last", "फर्स्ट": "first", "सेकंड": "second", "बीकॉम": "BCom", "बी.कॉम": "BCom", "बीए": "BA", "बीएससी": "BSc", "होस्टल": "hostel", "हॉस्टल": "hostel", "पीजी": "PG", "फीस": "fees", "नॉर्थ": "North", "साउथ": "South", "कैंपस": "campus", "ऑनलाइन": "online", "ऑफलाइन": "offline", "वीडियो": "video", "चैनल": "channel", "सब्सक्राइब": "subscribe", "फॉलो": "follow", "कमेंट": "comment", "कमेंट्स": "comments", "लिंक": "link", "अप्लाई": "apply", "डाउनलोड": "download", "नोट्स": "notes", "सिलेबस": "syllabus", "पेपर": "paper", "टेस्ट": "test", "मॉक": "mock", "रैंक": "rank", "ऑप्शन": "option", "प्रेफरेंस": "preference", "राउंड": "round", "लिस्ट": "list", "अपडेट": "update", "अपडेट्स": "updates", "इंपॉर्टेंट": "important", "इम्पोर्टेन्ट": "important", "टिप्स": "tips", "टॉपिक": "topic", "क्वेश्चन": "question", "क्वेश्चंस": "questions", "आंसर": "answer", "प्रॉब्लम": "problem", "सॉल्यूशन": "solution", "स्ट्रेटजी": "strategy", "टाइम": "time", "टाइमटेबल": "timetable", "प्लान": "plan", "प्लानिंग": "planning", "स्कोर": "score", "परसेंटाइल": "percentile", "परसेंट": "percent", "नंबर": "number", "डॉक्यूमेंट": "document", "डॉक्यूमेंट्स": "documents", "वेरिफिकेशन": "verification", "रजिस्ट्रेशन": "registration", "पोर्टल": "portal", "वेबसाइट": "website", "ऐप": "app", "एप": "app", "शॉर्ट": "short", "शॉर्ट्स": "shorts", "रील": "reel", "रील्स": "reels", "पोस्ट": "post", "ब्रांच": "branch", "डिपार्टमेंट": "department", "प्लेसमेंट": "placement", "कंप्यूटर": "computer", "इंग्लिश": "English", "हिंदी": "Hindi", "इकोनॉमिक्स": "Economics", "पॉलिटिकल": "Political", "साइंस": "Science", "हिस्ट्री": "History", "मैथ्स": "Maths", "अकाउंटेंसी": "Accountancy", "बिजनेस": "Business", "डेल्ही": "Delhi", "दिल्ली": "Delhi", "इवनिंग": "evening", "मॉर्निंग": "morning", "सेशन": "session", "क्लास": "class", "क्लासेस": "classes", "टीचर": "teacher", "सर": "sir", "मैम": "ma'am", "गाइड": "guide", "गाइडेंस": "guidance", "हेल्प": "help", "ग्रुप": "group", "व्हाट्सएप": "WhatsApp", "इंस्टाग्राम": "Instagram", "यूट्यूब": "YouTube", "डीयू": "DU", "एसआरसीसी": "SRCC", "सीयूईटी": "CUET", "एनटीए": "NTA", "यूजी": "UG", "पीजीडीएवी": "PGDAV", "रामजस": "Ramjas", "हिंदू": "Hindu", "मिरांडा": "Miranda", "किरोड़ीमल": "Kirori Mal"}};
const FIX = {}; Object.keys(G.fix).forEach(k => { FIX[k.toLowerCase()] = G.fix[k]; });
// what Whisper tends to mishear in Dubuddy talk
Object.assign(FIX, { "coet":"CUET","cuat":"CUET","quet":"CUET","kuet":"CUET","कत्वाप":"cutoff","कटाफ":"cutoff","कटॉफ":"cutoff","कट-ऑफ":"cutoff",
  "srcc":"SRCC","एसआरसीसी":"SRCC","d.u.":"DU","डी.यू.":"DU","बी.कॉम":"BCom","b.com":"BCom","bcom":"BCom" });
const WORDS = Object.assign({}, G.hinglish, G.loan);
const CONS = { "क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"n","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"n","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n",
  "त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h",
  "क़":"q","ख़":"kh","ग़":"g","ज़":"z","ड़":"d","ढ़":"rh","फ़":"f","य़":"y" };
const NUKTA_BASE = { "क":"क़","ख":"ख़","ग":"ग़","ज":"ज़","ड":"ड़","ढ":"ढ़","फ":"फ़","य":"य़" };
const VOWELS = { "अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au","ऑ":"o" };
const MATRA = { "ा":"a","ि":"i","ी":"i","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au","ॉ":"o" };
const HALANT = "्", NUKTA = "़", ANUS = "ं", CHANDRA = "ँ", VISARGA = "ः";
const DEVA = /[\u0900-\u097F]/;

function letters(word){
  const folded = [];
  for(const c of word){ if(c === NUKTA && folded.length && NUKTA_BASE[folded[folded.length-1]]) folded[folded.length-1] = NUKTA_BASE[folded[folded.length-1]]; else folded.push(c); }
  let out = "";
  for(let i = 0; i < folded.length; i++){
    const c = folded[i], nxt = folded[i+1] || "";
    if(CONS[c]){ out += CONS[c];
      if(MATRA[nxt]){ out += MATRA[nxt]; i++; continue; }
      if(nxt === HALANT){ i++; continue; }
      out += i + 1 < folded.length ? "a" : ""; continue; }
    if(VOWELS[c]) out += VOWELS[c];
    else if(c === ANUS || c === CHANDRA) out += "n";
    else if(c === VISARGA) out += "h";
    else if(c >= "०" && c <= "९") out += String(c.charCodeAt(0) - 0x0966);
    else if(MATRA[c] || c === HALANT || c === NUKTA) {}
    else out += c;
  }
  out = out.replace(/([aeiou][bcdfghjklmnpqrstvwxyz]+)a([bcdfghjklmnpqrstvwxyz][aeiou])$/, "$1$2");
  if(out.length > 6) out = out.replace(/aa/g, "a");
  return out;
}
function word(w){
  const m = /^([^\u0900-\u097FA-Za-z0-9]*)(.*?)([^\u0900-\u097FA-Za-z0-9]*)$/.exec(w);   // keep punctuation around the word
  const [, pre, core, post] = m || ["", "", w, ""];
  if(!core) return w;
  const low = core.toLowerCase();
  if(FIX[low]) return pre + FIX[low] + post;
  if(!DEVA.test(core)) return w;
  return pre + (WORDS[core] || letters(core)) + post;
}
function toHinglish(text){
  return String(text || "").replace(/।/g, ".").split(/(\s+)/).map(p => /\s/.test(p) ? p : word(p)).join("")
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}
window.HINGLISH = { toHinglish };
})();
