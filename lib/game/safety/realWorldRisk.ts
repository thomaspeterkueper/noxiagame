// lib/game/safety/realWorldRisk.ts
// NOXIA-SAFETY-0001 (Thomas, 05.11.2026): NOXIA darf nicht für Absprachen
// krimineller Dinge in der realen Welt genutzt werden.
//
// Reine Regeln, ohne DB. Unterscheidet Spiel und Wirklichkeit: Schmuggel auf
// dem Mars, Intrigen im Rat, ein Überfall im Roman – alles Spiel. Verdächtig
// wird es erst, wenn mehrere Merkmale zusammenkommen, die auf die reale Welt
// zeigen (reale Ware + Geldweg oder Kontakt, Gewalt + „in echt“, Annäherung an
// Minderjährige + Geheimhaltung oder Kanalwechsel).
//
// Ergebnis:
//   none    – nichts
//   watch   – einzelnes Merkmal; nur gezählt, nie lesbar
//   suspect – Merkmale kombiniert; der Ausschnitt wird für die Prüfung
//             gesichert und ist als einziger für Menschen lesbar
//
// Bewusst nicht: Nachrichten blockieren. Wer geblockt wird, lernt, wonach
// gefiltert wird. Kontaktdaten werden weiterhin in der gezeigten Fassung entfernt.

import { normalizeUtterance } from '../cognition/conversationRepeat'

export const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu
export const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\p{L}\p{N}-]+\.(?:com|de|net|org|io|me|app|gg|ly|tv)\b\S*/giu
export const PHONE = /(?:\+|00)?\d[\d\s/().-]{6,}\d/g
export const HANDLE = /(^|\s)@[\p{L}\p{N}_.]{2,}/gu
export const MESSENGER = /\b(whats\s?app|telegram|snap(chat)?|insta(gram)?|discord|tiktok|signal|skype|kik|threema|wickr)\b/i

/** Entfernt E-Mail, Links, Telefonnummern und @-Namen. */
export function stripContactData(text: string): string {
  return String(text ?? '')
    .replace(EMAIL, '[Kontakt entfernt]')
    .replace(URL, '[Link entfernt]')
    .replace(PHONE, '[Nummer entfernt]')
    .replace(HANDLE, '$1[Name entfernt]')
}

export type RiskSignal =
  | 'contact' | 'offline' | 'meetup' | 'real_goods' | 'money'
  | 'violence' | 'school' | 'minor_cue' | 'secrecy' | 'sexual' | 'abuse_material'

export type RiskLevel = 'none' | 'watch' | 'suspect'
export type RiskAssessment = { level: RiskLevel; signals: RiskSignal[]; reasons: string[] }

// Auf normalisiertem Text (klein, ae/oe/ue/ss, ohne Satzzeichen).
const PATTERNS: ReadonlyArray<[RiskSignal, RegExp]> = [
  ['offline', /\b(in echt|im echten leben|irl|real life|im realen leben|in der realitaet|in wirklichkeit treffen|offline treffen|persoenlich treffen|ausserhalb (des|vom) spiel\w*|nicht im spiel|ausserhalb von noxia)\b/],
  ['meetup', /\b(treff\w*|abhol\w*|vorbeikomm\w*|uebergabe|um \d{1,2}( uhr)?|\d{1,2} uhr|morgen abend|heute abend|heute nacht|am (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))\b/],
  ['real_goods', /\b(kokain|koks|heroin|crystal|meth|methamphetamin|amphetamin\w*|mdma|ecstasy|xtc|lsd|ketamin|fentanyl|gras|weed|hasch\w*|cannabis|pillen|pistole\w*|knarre\w*|schusswaffe\w*|munition|sprengstoff|gefaelscht\w*|ausweis\w*|fuehrerschein\w*)\b/],
  ['money', /\b(iban|paypal|bitcoin|btc|krypto\w*|crypto|gutschein\w*|paysafe\w*|bargeld|cash|ueberweis\w*|western union|bar bezahl\w*|in euro|euro)\b/],
  ['violence', /\b(umbring\w*|abstech\w*|erschiess\w*|abknall\w*|anzuend\w*|zusammenschlag\w*|vergewaltig\w*|bombe\w*|anschlag\w*|amok\w*|toete\w*|ermord\w*)\b/],
  ['school', /\b(schule|schulhof|lehrer\w*|klasse|pause|grundschule|gymnasium)\b/],
  ['minor_cue', /\b(ich bin (1[0-7]|[89])( jahre( alt)?)?|bin erst (1[0-7]|[89])|wie alt bist du|bist du (schon )?(1[0-7]|volljaehrig|minderjaehrig)|gehst du (noch )?zur schule|welche klasse|in welcher klasse)\b/],
  ['secrecy', /\b(sag (es )?niemand\w*|sags niemand\w*|erzaehl (es )?niemand\w*|nicht (deinen|deiner|den|der) (eltern|mutter|vater|mama|papa|lehrer\w*)|unser geheimnis|bleibt unter uns|loesch\w* (den|die|das) (chat|nachricht\w*|verlauf))\b/],
  ['sexual', /\b(nackt\w*|nacktbild\w*|nacktfoto\w*|foto von dir|bild von dir|bilder von dir|fotos von dir|schick mir (ein )?(bild|foto|bilder|fotos)|sex\w*)\b/],
  ['abuse_material', /\b(kinderporn\w*|missbrauchsdarstell\w*|missbrauchsabbild\w*)\b/],
]

/** Bewertet einen Text oder ein Gesprächsfenster (mehrere Zeilen zusammen). */
export function assessRealWorldRisk(input: string | string[]): RiskAssessment {
  const raw = Array.isArray(input) ? input.join('\n') : String(input ?? '')
  const signals = new Set<RiskSignal>()
  if (stripContactData(raw) !== raw || MESSENGER.test(raw)) signals.add('contact')
  const norm = normalizeUtterance(raw)
  for (const [signal, pattern] of PATTERNS) if (pattern.test(norm)) signals.add(signal)

  const has = (s: RiskSignal) => signals.has(s)
  const reasons: string[] = []
  if (has('abuse_material')) reasons.push('Missbrauchsdarstellungen')
  if (has('real_goods') && (has('money') || has('contact') || has('offline'))) reasons.push('reale Ware mit Geldweg, Kontakt oder Realbezug')
  if (has('violence') && (has('offline') || has('school') || has('meetup'))) reasons.push('Gewalt mit Realbezug')
  if (has('minor_cue') && (has('secrecy') || has('contact') || has('sexual'))) reasons.push('Minderjährige mit Geheimhaltung, Kanalwechsel oder sexuellem Bezug')
  if (has('secrecy') && has('sexual')) reasons.push('Geheimhaltung mit sexuellem Bezug')
  if (has('secrecy') && has('contact') && has('offline')) reasons.push('Geheimes Treffen außerhalb des Spiels')

  const list = [...signals]
  return { level: reasons.length ? 'suspect' : list.length ? 'watch' : 'none', signals: list, reasons }
}

/** Kennzeichen für Protokolle: Merkmale und Stufe, nie Wortlaut. */
export function riskFlags(assessment: RiskAssessment): string[] {
  if (assessment.level === 'none') return []
  return [...assessment.signals.map(s => 'risk:' + s), 'risk:' + assessment.level]
}
