// lib/game/safety/personalData.ts
// Thomas, 06.11.2026: „Persönliche Daten von Spielern sollten möglichst überall
// geixxt sein, genauso E-Mail-Adressen oder anderes, was zu leicht auf Herkunft
// schließen lässt.“
//
// Eine Maskierung für alle Stellen, an denen Spieler frei schreiben: Raum-Chat,
// Freundes-Chat, NPC-Gespräche (vor KI-Dienst, Protokoll, Gedächtnis), Meldungen.
// Freie Namensfelder maskiert zusätzlich die Datenbank (mask_personal_data).
//
// Ersetzt wird durch „xxx“. Was bleibt: Spielwelt-Orte, Spielnamen, Credits.
// Bewusst nicht maskiert: „ich heiße …“ – damit merken sich Figuren den
// Spielnamen (R-12). Maskiert wird aber „mein echter/richtiger Name …“.

export const MASK = 'xxx'

export const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu
export const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|de|net|org|io|me|app|gg|ly|tv|at|ch|eu|info|biz|ru|tr|pl|fr|es|it|nl|uk|co)\b(?:\/\S*)?/giu
// Telefon: mit +/00 oder führender 0 und mindestens 8 Ziffern – nicht „1.500.000 Credits“.
export const PHONE = /(?:\+|\b00)\d[\d\s/().-]{6,}\d|\b0\d{2,5}[\s/.-]?\d{3,}(?:[\s.-]?\d+)*/g
export const HANDLE = /(^|\s)@[\p{L}\p{N}_.]{2,}/gu
export const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/gi
export const CARD = /\b(?:\d{4}[\s-]?){3}\d{1,7}\b/g

// Selbstauskünfte, die auf Person oder Herkunft schließen lassen.
const SELF_DISCLOSURE: ReadonlyArray<RegExp> = [
  // Wohnort/Adresse
  /\b((?:ich )?wohne (?:in der |in |an der |am |im )|meine adresse(?: ist|:)?|wir wohnen (?:in der |in |am |im )|i live (?:at|on|in)|my address(?: is|:)?|adresim|adresim:|мой адрес|я живу (?:на|в)|عنواني|mieszkam (?:na|w)|vivo en (?:la |el )?|mi direcci[oó]n(?: es)?|j'?habite (?:au |à |a |rue )|mon adresse(?: est)?)\s*([^.!?\n]{2,60})/giu,
  // Geburtsdatum
  /\b(geboren am|geb\.|mein geburtstag ist(?: am)?|born on|my birthday is|doğum tarihim|я родил(?:ся|ась)|urodziłe[mś] się|nac[ií] el|je suis n[ée]e? le)\s*([0-9]{1,2}[./ -][0-9]{1,2}[./ -](?:19|20)?[0-9]{2}|[0-9]{1,2}\.? \p{L}+ (?:19|20)[0-9]{2})/giu,
  // echter Name
  /\b(mein (?:echter|richtiger|realer|voller) name(?: ist|:)?|mein nachname(?: ist|:)?|ich hei(?:ß|ss)e (?:eigentlich|in echt|im echten leben)|my (?:real|full|last) name(?: is|:)?|ger[çc]ek ad[ıi]m|моё настоящее имя|мое настоящее имя|moje prawdziwe imi[eę]|mi nombre real(?: es)?|mon vrai nom(?: est)?)\s*((?:\p{L}+[ -]?){1,3})/giu,
  // Schule (verrät Wohnort)
  /\b(ich gehe (?:auf|in) (?:die|das|den)|meine schule ist|wir sind auf (?:der|dem)|i go to|my school is|okulum)\s*((?:\p{L}+[ -]?){1,4}(?:schule|gymnasium|realschule|gesamtschule|school|academy|okulu)\b(?:\s+\p{L}+)?)/giu,
]
// Postleitzahl vor einem Ortsnamen (nur die Zahl wird maskiert).
const POSTCODE = /\b\d{5}(?=\s+\p{Lu}\p{Ll}+)/gu

/** Nur Kontaktdaten (E-Mail, Links, Telefon, @-Namen, IBAN, Kartennummern). */
export function stripContactData(text: string): string {
  return String(text ?? '')
    .replace(EMAIL, MASK)
    .replace(URL, MASK)
    .replace(IBAN, MASK)
    .replace(CARD, MASK)
    .replace(PHONE, MASK)
    .replace(HANDLE, `$1@${MASK}`)
}

/** Kontaktdaten plus Selbstauskünfte zu Adresse, Geburtsdatum, echtem Namen, Schule, PLZ. */
export function maskPersonalData(text: string): string {
  let s = stripContactData(text)
  for (const re of SELF_DISCLOSURE) s = s.replace(re, (_m, lead: string) => `${lead.trimEnd()} ${MASK}`)
  return s.replace(POSTCODE, MASK)
}

export const containsMask = (text: string) => /(?:^|[^\p{L}])xxx(?:[^\p{L}]|$)/u.test(String(text ?? ''))
