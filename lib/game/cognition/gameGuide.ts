// lib/game/cognition/gameGuide.ts
// Erstellt:     29.10.2026
// Aktualisiert: 29.10.2026 — Wege zu dem, was es schon gibt (Spielerwünsche „vorhanden“)
// Version:      1.0.0
//
// Rein, ohne DB. Entschieden (Thomas, 29.10.2026): Wünsche, die es im Spiel schon gibt
// (Lokal eröffnen, Bücher, Akademie, Tanz, Toilette), sollen Spieler finden. Fragt jemand
// danach, bekommt die Figur die passenden Wege als belegtes Wissen – mit den echten Häusern
// am Ort. Was es am Ort nicht gibt, sagt sie ehrlich. Nur für das Thema der Frage, nicht alles.

export type GuidePlace = { kind: string; name: string | null }

type Entry = { re: RegExp; lines: (p: GuidePlace[], earth: boolean) => string[] }

const named = (p: GuidePlace[], kinds: string[]) =>
  p.filter(x => kinds.includes(x.kind)).map(x => x.name).filter((n): n is string => Boolean(n))

const list = (names: string[]) => [...new Set(names)].slice(0, 3).join(', ')

const ENTRIES: Entry[] = [
  { // Toilette (entschieden 28.10.2026, R-18)
    re: /\b(toilett|klo|wc|pinkeln|pipi|aufs?\s+örtchen)/i,
    lines: p => {
      const venues = named(p, ['cafe', 'bar', 'restaurant', 'hotel', 'nightclub'])
      return [venues.length
        ? `Toiletten gibt es in den Lokalen, z. B. ${list(venues)}; öffentliche Toiletten auf der Straße gibt es nicht`
        : 'Toiletten gibt es in Lokalen; hier in der Nähe weißt du keins']
    },
  },
  { // Eigenes Lokal
    re: /(caf[eé]e?|lokal|\bbar\b|restaurant|kneipe|laden|geschäft).*(eröffn|aufmach|gründ|\bbau|betreib|kauf)/i,
    lines: (_p, earth) => [
      earth
        ? 'Ein eigenes Lokal geht auf zwei Wegen: ein leeres Haus kaufen und zum Café, zur Bar, zum Restaurant oder Nachtclub umbauen, oder auf freier Fläche bauen'
        : 'Ein eigenes Lokal baut man auf freier Fläche in der Siedlung',
      'Wer ein Lokal hat, stellt Personal ein und legt Preise und Angebot selbst fest',
    ],
  },
  { // Bücher
    re: /\b(buch|bücher|lesen|roman|bibliothek|bücherei)/i,
    lines: p => {
      const libs = named(p, ['library', 'bookstore'])
      return [libs.length ? `Bücher gibt es in ${list(libs)}; dort kann man sich in die Leseecke setzen` : 'Eine Bücherei weißt du hier in der Nähe nicht']
    },
  },
  { // Akademie, Lernen, Prüfung
    re: /\b(akademie|lernen|lernmodul|prüfung|schule|kurs|wissen)/i,
    lines: p => [
      named(p, ['school']).length || p.some(x => x.kind === 'school')
        ? 'Die Akademie ist hier am Ort; dort lernt man in Modulen, und wer die Prüfung besteht, bekommt Freischaltungen und eine Prämie in Credits'
        : 'Eine Akademie gibt es hier nicht',
    ],
  },
  { // Tanz, Feiern
    re: /\b(tanz|tanzen|disco|club|feiern|party)/i,
    lines: p => {
      const clubs = named(p, ['nightclub'])
      return [clubs.length
        ? `Tanzen kann man nachts im Nachtclub, z. B. ${list(clubs)}; Eintritt an der Tür`
        : 'Einen Nachtclub gibt es hier noch nicht; wer ein Haus kauft, kann daraus einen machen']
    },
  },
  { // Raumhafen, ins All
    re: /\b(raumhafen|weltraum|all\b|mond|mars|phobos|fliegen|flug|rakete|raumschiff)/i,
    lines: () => [
      'Vom Raumhafen geht es mit dem Linienflug gegen Ticket ins All',
      'Wer kein eigenes Schiff hat, kann an der Flugleitung als Crew auf einem Frachter anheuern – mitfliegen und bei der Ankunft Heuer bekommen; wann die nächste Fracht ausläuft, weiß niemand vorher',
    ],
  },
  { // Arbeit, Geld
    re: /\b(arbeit|job|stelle|geld verdienen|credits verdienen|schicht)/i,
    lines: p => {
      const agency = named(p, ['job_agency'])
      return [agency.length
        ? `Freie Stellen hängen in der Agentur für Arbeit (${list(agency)}); Schichten in Lokalen gehen ohne Vorwissen`
        : 'Arbeit findet man in den Betrieben am Ort; frag dort nach']
    },
  },
]

/** Belegte Wege zu dem, wonach der Spieler fragt – höchstens vier Zeilen. */
export function gameGuideLines(playerText: string, places: GuidePlace[], locationSlug: string | null): string[] {
  const text = playerText ?? ''
  const earth = locationSlug === 'earth'
  const out: string[] = []
  for (const entry of ENTRIES) {
    if (!entry.re.test(text)) continue
    out.push(...entry.lines(places, earth))
    if (out.length >= 4) break
  }
  return out.slice(0, 4)
}
