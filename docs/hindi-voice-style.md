# Hindi Voice Style Guide

## Purpose
All Hindi guide lines spoken by the character guide (Astro / Nova) must follow this style.
Lines are authored in Devanagari, written as **natural spoken Hindi for children aged 4–8**,
warm, short (≤ 10 words where possible), and encouraging.

---

## Core principles

1. **Real Hindi words first.** Use the Hindi word whenever a natural one exists.
   - "शाबाश" (not "ब्रावो"), "कोशिश करो" (not "ट्राय करो"), "वापस" (not "बैक")
2. **Loanwords in Devanagari for tech/game terms.** English game-domain words that
   children hear daily are spelled in Devanagari so the hi-IN TTS voice says them correctly.
3. **Latin placeholders only.** `{{name}}`, `{{n}}`, `{{level}}`, `{{count}}` etc.
   remain as-is; the TTS engine reads them as the substituted value.
4. **No romanised "Hinglish" text.** Never write Latin letters inside a Hindi string
   (except placeholders).
5. **Digits stay Latin (0–9)** in UI strings for math clarity; number words are used
   in spoken-only guide lines where the TTS should say the word, e.g. "आठ सेकंड".

---

## Loanword glossary (English → Devanagari spelling used in all Hindi strings)

| English term | Devanagari spelling | Notes |
|---|---|---|
| game | गेम | |
| level | लेवल | |
| star(s) | तारा / तारे | use real Hindi; avoid "स्टार" |
| points | अंक | use real Hindi |
| galaxy | गैलेक्सी | |
| rocket | रॉकेट | |
| hint | संकेत | use real Hindi |
| mic / microphone | माइक | |
| timer | टाइमर | |
| score | अंक | use real Hindi |
| crystal | क्रिस्टल | |
| bubble | बुलबुला | use real Hindi |
| portal | पोर्टल | |
| shop | शॉप | |
| theme | थीम | |
| planet | ग्रह | use real Hindi |
| orbit | ऑर्बिट | |
| dashboard | डैशबोर्ड | |
| avatar | अवतार | |
| guide | गाइड | |
| phase | चरण | use real Hindi |

---

## Voice selection (useSpeechSynthesis.ts)

Priority order for Hindi:
1. Exact `hi-IN` voice (Google Hindi India, Microsoft Swara)
2. Google/Microsoft `hi-*` voice
3. Any `hi-*` voice

Priority order for English:
1. Exact `en-IN` voice (most natural for Indian children)
2. `en-US`
3. `en-GB`
4. Any `en-*` voice

---

## Style examples

| Context | English | Hindi |
|---|---|---|
| Dashboard intro | "Hi {{name}}! Pick a game and let's explore the galaxy together!" | "नमस्ते {{name}}! एक गेम चुनो और साथ में गैलेक्सी की सैर करते हैं!" |
| Correct answer | "Well done!" | "शाबाश!" |
| Try again | "Try again!" | "फिर कोशिश करो!" |
| Level complete | "Excellent! Level complete!" | "शानदार! लेवल पूरा!" |
| Time's up | "Time's up!" | "समय खत्म!" |
| Wrong direction | "Oops! Can't go there." | "उफ़! वहाँ नहीं जा सकते।" |
| Went left | "You went left!" | "तुम बाईं गए!" |
| Shop success | "Amazing! You unlocked {{name}}!" | "कमाल! तुमने {{name}} अनलॉक किया!" |
| Stars page | "You have {{n}} stars!" | "तुम्हारे पास {{n}} तारे हैं!" |

---

## SPEAK_MIXED_SEGMENTS (default: false)

When `false` (default): a single `hi-IN` utterance is used for the entire Hindi line,
including any English loanwords spelled in Devanagari. The hi-IN voice reads them with
acceptable Hindi pronunciation.

When `true`: the line would be split into Devanagari runs and Latin runs, and Latin words
would be queued as separate `en-IN` utterances. This gives better pronunciation of mixed
text but introduces audible pauses between segments. **Leave as `false` unless a native
speaker confirms the pauses are acceptable.**

See `useSpeechSynthesis.ts` for implementation details.

---

## Native-speaker review checklist

- [ ] All guide lines in `i18n/hi/child.json` reviewed for naturalness
- [ ] All guide lines in `i18n/hi/parent.json` reviewed for naturalness
- [ ] Loanword Devanagari spellings confirmed with a native Hindi speaker
- [ ] Number words in spoken lines confirmed (e.g. "आठ सेकंड" for "8 seconds")
- [ ] Child name pronunciation: Latin names are read as written by hi-IN TTS (acceptable);
      parents may provide a Devanagari "spoken name" in the child profile for better pronunciation
