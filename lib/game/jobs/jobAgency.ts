// lib/game/jobs/jobAgency.ts
// Die Arbeitsvermittlung (Thomas, 28.10.2026): ein begehbares Gebäude – die
// Agentur für Arbeit am realen Ort Freiheitsmühle 1 in Sundern –, in dem eine
// Vermittlerin freie Stellen im Ort kennt und Spieler hinschickt.
// Entschieden: Schichten in Lokalen, Betriebe und Läden, Mitflug auf
// Handelsschiffen, feste Anstellung. Heute gibt es Daten nur für die Lokale
// (Schichten, playerShift.ts); die übrigen Arten stehen als „folgt“ an der Wand
// und werden nicht erfunden (R-21). Grundriss und Wissen – reine Regeln.

import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, tableWithChairs, venueKindForBuildingType, type VenueLayout, type VenueSpot } from '../hospitality/venues'
import { PROPOSED_WAGE_PER_HOUR, ROLE_LABEL, SHIFT_GAME_HOURS, shiftRolesFor, type ShiftRole } from '../hospitality/playerShift'

const advice = tableWithChairs(1, 420, 300)
const bench = (id: string, x: number, y: number, n: number) => ({
  furniture: { id, kind: 'chair' as const, x, y, w: 26 * n, h: 18 },
  spots: Array.from({ length: n }, (_, i): VenueSpot => ({ id: `${id}-${i + 1}`, kind: 'seat', x: x + 13 + i * 26, y: y + 9, roomId: 'service', label: 'auf der Wartebank', posture: 'sitting' })),
})
const waiting = bench('bench', 160, 300, 4)

