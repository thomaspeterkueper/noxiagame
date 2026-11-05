// lib/game/services/publicServices.ts
// Polizei, Feuerwehr, Arztpraxis, Krankenhaus (Thomas, 05.11.2026: „brauchen wir
// Polizei? Feuerwehr, Krankenhaus?“ – „ja, mache das“). Begehbare Räume für den
// allgemeinen Innenraum-Motor (NOXIA-INTERIOR-0001): Grundriss, Dienstpersonal,
// was es weiß, was man dort tun kann. Einsätze, Verletzungen, Berichte und Personal
// aus der Bevölkerung kommen von Population (R-34), die echten Gebäude von der
// Erdkarte (W-20), Seelsorge vom NPC-Teilprojekt (P-4). Erfunden wird nichts:
// Ohne Einsatz gibt es keinen Einsatz, ohne Patienten keine Patienten. Reine Regeln.

import { CIVIC_STANDARD_INTERIOR } from '../buildings/interiors/templates/civicStandard'
import { VENUE_HEIGHT, VENUE_WIDTH, staffSpot, standingSpot, type VenueLayout, type VenueSpot } from '../hospitality/venues'

export type ServiceKind = 'police' | 'fire_station' | 'doctors' | 'hospital'

export interface ServiceStaff { key: string; role: string; roleCode: string; spotId: string; description: string }
export interface ServiceOffer { id: string; label: string; hint: string; caseKind?: ServiceCaseKind }
export type ServiceCaseKind = 'anzeige' | 'fundsache' | 'verloren' | 'ff_mitmachen' | 'termin' | 'besuch'

const seats = (prefix: string, x: number, y: number, n: number, room: string, label: string): VenueSpot[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i + 1}`, kind: 'seat', x: x + 9 + i * 30, y: y + 9, roomId: room, label, posture: 'sitting' }))
const chairsAt = (prefix: string, x: number, y: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-chair-${i + 1}`, kind: 'chair' as const, x: x + i * 30, y, w: 18, h: 18 }))

const base = { template: CIVIC_STANDARD_INTERIOR, width: VENUE_WIDTH, height: VENUE_HEIGHT, start: { x: 90, y: 390 }, exit: { x: 90, y: 410 }, playerRoomId: 'service' }

