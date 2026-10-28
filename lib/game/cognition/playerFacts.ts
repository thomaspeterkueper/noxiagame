// lib/game/cognition/playerFacts.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Was eine Figur aus dem Gespräch sicher lernen darf: Name des Spielers, eigenes Alter genannt (R-11, R-12)
// Version:      1.0.0
//
// Rein, ohne DB. Feste Muster statt Sprachmodell: Gelernt wird nur, was
// eindeutig gesagt wurde. Im Zweifel nichts.

/** Wörter, die nach „ich bin …“ kein Name sind. */
const NOT_NAMES = new Set([
  'neu', 'hier', 'da', 'nicht', 'auch', 'noch', 'gerade', 'schon', 'nur', 'ein', 'eine', 'der', 'die', 'das',
  'müde', 'hungrig', 'durstig', 'froh', 'gut', 'okay', 'ok', 'fertig', 'bereit', 'unterwegs', 'zurück', 'wieder',
  'spieler', 'student', 'studentin', 'pilot', 'pilotin', 'händler', 'händlerin', 'kein', 'keine', 'so', 'sehr',
  'aus', 'bei', 'im', 'in', 'am', 'von', 'zu', 'mit', 'dein', 'deine', 'sein', 'ihr', 'jetzt', 'heute', 'oft', 'selten',
  'und', 'aber', 'oder', 'denn', 'wer', 'wie', 'was', 'ja',
])

/** Füllwörter zwischen Verb und Name: „ich heiße übrigens Thomas“. */
const FILLER = /^(?:übrigens|uebrigens|eigentlich|einfach|ja|doch|halt|nur|bitte)\s+/iu

function cleanName(raw: string): string | null {
  let name = raw.replace(/[^\p{L}\p{M}' -]/gu, '').trim().replace(/\s+/g, ' ')
  while (FILLER.test(name)) name = name.replace(FILLER, '')
  const words = name.split(' ').filter(Boolean)
  // Angehängte Wörter wie „und“ gehören nicht zum Namen.
  while (words.length > 1 && NOT_NAMES.has(words[words.length - 1].toLocaleLowerCase('de-DE'))) words.pop()
  name = words.join(' ')
  if (name.length < 2 || name.length > 32 || words.length === 0) return null
  if (words.length > 3) return null
  if (NOT_NAMES.has(words[0].toLocaleLowerCase('de-DE'))) return null
  // Ein Name beginnt groß – oder der Spieler schreibt alles klein; dann großschreiben.
  return words.map(w => w.charAt(0).toLocaleUpperCase('de-DE') + w.slice(1)).join(' ')
}

/**
 * Name, den der Spieler für sich nennt: „nenn mich Thomas“, „ich heiße Thomas“,
 * „mein Name ist Thomas“, „ich bin Thomas“ (nur mit großem Anfangsbuchstaben,
 * sonst ist es eher „ich bin neu“).
 */
export function playerNameFromUtterance(text: string): string | null {
  const t = String(text ?? '').trim()
  const strong = t.match(/\b(?:nenn(?:e|t)?\s+mich|ich\s+hei(?:ß|ss)e|mein\s+name\s+ist|man\s+nennt\s+mich)\s+((?:(?:übrigens|uebrigens|eigentlich|einfach|ja|doch|halt|bitte)\s+)?[\p{L}][\p{L}\p{M}'-]*(?:\s+[\p{L}][\p{L}\p{M}'-]*)?)/iu)
  if (strong) return cleanName(strong[1])
  const weak = t.match(/\bich\s+bin\s+(?:der|die)?\s*([\p{Lu}][\p{L}\p{M}'-]+(?:\s+[\p{Lu}][\p{L}\p{M}'-]+)?)/u)
  if (weak) return cleanName(weak[1])
  return null
}

/**
 * Hat die Figur ihr Alter genannt? „Ich bin 42“, „42 Jahre alt“, „mit 42“.
 * Gelernt wird nur, wenn die Zahl zum wirklichen Alter passt (±1 Jahr, der
 * Geburtstag ist unbekannt) – erfindet das Modell ein Alter, lernt niemand etwas.
 */
export function statedOwnAge(reply: string, actualAge: number | null): number | null {
  if (actualAge === null) return null
  const t = String(reply ?? '').toLocaleLowerCase('de-DE')
  const patterns = [
    /\bich\s+bin\s+(\d{1,3})(?:\s+jahre(?:\s+alt)?)?\b/,
    /\b(\d{1,3})\s+jahre\s+alt\b/,
    /\bich\s+werde\s+(\d{1,3})\b/,
  ]
  for (const pattern of patterns) {
    const m = t.match(pattern)
    if (!m) continue
    const n = Number.parseInt(m[1], 10)
    if (Math.abs(n - actualAge) <= 1) return n
  }
  return null
}