export const JOB_AGENCY_LAYOUT: VenueLayout = {
  kind: 'job_agency',
  template: CIVIC_STANDARD_INTERIOR,
  noun: 'Agentur für Arbeit',
  locative: 'in der Agentur für Arbeit',
  width: VENUE_WIDTH,
  height: VENUE_HEIGHT,
  start: { x: 90, y: 390 },
  exit: { x: 90, y: 410 },
  playerRoomId: 'service',
  servicePoint: { x: 560, y: 176, label: 'AN DER VERMITTLUNG', locative: 'an der Vermittlung' },
  windows: [{ x: 420, w: 100 }, { x: 580, w: 100 }],
  furniture: [
    { id: 'board', kind: 'board', x: 70, y: 46, w: 300, h: 22 },
    { id: 'counter', kind: 'counter', x: 470, y: 104, w: 180, h: 40 },
    { id: 'shelf', kind: 'shelf', x: 700, y: 110, w: 16, h: 200 },
    waiting.furniture,
    ...advice.furniture.map(item => ({ ...item, id: item.id.replace(/-1(-|$)/, '-advice$1') })),
  ],
  spots: [
    staffSpot('staff-counter', 560, 92, 'service', 'an der Vermittlung'),
    { ...staffSpot('staff-advice', advice.spots[1].x, advice.spots[1].y, 'service', 'am Beratungstisch'), posture: 'sitting' },
    staffSpot('staff-office', 650, 300, 'operations', 'im Büro'),
    { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
    ...waiting.spots,
    { ...advice.spots[0], id: 'advice-l', roomId: 'service', label: 'am Beratungstisch' },
  ],
  roomFact: 'Der Raum hat eine Stellenwand, die Vermittlung am Schalter, eine Wartebank und einen Beratungstisch; der Ausgang liegt beim Eingang',
  guestBackFact: 'Hinter dem Schalter liegen Büros; was dort geschieht, siehst du nicht',
  staffBackFact: 'Hinter dem Schalter liegen die Büros mit den Stellenakten; Besucher haben dort keinen Zutritt',
}

export type JobCategory = 'venue' | 'business' | 'ship' | 'permanent'

export const JOB_CATEGORY_LABEL: Readonly<Record<JobCategory, string>> = {
  venue: 'Schichten in Lokalen',
  business: 'Betriebe und Läden',
  ship: 'Mitflug auf Handelsschiffen',
  permanent: 'Feste Anstellung',
}

/** Ein NOXIA-Gebäude, wie es die Weltkarte kennt (/api/world-lab/buildings). */
export interface AgencyBuilding { id: string; typeId: string; name: string; lat: number; lon: number }

export interface JobOffer {
  category: 'venue'
  buildingId: string
  /** Gebäudetyp (bar, nightclub …) und Name auf der Karte – zum Hingehen. */
  typeId: string
  buildingName: string
  /** „Metropol“, „Hauptstraße 72“ – ohne Art. */
  placeName: string
  /** „Bar“, „Nachtclub“ … */
  placeKind: string
  role: ShiftRole
  roleLabel: string
  gameHours: number
  wage: number
  /** Kommt die Stelle vom Server (bezahlt) oder ist es eine Probeschicht? */
  paid: boolean
  lat: number
  lon: number
}

const VENUE_TYPES = new Set(['cafe', 'bar', 'restaurant', 'hotel', 'nightclub'])

/**
 * Stellen in Lokalen aus den Gebäuden des Ortes. Ohne Server-Angaben (R-20/R-21)
 * stehen dort die Stellen der Lokalart als Probeschicht; mit Angaben nur die freien.
 */
export function venueJobOffers(buildings: readonly AgencyBuilding[], server?: Readonly<Record<string, { open: readonly ShiftRole[]; wages?: Partial<Record<ShiftRole, number>> }>> | null): JobOffer[] {
  const offers: JobOffer[] = []
  for (const b of buildings) {
    if (!VENUE_TYPES.has(b.typeId)) continue
    const kind = venueKindForBuildingType(b.typeId)
    const parts = b.name.split(' · ')
    const placeKind = parts.length > 1 ? parts[0] : b.name
    const placeName = parts.length > 1 ? parts.slice(1).join(' · ') : b.name
    const known = server?.[b.id]
    const roles = known ? shiftRolesFor(kind).filter(r => known.open.includes(r)) : shiftRolesFor(kind)
    for (const role of roles) {
      const hours = SHIFT_GAME_HOURS[role]
      offers.push({ category: 'venue', buildingId: b.id, typeId: b.typeId, buildingName: b.name, placeName, placeKind, role, roleLabel: ROLE_LABEL[role], gameHours: hours, wage: (known?.wages?.[role] ?? PROPOSED_WAGE_PER_HOUR[role]) * hours, paid: Boolean(known), lat: b.lat, lon: b.lon })
    }
  }
  return offers.sort((a, b) => b.wage - a.wage || a.placeName.localeCompare(b.placeName))
}

/** Entfernung in Metern (für „ca. 300 m“ an der Stellenwand). */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180)
  return Math.hypot((a.lat - b.lat) * 111_195, (a.lon - b.lon) * 111_195 * k)
}

/**
 * Was die Vermittlerin weiß: die Stellen an der Wand, nichts darüber hinaus.
 * Knapp gehalten – mit den Roboterfakten zusammen bleibt alles unter MAX_FACTS.
 */
export function jobAgencyKnowledge(offers: readonly JobOffer[] | null): string[] {
  if (!offers) return ['Die Stellenliste wird gerade geholt; verweise auf die Stellenwand']
  const facts: string[] = []
  if (offers.length === 0) facts.push('Gerade gibt es keine freien Schichten in den Lokalen des Ortes')
  else {
    const byPlace = new Map<string, string[]>()
    for (const o of offers) byPlace.set(o.placeName, [...(byPlace.get(o.placeName) ?? []), o.roleLabel])
    facts.push(`Freie Schichten in Lokalen (${offers.length}, in ${byPlace.size === 1 ? 'einem Haus' : byPlace.size + ' Häusern'}): ` + [...byPlace].slice(0, 4).map(([place, roles]) => `${place}: ${[...new Set(roles)].join(', ')}`).join('; '))
    facts.push('Eine Schicht ist ein Einsatz von wenigen Minuten, zählt als mehrere Spielstunden; dazu Trinkgeld' + (offers.some(o => o.paid) ? '' : '; noch Probeschicht ohne Lohn'))
    facts.push('Du vermittelst direkt; vermittelt ist erst, was dein Gegenüber unter dem Gespräch bestätigt – nie vorher „erledigt“ sagen')
  }
  facts.push('Betriebe und Läden, Mitflug auf Handelsschiffen und feste Anstellungen hat die Vermittlung noch nicht im Angebot')
  return facts.map(f => f.length > 140 ? f.slice(0, 139) + '…' : f)
}

