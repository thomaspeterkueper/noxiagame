// lib/game/academy/academyInterior.ts
// Grundriss und Wissen der Akademie für den allgemeinen Innenraum
// (NOXIA-INTERIOR-0001): Lernraum mit Doppelpulten, Rednerpult und Tafel,
// Sekretariat als Bedienplatz, Lehrbereich dahinter. Reine Regeln.
// Aktualisiert: 29.10.2026 — Personal weiß von Prüfung und Prämie; drei Stellen (Lehrkraft, Sekretariat, Lehrbereich)
// Version:      1.1.0

import { ACADEMY_STANDARD_INTERIOR } from '../buildings/interiors/templates/academyStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, tables, type VenueLayout } from '../hospitality/venues'
import type { SsfKnowledgeModule } from '../../ssfKnowledge'

const desks = tables([[170, 200], [320, 200], [470, 200], [170, 310], [320, 310], [470, 310]])

export const ACADEMY_LAYOUT: VenueLayout = {
  kind: 'academy',
  template: ACADEMY_STANDARD_INTERIOR,
  noun: 'Akademie',
  locative: 'in der Akademie',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'classroom',
  servicePoint: { x: 620, y: 176, label: 'AM SEKRETARIAT', locative: 'am Sekretariat' },
  windows: [{ x: 120, w: 100 }, { x: 260, w: 100 }],
  furniture: [
    { id: 'board', kind: 'board', x: 160, y: 50, w: 260, h: 18 },
    { id: 'lectern', kind: 'lectern', x: 270, y: 108, w: 44, h: 30 },
    { id: 'desk', kind: 'desk', x: 540, y: 104, w: 170, h: 40 },
    { id: 'shelf', kind: 'shelf', x: 700, y: 180, w: 16, h: 220 },
    ...desks.furniture,
  ],
  spots: [
    staffSpot('staff-secretary', 625, 92, 'classroom', 'am Sekretariat'),
    staffSpot('staff-lectern', 292, 96, 'classroom', 'am Rednerpult'),
    staffSpot('staff-office', 650, 300, 'office', 'im Lehrbereich'),
    // Die Bausteine der Lokale setzen „guest-room“; hier heißt der Raum „classroom“.
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'classroom' },
    ...desks.spots.map(spot => ({ ...spot, roomId: 'classroom', label: spot.label.replace('an Tisch', 'an Pult') })),
  ],
  roomFact: 'Der Lernraum hat sechs Doppelpulte, eine Tafel, ein Rednerpult und das Sekretariat; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Sekretariat liegt der Lehrbereich; was dort geschieht, siehst du nicht',
  staffBackFact: 'Hinter dem Sekretariat liegt der Lehrbereich mit dem Übungslabor; Besucher haben dort keinen Zutritt',
}

/** Was das Personal der Akademie über das Angebot weiß – aus den echten Lernmodulen. */
export function academyKnowledge(modules: readonly SsfKnowledgeModule[]): string[] {
  if (modules.length === 0) return ['Welche Lernmodule gerade angeboten werden, weißt du im Moment nicht – die Liste ist nicht da']
  const domains = [...new Set(modules.map(m => m.domain).filter(Boolean))].slice(0, 5)
  const sample = modules.slice(0, 4).map(m => m.title).join(', ')
  const facts = [
    `Die Akademie bietet ${modules.length} Lernmodule, z. B. ${sample}`,
    domains.length ? `Fachgebiete: ${domains.join(', ')}` : '',
    'Angemeldet wird am Sekretariat; gelernt und geprüft wird im Lernraum; mehr Wissen öffnet im Spiel mehr Möglichkeiten',
    'Ein Modul gilt erst als abgeschlossen, wenn man seine Prüfung besteht (mindestens 70 % richtig); nur Lesen schaltet nichts frei',
    'Wer die Prüfung besteht, bekommt die Freischaltung und einmal je Modul eine Prämie: 30 Credits für Grundstufe L0, 60 für L1, 120 für L2',
    'Nach drei Fehlversuchen in einer halben Stunde muss man kurz warten; nach jedem Versuch erklärt der Lernraum die Fragen',
    'Manche Module haben noch keine Prüfung; die lassen sich noch nicht abschließen – die Solar Science Foundation liefert sie nach',
    'Prüfungsergebnisse einzelner Leute kennst du nur, wenn sie in deinen Fakten stehen – erfinde keine',
  ]
  return facts.filter(Boolean)
}

export const ACADEMY_INTRODUCTION = {
  style: 'academy',
  stance: 'Du bist sachlich und ermutigend wie eine gute Lehrkraft. Neuen rätst du, mit einem Modul zu beginnen, das zu ihrem Ziel passt, und erst dann zu entscheiden, was sie werden wollen.',
  leads: [
    'Wer handeln will, lernt zuerst, wie Preise und Transport zusammenhängen; wer fliegen will, zuerst Navigation',
    'Jedes Modul hat eine Dauer und eine Schwierigkeit; klein anfangen ist kein Umweg',
    'Bei der Verwaltung meldet man seinen Heimatort an; im Lokal erfährt man, was am Ort los ist',
  ],
}
