// lib/game/hospitality/funeralReception.ts
// Beerdigungskaffee (Thomas, 02.11.2026: „Zwischenidee: ein Friedhof“ – mit
// Beerdigungen und dem Kaffee danach). Im Sauerland geht die Trauergemeinde nach
// der Beisetzung in ein Lokal: Kaffee, Kuchen, belegte Brötchen, leise Gespräche.
//
// Der Termin kommt von Population (R-23 Punkt 6) als population_events
// `place_activity_scheduled`, Art `funeral_reception`, mit dem Lokal, der oder
// dem Verstorbenen, dem Gastgeber aus der Familie und den Trauergästen. Hier nur,
// was das Lokal daraus macht: Anzeige, Wissen der Figuren, Beileid. Erfunden wird
// nichts – ohne Termin gibt es keinen Beerdigungskaffee. Reine Regeln.

export const FUNERAL_RECEPTION_KIND = 'funeral_reception'

export interface FuneralReception {
  label: string
  deceasedPersonId: string | null
  deceasedName: string
  hostPersonId: string | null
  guestIds: string[]
  startsTick: number
  endsTick: number
  /** Ist der Spieler eingeladen (playerProfileIds)? */
  playerInvited: boolean
}

type Row = { payload?: Record<string, unknown> | null }

/** Der laufende Beerdigungskaffee in diesem Lokal – oder null. Abgesagte zählen nicht. */
export function receptionAt(rows: readonly Row[], tileEntityId: string, tick: number, profileId?: string | null): FuneralReception | null {
  for (const row of rows) {
    const p = row.payload ?? {}
    if (p.kind !== FUNERAL_RECEPTION_KIND || p.tileEntityId !== tileEntityId || p.cancelled === true) continue
    const start = Number(p.startsTick), end = Number(p.endsTick)
    if (!Number.isFinite(start) || !(end > start) || tick < start || tick >= end) continue
    const name = String(p.deceasedName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!name) continue
    const ids = (v: unknown) => Array.isArray(v) ? v.map(String).slice(0, 60) : []
    return {
      label: String(p.label ?? 'Beerdigungskaffee').slice(0, 60),
      deceasedPersonId: p.deceasedPersonId ? String(p.deceasedPersonId) : null,
      deceasedName: name,
      hostPersonId: p.hostPersonId ? String(p.hostPersonId) : null,
      guestIds: ids(p.guestIds),
      startsTick: start, endsTick: end,
      playerInvited: Boolean(profileId) && ids(p.playerProfileIds).includes(String(profileId)),
    }
  }
  return null
}

export type ReceptionRole = 'staff' | 'host' | 'mourner' | 'other'

export function receptionRole(r: FuneralReception, personId: string, staff: boolean): ReceptionRole {
  if (staff) return 'staff'
  if (r.hostPersonId === personId) return 'host'
  if (r.guestIds.includes(personId)) return 'mourner'
  return 'other'
}

/** Was eine Figur im Lokal über den Beerdigungskaffee weiß – nach ihrer Rolle. */
export function receptionFacts(r: FuneralReception | null, role: ReceptionRole, input: { playerInvited: boolean; condoled: boolean }): string[] {
  if (!r) return []
  const who = r.deceasedName
  const facts: string[] = []
  switch (role) {
    case 'staff':
      facts.push(`Heute ist hier Beerdigungskaffee für ${who}; die Familie hat Tische reserviert, ihr bedient leise und taktvoll`)
      break
    case 'host':
      facts.push(`Du hast heute ${who} beerdigt und die Trauergäste zum Kaffee eingeladen; du bist erschöpft und traurig, aber gefasst`)
      facts.push(`Sprich über ${who} nur, was du weißt; erfinde keine Erinnerungen`)
      break
    case 'mourner':
      facts.push(`Du kommst von der Beerdigung von ${who} und sitzt mit der Trauergemeinde beim Kaffee; die Stimmung ist gedämpft`)
      break
    case 'other':
      facts.push(`An einigen Tischen sitzt eine Trauergesellschaft beim Beerdigungskaffee für ${who}; man ist leiser als sonst`)
      break
  }
  if (role === 'host' || role === 'mourner') {
    facts.push(input.playerInvited ? 'Dein Gegenüber gehört zur Trauergemeinde' : 'Dein Gegenüber gehört nicht zur Trauergemeinde, es ist ein anderer Gast im Lokal')
    if (input.condoled) facts.push('Dein Gegenüber hat dir eben sein Beileid ausgesprochen')
  }
  return facts.map(f => f.length > 140 ? f.slice(0, 139) + '…' : f)
}

/** Kurzer Satz für die Tafel des Lokals. */
export function receptionNotice(r: FuneralReception, invited: boolean): string {
  return invited
    ? `Beerdigungskaffee für ${r.deceasedName}. Du bist eingeladen – die Familie sitzt an den reservierten Tischen.`
    : `Heute Beerdigungskaffee für ${r.deceasedName}. Einige Tische sind reserviert; bitte etwas leiser.`
}

/** Was der Spieler sagt, wenn er sein Beileid ausspricht. */
export const CONDOLENCE_TEXT = 'Mein herzliches Beileid.'
