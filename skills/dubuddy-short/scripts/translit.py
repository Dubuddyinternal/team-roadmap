"""Devanagari -> natural Hinglish (Roman) fallback, used only for words missing from
glossary.json. Output is a best guess (schwa deletion, 'aa'/'ee' vowels) that Claude
reviews in the brief — correct spellings get saved back to the glossary."""
import re

DEVA = re.compile(r"[ऀ-ॿ]")

CONS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h", "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "d", "ढ़": "rh", "फ़": "f", "य़": "y",
}
NUKTA_BASE = {"क": "क़", "ख": "ख़", "ग": "ग़", "ज": "ज़", "ड": "ड़", "ढ": "ढ़", "फ": "फ़", "य": "य़"}
VOWELS = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o"}
MATRA = {"ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o"}
HALANT, NUKTA, ANUS, CHANDRA, VISARGA = "्", "़", "ं", "ँ", "ः"
DIGITS = {chr(0x0966 + i): str(i) for i in range(10)}


def translit(word: str) -> str:
    chars = list(word)
    # fold nukta into precomposed consonant
    folded = []
    for c in chars:
        if c == NUKTA and folded and folded[-1] in NUKTA_BASE:
            folded[-1] = NUKTA_BASE[folded[-1]]
        else:
            folded.append(c)
    out, i, n = [], 0, len(folded)
    while i < n:
        c = folded[i]
        nxt = folded[i + 1] if i + 1 < n else ""
        if c in CONS:
            out.append(CONS[c])
            if nxt in MATRA:
                out.append(MATRA[nxt]); i += 2; continue
            if nxt == HALANT:
                i += 2; continue
            # inherent schwa: drop at word end and before a following vowel-bearing consonant
            # when the consonant after that ends the word (e.g. समझ -> samajh, कर -> kar)
            out.append("a" if i + 1 < n else "")
            i += 1; continue
        if c in VOWELS:
            out.append(VOWELS[c])
        elif c in (ANUS, CHANDRA):
            out.append("n")
        elif c == VISARGA:
            out.append("h")
        elif c in DIGITS:
            out.append(DIGITS[c])
        elif c in MATRA or c in (HALANT, NUKTA):
            pass
        else:
            out.append(c)
        i += 1
    s = "".join(out)
    # medial schwa deletion heuristic: CVCaCV -> CVCCV (e.g. 'samajhana' -> 'samajhna')
    s = re.sub(r"([aeiou][bcdfghjklmnpqrstvwxyz]+)a([bcdfghjklmnpqrstvwxyz][aeiou])$", r"\1\2", s)
    s = s.replace("aa", "a") if len(s) > 6 else s
    return s.replace("v", "w") if s.startswith("v") and len(s) <= 3 else s


def has_deva(s: str) -> bool:
    return bool(DEVA.search(s))