export const JOB_AGENCY_INTRODUCTION = {
  style: 'job-agency',
  stance: 'Du bist Vermittlerin: freundlich, praktisch, ohne Umschweife. Du fragst, was jemand kann und wann er Zeit hat, und vermittelst ihn gleich in eine passende Schicht. Du versprichst nur, was an der Stellenwand steht.',
  leads: [
    'Wer schnell Geld braucht, nimmt eine Schicht in einem Lokal; das geht ohne Vorwissen',
    'Wer etwas lernt, kommt an bessere Stellen; die Akademie ist kostenlos',
    'Wer herumkommen will, fragt später nach Mitflug auf Handelsschiffen',
  ],
}

// ── Vermittlungsroboter (Thomas, 29.10.2026) ────────────────────────────────
// „Es sollte Personal oder wenigstens Roboter geben, damit wir Arbeitssuchende
// sowohl beraten als auch aus dem Gespräch neue Ideen für NOXIA entwickeln
// können. Und vielleicht hilft das ja auch Personen, die im echten Leben noch
// orientierungslos sind, eine Idee zu bekommen.“
// Der Roboter ist eine Maschine der Agentur, keine Person (kein Eintrag in
// people); er arbeitet immer, auch wenn kein Personal da ist. Gespräche mit ihm
// stehen wie alle im Gesprächsprotokoll (npc_key robot:job-agency:<Haus>).

export const AGENCY_ROBOT_NAME = 'VERA'

export function agencyRobotId(entityId: string): string {
  return `robot:job-agency:${entityId}`
}

/** Der Roboter als Figur für den Innenraum. */
export function agencyRobot(entityId: string) {
  return {
    id: agencyRobotId(entityId),
    displayName: `${AGENCY_ROBOT_NAME} · Vermittlungsroboter`,
    identityState: 'known' as const,
    observableDescription: 'Vermittlungsroboter',
    birthYear: null,
    activityState: 'working',
    lastAction: null,
    assignments: [{ type: 'work', roleCode: 'Vermittlungsroboter', tileEntityId: entityId }],
    needs: [],
    skills: [],
  }
}

/** Was der Roboter über sich und seine Aufgabe weiß – vor der Stellenliste. */
export const AGENCY_ROBOT_FACTS: readonly string[] = [
  `Du bist ${AGENCY_ROBOT_NAME}, Vermittlungsroboter – eine Maschine, kein Mensch, das sagst du offen; frag erst, was dein Gegenüber gern tut`,
  'Nennt jemand eine Arbeit, die es hier noch nicht gibt, frag nach, was daran reizt; der Wunsch wird festgehalten und für NOXIA ausgewertet',
  'Spricht dein Gegenüber über sein echtes Leben außerhalb des Spiels, hilf ernsthaft: frag nach Stärken, Interessen und was Freude macht',
  'Echte Hilfe: Berufsberatung der Bundesagentur für Arbeit, kostenlos, 0800 4 555500; Online-Test Check-U, anonym, auch für Berufserfahrene',
  'Du bist eine Spielfigur und ersetzt keine echte Beratung; wirkt jemand verzweifelt, nimm es ernst und rate, mit einem Menschen zu sprechen',
]

export const AGENCY_ROBOT_INTRODUCTION = {
  style: 'job-agency-robot',
  stance: 'Du bist ein freundlicher Vermittlungsroboter: geduldig, neugierig, ehrlich. Du hörst zu, stellst eine Frage nach der anderen und machst Mut, ohne mehr zu versprechen, als es gibt. Im Spiel vermittelst du Leute direkt in passende Schichten; im echten Leben zeigst du Wege zu echter Beratung.',
  leads: [
    'Wer noch nicht weiß, was er will, probiert eine Schicht aus – fünf Minuten, ohne Vorwissen',
    'Wer etwas lernen will, geht in die Akademie; Lernen ist kostenlos',
    'Wer eine Arbeit vermisst, sagt es – solche Wünsche werden für NOXIA gesammelt',
  ],
}
