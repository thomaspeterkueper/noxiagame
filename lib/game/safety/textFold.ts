// lib/game/safety/textFold.ts
// NOXIA-SAFETY-0001: Text für den Schutzfilter vereinheitlichen – in allen
// Schriften. Anders als normalizeUtterance (nur a–z) bleiben kyrillische,
// arabische, griechische usw. Buchstaben erhalten.
//
// Außerdem werden typische Tarnungen aufgelöst:
//  * Ähnlich aussehende Zeichen aus anderen Schriften in lateinischen Wörtern
//    (kyrillisches „о“ in „kоks“), Vollbreite-Zeichen, Zierschriften
//  * Ziffern-Ersatz in Wörtern („k0k5“ → „koks“)
//  * Trennzeichen in Wörtern („k.o.k.s“, „k o k s“ bleibt erkennbar über squash)
//  * ausgeschriebene Ziffern und „at/punkt“ für Kontaktdaten

// Kyrillisch/Griechisch → Lateinisch, nur für gemischte Wörter.
const HOMOGLYPHS: Record<string, string> = {
  'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's',
  'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x',
}
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' }
const LATIN_EXTRA: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'ı': 'i', 'ł': 'l', 'đ': 'd', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'þ': 'th' }

const isLatin = (ch: string) => /\p{Script=Latin}/u.test(ch)
const isLetter = (ch: string) => /\p{L}/u.test(ch)

function foldWord(word: string): string {
  const letters = [...word].filter(isLetter)
  const hasLatin = letters.some(isLatin)
  const hasOther = letters.some(ch => !isLatin(ch))
  const digitsInside = /\p{L}[0-9@$!]+\p{L}|\p{L}{2,}[0-9]\b|^[0-9][\p{L}]{2,}/u.test(word)
  let out = ''
  for (const ch of word) {
    if (hasLatin && hasOther && HOMOGLYPHS[ch]) out += HOMOGLYPHS[ch]
    else if (digitsInside && hasLatin && LEET[ch]) out += LEET[ch]
    else out += ch
  }
  return out
}

/** Kleinschreibung, Akzente weg, Tarnungen aufgelöst, alle Schriften erhalten. */
export function foldForScreening(text: string): string {
  let s = String(text ?? '').normalize('NFKC').toLowerCase()
  s = s.replace(/[äöüßıłđøæœþ]/g, ch => LATIN_EXTRA[ch] ?? ch)
  s = s.split(/\s+/).map(foldWord).join(' ')
  // Akzente entfernen, aber arabische/kyrillische Zeichen nicht zerlegen
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').normalize('NFC')
  // Arabisch: Vokalzeichen und Tatweel entfernen, Alif-Formen und Ya vereinheitlichen
  s = s.replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
  // Trennzeichen zwischen einzelnen Buchstaben auflösen: „k.o.k.s“, „k-o-k-s“
  s = s.replace(/(?<![\p{L}\p{N}])(?:\p{L}[._\-*·]){2,}\p{L}(?![\p{L}\p{N}])/gu, m => m.replace(/[._\-*·]/g, ''))
  return s.replace(/[^\p{L}\p{N}€$£₺₽ ]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Buchstaben einzeln geschrieben („k o k s“) zusammengezogen – zusätzlich prüfen. */
export function squashSpacedLetters(folded: string): string {
  return folded.replace(/(?<![\p{L}\p{N}])(?:\p{L} ){2,}\p{L}(?![\p{L}\p{N}])/gu, m => m.replace(/ /g, ''))
}

const NUMBER_WORDS: Record<string, string> = {
  null: '0', eins: '1', ein: '1', zwei: '2', zwo: '2', drei: '3', vier: '4', fuenf: '5', sechs: '6', sieben: '7', acht: '8', neun: '9',
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  sifir: '0', bir: '1', iki: '2', uc: '3', dort: '4', bes: '5', alti: '6', yedi: '7', sekiz: '8', dokuz: '9',
}

/**
 * Für die Kontaktsuche: ausgeschriebene Ziffern, „at“/„punkt“ und getrennte
 * Ziffern zusammenführen. Ergebnis nur zum Prüfen, nie zum Anzeigen.
 */
export function revealContacts(text: string): string {
  let s = foldForScreening(text)
  s = s.split(' ').map(w => NUMBER_WORDS[w] ?? w).join(' ')
  s = s.replace(/(?<=\d) (?=\d)/g, '')
  s = s.replace(/ (?:at|aet|aett|klammeraffe|et|sobaka|собака) /g, '@').replace(/ (?:punkt|dot|nokta|tochka|точка|kropka|punto|point) /g, '.')
  s = s.replace(/ (?=(?:gmail|gmx|web|yahoo|hotmail|outlook|icloud|proton|mail|yandex|t-online)\b)/g, '@')
  return s
}