export const SERVICE_LAYOUTS: Readonly<Record<ServiceKind, VenueLayout>> = {
  police: {
    ...base, kind: 'police', noun: 'Polizeiwache', locative: 'auf der Wache',
    servicePoint: { x: 420, y: 186, label: 'AM WACHTISCH', locative: 'am Wachtisch' },
    windows: [{ x: 130, w: 90 }],
    furniture: [
      { id: 'board', kind: 'board', x: 140, y: 46, w: 200, h: 22 },
      { id: 'counter', kind: 'counter', x: 340, y: 112, w: 170, h: 40 },
      { id: 'wall-back', kind: 'wall', x: 560, y: 90, w: 10, h: 346 },
      { id: 'desk-office', kind: 'desk', x: 610, y: 150, w: 90, h: 44 },
      { id: 'shelf-files', kind: 'shelf', x: 600, y: 60, w: 110, h: 20 },
      ...chairsAt('wait', 150, 300, 3),
    ],
    spots: [
      staffSpot('staff-counter', 420, 100, 'service', 'am Wachtisch'),
      staffSpot('staff-office', 650, 220, 'operations', 'im Büro hinter der Wache'),
      { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
      ...seats('wait', 150, 300, 3, 'service', 'auf der Wartebank'),
    ],
    roomFact: 'Die Wache hat einen Wachtisch mit Glasscheibe, eine Wartebank, eine Tafel mit Hinweisen und Fundsachen; dahinter liegen Büros',
    guestBackFact: 'Hinter dem Wachtisch ist eine Tür mit Sicherheitsschloss; was dahinter liegt, siehst du nicht',
    staffBackFact: 'Hinter der Wache liegen Büros, der Aktenraum und der Aufenthaltsraum der Streife',
  },
  fire_station: {
    ...base, kind: 'fire_station', noun: 'Feuerwache', locative: 'in der Feuerwache',
    servicePoint: { x: 220, y: 236, label: 'IM SCHULUNGSRAUM', locative: 'im Schulungsraum' },
    windows: [{ x: 110, w: 80 }],
    furniture: [
      { id: 'board', kind: 'board', x: 120, y: 46, w: 180, h: 22 },
      { id: 'table-school', kind: 'table', x: 150, y: 120, w: 140, h: 48 },
      ...chairsAt('school', 160, 176, 4),
      { id: 'wall-hall', kind: 'wall', x: 360, y: 90, w: 10, h: 230 },
      { id: 'vehicle', kind: 'vehicle', x: 430, y: 130, w: 230, h: 110 },
      { id: 'lockers', kind: 'locker', x: 420, y: 330, w: 240, h: 30 },
    ],
    spots: [
      staffSpot('staff-school', 220, 100, 'service', 'im Schulungsraum'),
      staffSpot('staff-hall', 540, 280, 'operations', 'in der Fahrzeughalle'),
      { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
      ...seats('school', 160, 176, 4, 'service', 'im Schulungsraum'),
    ],
    roomFact: 'In der Feuerwache steht ein rotes Löschfahrzeug in der Halle, daneben Spinde mit Einsatzkleidung; vorn liegt der Schulungsraum mit Tafel',
    guestBackFact: 'Die Fahrzeughalle darf man nur mit der Feuerwehr betreten',
    staffBackFact: 'In der Halle stehen Fahrzeug und Ausrüstung bereit; die Spinde gehören den Einsatzkräften',
  },
  doctors: {
    ...base, kind: 'doctors', noun: 'Arztpraxis', locative: 'in der Praxis',
    servicePoint: { x: 470, y: 190, label: 'AM EMPFANG', locative: 'am Empfang' },
    windows: [{ x: 130, w: 90 }, { x: 260, w: 90 }],
    furniture: [
      { id: 'counter', kind: 'counter', x: 400, y: 116, w: 150, h: 40 },
      { id: 'wall-room', kind: 'wall', x: 590, y: 90, w: 10, h: 346 },
      { id: 'bed', kind: 'bed', x: 630, y: 140, w: 70, h: 34 },
      { id: 'desk-doctor', kind: 'desk', x: 630, y: 260, w: 80, h: 40 },
      { id: 'shelf-mags', kind: 'shelf', x: 140, y: 60, w: 120, h: 20 },
      ...chairsAt('wait', 140, 290, 4),
    ],
    spots: [
      staffSpot('staff-counter', 470, 104, 'service', 'am Empfang'),
      staffSpot('staff-doctor', 670, 330, 'meeting', 'im Sprechzimmer'),
      { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
      ...seats('wait', 140, 290, 4, 'service', 'im Wartezimmer'),
    ],
    roomFact: 'Die Praxis hat einen Empfang, ein Wartezimmer mit Zeitschriften und dahinter das Sprechzimmer mit Liege',
    guestBackFact: 'Ins Sprechzimmer geht man, wenn man aufgerufen wird',
    staffBackFact: 'Im Sprechzimmer stehen Liege, Schreibtisch und Instrumente',
  },
  hospital: {
    ...base, kind: 'hospital', noun: 'Krankenhaus', locative: 'im Krankenhaus',
    servicePoint: { x: 430, y: 190, label: 'AN DER INFORMATION', locative: 'an der Information' },
    windows: [{ x: 120, w: 100 }, { x: 250, w: 100 }],
    furniture: [
      { id: 'counter', kind: 'counter', x: 350, y: 116, w: 160, h: 40 },
      { id: 'board', kind: 'board', x: 120, y: 46, w: 200, h: 22 },
      { id: 'wall-ward', kind: 'wall', x: 560, y: 90, w: 10, h: 346 },
      { id: 'bed-1', kind: 'bed', x: 610, y: 120, w: 90, h: 36 },
      { id: 'bed-2', kind: 'bed', x: 610, y: 220, w: 90, h: 36 },
      ...chairsAt('wait', 140, 300, 4),
    ],
    spots: [
      staffSpot('staff-counter', 430, 104, 'service', 'an der Information'),
      staffSpot('staff-ward', 650, 320, 'operations', 'auf der Station'),
      { ...standingSpot('entry-1', 150, 395, 'beim Eingang'), roomId: 'service' },
      ...seats('wait', 140, 300, 4, 'service', 'im Wartebereich'),
    ],
    roomFact: 'Die Eingangshalle des Krankenhauses hat eine Information, einen Wartebereich und eine Tafel mit Stationen und Besuchszeiten; dahinter liegt die Station mit Betten',
    guestBackFact: 'Auf die Station geht man nur als Besuch oder mit dem Personal',
    staffBackFact: 'Auf der Station liegen die Patienten; Notaufnahme und OP sind im anderen Flügel',
  },
}

export const SERVICE_STAFF: Readonly<Record<ServiceKind, ServiceStaff[]>> = {
  police: [
    { key: 'wache', role: 'Polizistin am Wachtisch', roleCode: 'police', spotId: 'staff-counter', description: 'Polizistin in Uniform' },
    { key: 'streife', role: 'Polizist der Streife', roleCode: 'police', spotId: 'staff-office', description: 'Polizist in Uniform' },
  ],
  fire_station: [
    { key: 'wehrfuehrer', role: 'Wehrführer der Feuerwehr', roleCode: 'fire', spotId: 'staff-school', description: 'Feuerwehrmann in Einsatzjacke' },
    { key: 'geraetewart', role: 'Gerätewartin', roleCode: 'fire', spotId: 'staff-hall', description: 'Feuerwehrfrau in Einsatzkleidung' },
  ],
  doctors: [
    { key: 'empfang', role: 'Medizinische Fachangestellte am Empfang', roleCode: 'clinic', spotId: 'staff-counter', description: 'Frau im weißen Kittel' },
    { key: 'aerztin', role: 'Hausärztin', roleCode: 'clinic', spotId: 'staff-doctor', description: 'Ärztin im Kittel' },
  ],
  hospital: [
    { key: 'information', role: 'Mitarbeiter an der Information', roleCode: 'clinic', spotId: 'staff-counter', description: 'Mann am Empfang' },
    { key: 'pflege', role: 'Pflegekraft auf der Station', roleCode: 'clinic', spotId: 'staff-ward', description: 'Pflegerin in Dienstkleidung' },
  ],
}

export const SERVICE_OFFERS: Readonly<Record<ServiceKind, ServiceOffer[]>> = {
  police: [
    { id: 'anzeige', label: 'Anzeige erstatten', hint: 'Was ist passiert, wo und wann? Die Wache nimmt es auf.', caseKind: 'anzeige' },
    { id: 'fundsache', label: 'Fundsache abgeben', hint: 'Was hast du gefunden, und wo?', caseKind: 'fundsache' },
    { id: 'verloren', label: 'Etwas verloren', hint: 'Was fehlt dir? Die Wache schaut bei den Fundsachen nach.', caseKind: 'verloren' },
  ],
  fire_station: [
    { id: 'ff_mitmachen', label: 'Bei der Freiwilligen Feuerwehr mitmachen', hint: 'Übungsabende, Einsätze, Feuerwehrfest – die Wehr freut sich über Nachwuchs.', caseKind: 'ff_mitmachen' },
  ],
  doctors: [
    { id: 'termin', label: 'Termin – ins Wartezimmer', hint: 'Der Empfang nimmt dich auf; dann wartest du, bis du aufgerufen wirst.', caseKind: 'termin' },
  ],
  hospital: [
    { id: 'besuch', label: 'Jemanden besuchen', hint: 'Wen möchtest du besuchen? Die Information schaut nach.', caseKind: 'besuch' },
  ],
}

export const SERVICE_LABEL: Readonly<Record<ServiceKind, string>> = { police: 'POLIZEI', fire_station: 'FEUERWEHR', doctors: 'ARZTPRAXIS', hospital: 'KRANKENHAUS' }

/** Öffnungszeiten: Wache, Feuerwehr und Krankenhaus immer; Praxis werktags 8–12 und 14–18 Uhr. */
export function serviceOpen(kind: ServiceKind, at: Date): boolean {
  if (kind !== 'doctors') return true
  const parts = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(at)
  const wd = parts.find(p => p.type === 'weekday')?.value ?? ''
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  if (/Sa|So/.test(wd)) return false
  return (h >= 8 && h < 12) || (h >= 14 && h < 18)
}

/**
 * Was das Personal weiß und wie es sich verhält. Wichtig: Es ist ein Spiel. Fragt
 * der Spieler nach echten Beschwerden oder einem echten Notfall, verweist die Figur
 * freundlich an echte Hilfe – keine Diagnosen, keine Medikamente.
 */
export function serviceStaffFacts(kind: ServiceKind, staff: ServiceStaff, input: { incidents: string[]; ownCases: Array<{ kind: ServiceCaseKind; text: string }> }): string[] {
  const facts: string[] = [`Du bist ${staff.role}`]
  const real = 'Fragt dein Gegenüber nach einem echten Notfall außerhalb des Spiels, sag ihm freundlich, es soll die 110 (Polizei) oder 112 (Feuerwehr, Rettungsdienst) anrufen'
  switch (kind) {
    case 'police':
      facts.push('Du nimmst Anzeigen auf, verwahrst Fundsachen und gibst Auskunft; du bleibst ruhig, sachlich und höflich')
      facts.push('Über Ermittlungen und andere Bürger gibst du keine Auskunft')
      if (input.incidents.length) facts.push(`Gemeldet wurden zuletzt: ${input.incidents.slice(0, 3).join('; ')}`)
      else facts.push('In letzter Zeit wurde dir kein Vorfall in der Stadt gemeldet; erfinde keine')
      facts.push(real)
      break
    case 'fire_station':
      facts.push('Die Feuerwehr hier ist überwiegend freiwillig; Übungsabend ist einmal in der Woche, im Sommer gibt es das Feuerwehrfest')
      facts.push('Du erklärst gern Brandschutz: Rauchmelder, Fluchtwege, was man bei Feuer tut')
      facts.push('Von Einsätzen erzählst du nur, was gemeldet wurde; erfinde keine Brände')
      facts.push(real)
      break
    case 'doctors':
      facts.push('Die Praxis hat werktags von 8 bis 12 und von 14 bis 18 Uhr Sprechstunde')
      facts.push('Erzählt dein Gegenüber von echten eigenen Beschwerden, stellst du keine Diagnose und nennst keine Medikamente; du rätst freundlich zu einer echten Ärztin oder einem echten Arzt')
      facts.push('Im echten Notfall die 112, außerhalb der Sprechzeiten der ärztliche Bereitschaftsdienst 116 117')
      break
    case 'hospital':
      facts.push('Besuchszeit ist täglich von 14 bis 19 Uhr; die Notaufnahme ist immer offen')
      facts.push('Über Patienten gibst du nur Angehörigen und angemeldeten Besuchern Auskunft; welche Patienten hier liegen, weißt du nur aus der Bevölkerung – erfinde keine')
      facts.push('Wenn dein Gegenüber von echten eigenen Beschwerden erzählt, stellst du keine Diagnose, sondern rätst freundlich zu echter ärztlicher Hilfe, im Notfall die 112')
      break
  }
  for (const c of input.ownCases.slice(0, 2)) facts.push(`Dein Gegenüber hat hier eben angegeben (${CASE_LABEL[c.kind]}): „${c.text.slice(0, 100)}“`)
  return facts.map(f => f.length > 260 ? f.slice(0, 259) + '…' : f)
}

export const CASE_LABEL: Readonly<Record<ServiceCaseKind, string>> = { anzeige: 'Anzeige', fundsache: 'Fundsache', verloren: 'Verlustmeldung', ff_mitmachen: 'Mitmachen bei der Feuerwehr', termin: 'Termin', besuch: 'Besuch' }

export function serviceIntroduction(kind: ServiceKind): string {
  return {
    police: 'Guten Tag, Polizeiwache. Was kann ich für Sie tun?',
    fire_station: 'Moin! Willkommen bei der Feuerwehr. Interesse an der Wehr, oder eine Frage zum Brandschutz?',
    doctors: 'Guten Tag! Haben Sie einen Termin? Dann nehmen Sie bitte im Wartezimmer Platz.',
    hospital: 'Guten Tag, Information. Wen möchten Sie besuchen?',
  }[kind]
}

/** Die Art aus der Nutzung (OSM: amenity=police / fire_station / hospital / clinic / doctors / dentist). */
export function serviceKindFor(value: string | null | undefined): ServiceKind | null {
  const v = String(value ?? '')
  if (v === 'police') return 'police'
  if (v === 'fire_station') return 'fire_station'
  if (v === 'hospital' || v === 'clinic') return 'hospital'
  if (v === 'doctors' || v === 'dentist') return 'doctors'
  return null
}

/** Text eines Falls: kurz, ohne Kontaktdaten. */
export function cleanCaseText(raw: unknown): string | null {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (t.length < 3) return null
  return t.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, '[Kontakt entfernt]').replace(/(?:\+|00)?\d[\d\s/().-]{6,}\d/g, '[Nummer entfernt]')
}
