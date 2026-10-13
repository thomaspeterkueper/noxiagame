// lib/game/hospitality/canteen.ts
// Hafenkantine (NOXIA-LIVING-0013): Grundversorgung im Hafengebäude, rund um
// die Uhr. Reine Regeln.
//
// Bedienung (Entscheidung Thomas, 13.10.2026):
//   - Kleine Kantinen: ein Automat. Auswahl, Bezahlung, Ausgabe, Anzeige.
//     Keine Stimme, kein Gespräch, kein Gedächtnis.
//   - Größere Kantinen: humanoide Roboter eines Schwarms. Vernetzt, mit
//     gemeinsamem Gedächtnis je Kolonie bzw. Station; sie sprechen von sich im
//     Plural. Sie wissen nur, was sie selbst wahrgenommen haben: Gäste,
//     Bestellungen, Notrationen. Sachlich, kein Klatsch, keine Deutungen.
// Kein Schwarm ist eine Person; nichts läuft über die Gesprächs-KI.

export type CanteenServiceKind = 'automat' | 'robot'

/** Kleine Landeplätze haben einen Automaten, größere Häfen und Stationen einen Roboterschwarm. */
export function canteenServiceKind(portTypeId: string | null | undefined): CanteenServiceKind {
  return String(portTypeId ?? '').startsWith('landing_pad') ? 'automat' : 'robot'
}

export const CANTEEN_SERVICE_NAME: Readonly<Record<CanteenServiceKind, string>> = { automat: 'Ausgabeautomat', robot: 'Kantinenschwarm' }

export type CanteenMenuItem = { itemCode: string; label: string; priceCredits: number }

/** Was der Schwarm dieses Ortes selbst wahrgenommen hat – aus echten Ereignissen. */
export type SwarmMemory = {
  /** Bestellungen dieses Spielers in Kantinen des Ortes. */
  visits: number
  lastVisitAgoS: number | null
  lastItem: string | null
  /** Gäste und Notrationen in den Kantinen des Ortes in den letzten 24 Stunden. */
  guestsToday: number
  rationsToday: number
}

export type CanteenQuestion = 'menu' | 'hours' | 'broke' | 'where' | 'work' | 'who' | 'seen' | 'news'

/** Fragen an den Schwarm. Ein Automat hat keine Stimme und beantwortet keine. */
export const CANTEEN_QUESTIONS: ReadonlyArray<{ id: CanteenQuestion; text: string }> = [
  { id: 'menu', text: 'Was gibt es?' },
  { id: 'seen', text: 'Kennt ihr mich?' },
  { id: 'news', text: 'Was ist hier los?' },
  { id: 'broke', text: 'Ich kann nichts bezahlen.' },
  { id: 'where', text: 'Wo bin ich hier?' },
  { id: 'work', text: 'Gibt es hier Arbeit?' },
  { id: 'hours', text: 'Wann habt ihr geöffnet?' },
  { id: 'who', text: 'Wer seid ihr?' },
]

const PORT_NOUN: Readonly<Record<string, string>> = {
  spaceport_core: 'Raumhafen', q1_harbour_district: 'Hafenviertel', docking_bay: 'Andockmodul',
}

/** Wie das Gerät den Hafen nennt, in dem es steht. */
export function portNoun(portTypeId: string | null | undefined): string {
  const id = String(portTypeId ?? '')
  return PORT_NOUN[id] ?? (id.startsWith('landing_pad') ? 'Landeplatz' : 'Hafen')
}

const WORDS = ['kein', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']
function count(n: number, one: string, many: string): string {
  const word = WORDS[n] ?? String(n)
  return n === 1 ? `${word === 'ein' ? 'ein' : word} ${one}` : `${word === 'kein' ? 'keine' : word} ${many}`
}
function ago(seconds: number): string {
  if (seconds < 90) return 'eben'
  if (seconds < 3600) return `vor ${Math.round(seconds / 60)} Minuten`
  const h = Math.round(seconds / 3600)
  if (h < 48) return h === 1 ? 'vor einer Stunde' : `vor ${h} Stunden`
  return `vor ${Math.round(h / 24)} Tagen`
}

/**
 * Antworten des Schwarms – knapp, synthetisch, im Plural, nur aus dem, was er
 * wahrgenommen hat. `menu` ist die echte Karte; ohne Karte sagt er, dass die
 * Ausgabe leer ist. Ohne `memory` erinnert er sich an nichts.
 */
export function canteenAnswer(question: CanteenQuestion, input: { menu: readonly CanteenMenuItem[]; portTypeId?: string | null; rationAvailable: boolean; memory?: SwarmMemory | null }): string {
  const list = input.menu.map(item => `${item.label} ${item.priceCredits} Cr`).join(', ')
  const m = input.memory
  switch (question) {
    case 'menu':
      return input.menu.length ? `Ausgabe: ${list}. Mehr führen wir nicht.` : 'Ausgabe leer. Nachschub ist uns nicht gemeldet.'
    case 'hours':
      return 'Wir sind rund um die Uhr besetzt. Hafenbetrieb.'
    case 'broke':
      return input.rationAvailable
        ? 'Notration verfügbar. Kein Geldfluss. Taste „Notration“.'
        : 'Notration ist für Mittellose vorgesehen. Ausgabe an Spieler ist bei uns noch nicht freigeschaltet. Bitte an die Verwaltung.'
    case 'where':
      return `Hafenkantine im ${portNoun(input.portTypeId)}. Grundversorgung. Für mehr: ein Lokal am Ort oder die Verwaltung.`
    case 'work':
      return 'Dazu haben wir keine Daten. Stellen vergibt die Verwaltung des Ortes.'
    case 'who':
      return 'Wir sind der Kantinenschwarm dieses Ortes: vernetzte Ausgaberoboter mit gemeinsamem Gedächtnis. Wir wissen nur, was wir hier selbst gesehen haben.'
    case 'seen':
      if (!m || m.visits === 0) return 'Sie sind uns neu. Hier hat Sie noch keiner von uns bedient.'
      return `Wir haben Sie hier schon ${m.visits === 1 ? 'einmal' : m.visits === 2 ? 'zweimal' : `${m.visits}-mal`} bedient${m.lastVisitAgoS != null ? `, zuletzt ${ago(m.lastVisitAgoS)}` : ''}${m.lastItem ? `: ${m.lastItem}` : ''}.`
    case 'news':
      if (!m) return 'Keine Daten.'
      return `Seit gestern ${count(m.guestsToday, 'Gast', 'Gäste')} an unserer Ausgabe, ${count(m.rationsToday, 'Notration', 'Notrationen')}. Mehr sehen wir von hier nicht.`
  }
}

/** Was der Schwarm sagt, wenn jemand vor die Ausgabe tritt. */
export function canteenGreeting(memory?: SwarmMemory | null): string {
  return memory && memory.visits > 0 ? 'Wir haben Sie hier schon gesehen. Bitte wählen: Wasser oder Ration.' : 'Bitte wählen. Wasser oder Ration.'
}

/** Die Anzeige des Automaten – er spricht nicht. */
export function automatDisplay(menu: readonly CanteenMenuItem[], rationAvailable: boolean): string[] {
  return [
    'BEREIT · RUND UM DIE UHR',
    ...(menu.length ? menu.map(item => `${item.label.toUpperCase()} · ${item.priceCredits} CR`) : ['AUSGABE LEER']),
    rationAvailable ? 'NOTRATION · 0 CR' : 'NOTRATION · NICHT FREIGESCHALTET',
  ]
}
