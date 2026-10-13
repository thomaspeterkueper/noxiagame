// lib/game/hospitality/canteen.ts
// Hafenkantine (NOXIA-LIVING-0013): Grundversorgung im Hafengebäude, rund um
// die Uhr, bedient von einem Automaten oder einem Ausgaberoboter. Reine Regeln.
//
// Der Roboter ist Ausstattung, keine Person: kein Gedächtnis, keine Stimmung,
// keine Gerüchte, kein freies Gespräch. Er beantwortet nur, was ein
// Ausgabegerät wissen kann – Karte, Preise, Öffnungszeit, Notration – und
// verweist sonst an Verwaltung oder Lokal.

export type CanteenServiceKind = 'automat' | 'robot'

/** Kleine Landeplätze haben einen Automaten, größere Häfen und Stationen einen Roboter. */
export function canteenServiceKind(portTypeId: string | null | undefined): CanteenServiceKind {
  return String(portTypeId ?? '').startsWith('landing_pad') ? 'automat' : 'robot'
}

export const CANTEEN_SERVICE_NAME: Readonly<Record<CanteenServiceKind, string>> = { automat: 'Ausgabeautomat', robot: 'Ausgaberoboter' }

export type CanteenMenuItem = { itemCode: string; label: string; priceCredits: number }

export type CanteenQuestion = 'menu' | 'hours' | 'broke' | 'where' | 'work' | 'who'

export const CANTEEN_QUESTIONS: ReadonlyArray<{ id: CanteenQuestion; text: string }> = [
  { id: 'menu', text: 'Was gibt es?' },
  { id: 'hours', text: 'Wann habt ihr geöffnet?' },
  { id: 'broke', text: 'Ich kann nichts bezahlen.' },
  { id: 'where', text: 'Wo bin ich hier?' },
  { id: 'work', text: 'Gibt es hier Arbeit?' },
  { id: 'who', text: 'Wer bist du?' },
]

const PORT_NOUN: Readonly<Record<string, string>> = {
  spaceport_core: 'Raumhafen', q1_harbour_district: 'Hafenviertel', docking_bay: 'Andockmodul',
}

/** Wie das Gerät den Hafen nennt, in dem es steht. */
export function portNoun(portTypeId: string | null | undefined): string {
  const id = String(portTypeId ?? '')
  return PORT_NOUN[id] ?? (id.startsWith('landing_pad') ? 'Landeplatz' : 'Hafen')
}

/**
 * Feste Antworten – knapp, synthetisch, nur aus dem, was das Gerät weiß.
 * `menu` ist die echte Karte; ohne Karte sagt das Gerät, dass die Ausgabe leer ist.
 */
export function canteenAnswer(question: CanteenQuestion, input: { kind: CanteenServiceKind; menu: readonly CanteenMenuItem[]; portTypeId?: string | null; rationAvailable: boolean }): string {
  const list = input.menu.map(item => `${item.label} ${item.priceCredits} Cr`).join(', ')
  switch (question) {
    case 'menu':
      return input.menu.length ? `Ausgabe: ${list}. Mehr gibt es hier nicht.` : 'Ausgabe leer. Nachschub nicht gemeldet.'
    case 'hours':
      return 'Rund um die Uhr. Hafenbetrieb.'
    case 'broke':
      return input.rationAvailable
        ? 'Notration verfügbar. Kein Geldfluss. Taste „Notration“.'
        : 'Notration für Mittellose vorgesehen. Ausgabe an Spieler noch nicht freigeschaltet. Bitte Verwaltung.'
    case 'where':
      return `Hafenkantine im ${portNoun(input.portTypeId)}. Grundversorgung. Für mehr: ein Lokal am Ort oder die Verwaltung.`
    case 'work':
      return 'Keine Daten. Stellen vergibt die Verwaltung des Ortes.'
    case 'who':
      return input.kind === 'robot'
        ? 'Ausgaberoboter, Baureihe Hafenversorgung. Kein Gedächtnis für Gäste. Kein Gespräch.'
        : 'Ausgabeautomat. Wasser, Ration, Notration. Keine Auskunft darüber hinaus.'
  }
}

/** Was das Gerät sagt, wenn jemand davortritt. */
export function canteenGreeting(kind: CanteenServiceKind): string {
  return kind === 'robot' ? 'Bitte wählen. Wasser oder Ration.' : 'BEREIT · WASSER · RATION'
}
