// lib/game/hospitality/venueIncident.ts
// Rangelei und Kampf im Lokal (Thomas, 04.11.2026: „alles in genau dieser Steigerung,
// leider ist die Welt nicht nur nett“). Ob es Streit gibt, wer beteiligt ist und was
// danach mit den Figuren geschieht (Verletzung, Hausverbot, Polizei, Gedächtnis),
// entscheidet Population (Request R-32) – wie beim Beerdigungskaffee kommt ein Termin
// als population_events, hier `venue_incident`. Das Lokal zeigt ihn nur: Posen der
// Beteiligten, was die Anwesenden davon wissen, der Hinweis für den Spieler.
// Erfunden wird nichts – ohne Ereignis gibt es keinen Streit. Reine Regeln.

import type { KieselPose } from '../../figures/kiesel'

export const VENUE_INCIDENT_EVENT = 'venue_incident'

export type IncidentLevel = 'rangelei' | 'kampf'
export type IncidentRole = 'angreifer' | 'verteidiger' | 'schlichter'
export type IncidentOutcome = 'steht' | 'am_boden' | 'verletzt'

export interface IncidentParticipant { personId: string; role: IncidentRole; outcome: IncidentOutcome }

export interface VenueIncident {
  level: IncidentLevel
  participants: IncidentParticipant[]
  startsTick: number
  /** Ende des Handgemenges; danach bleiben die Folgen bis `aftermathTick` sichtbar. */
  endsTick: number
  aftermathTick: number
  /** Kurzer Anlass, wie Population ihn kennt („Streit um die Rechnung“). */
  cause: string | null
  /** Wer hinausbegleitet wurde (Türsteher, Hausverbot nach Hausregel). */
  removedIds: string[]
}

type Row = { payload?: Record<string, unknown> | null }
const ROLES: readonly IncidentRole[] = ['angreifer', 'verteidiger', 'schlichter']
const OUTCOMES: readonly IncidentOutcome[] = ['steht', 'am_boden', 'verletzt']

/** Der laufende oder gerade vergangene Vorfall in diesem Lokal – oder null. */
export function incidentAt(rows: readonly Row[], tileEntityId: string, tick: number): VenueIncident | null {
  let best: VenueIncident | null = null
  for (const row of rows) {
    const p = row.payload ?? {}
    if (p.tileEntityId !== tileEntityId || p.cancelled === true) continue
    const start = Number(p.startsTick), end = Number(p.endsTick)
    if (!Number.isFinite(start) || !(end > start)) continue
    const after = Number.isFinite(Number(p.aftermathTick)) && Number(p.aftermathTick) >= end ? Number(p.aftermathTick) : end + 1
    if (tick < start || tick >= after) continue
    const participants = (Array.isArray(p.participants) ? p.participants : []).slice(0, 8).flatMap((x): IncidentParticipant[] => {
      const v = (x ?? {}) as Record<string, unknown>
      const personId = typeof v.personId === 'string' ? v.personId : ''
      const role = ROLES.includes(v.role as IncidentRole) ? v.role as IncidentRole : null
      if (!personId || !role) return []
      return [{ personId, role, outcome: OUTCOMES.includes(v.outcome as IncidentOutcome) ? v.outcome as IncidentOutcome : 'steht' }]
    })
    if (participants.length === 0) continue
    const level: IncidentLevel = p.level === 'kampf' ? 'kampf' : 'rangelei'
    const found: VenueIncident = {
      level, participants, startsTick: start, endsTick: end, aftermathTick: after,
      cause: typeof p.cause === 'string' && p.cause.trim() ? p.cause.replace(/\s+/g, ' ').trim().slice(0, 80) : null,
      removedIds: Array.isArray(p.removedIds) ? p.removedIds.map(String).slice(0, 8) : [],
    }
    if (!best || found.startsTick > best.startsTick) best = found
  }
  return best
}

export const incidentRunning = (i: VenueIncident | null, tick: number) => Boolean(i) && tick >= i!.startsTick && tick < i!.endsTick

/** Pose einer Person während und nach dem Vorfall – null heißt: wie sonst. */
export function incidentPose(i: VenueIncident | null, personId: string, tick: number): { pose: KieselPose; verletzt: boolean } | null {
  if (!i) return null
  const who = i.participants.find(p => p.personId === personId)
  if (!who) return null
  const verletzt = who.outcome === 'verletzt'
  if (!incidentRunning(i, tick)) {
    if (who.outcome === 'am_boden' || (verletzt && i.level === 'kampf')) return { pose: 'liegen', verletzt }
    return verletzt ? { pose: 'stehen', verletzt } : null
  }
  const late = tick >= i.startsTick + (i.endsTick - i.startsTick) * .6
  if (late && who.outcome !== 'steht') return { pose: i.level === 'kampf' && verletzt ? 'liegen' : 'hinfallen', verletzt }
  if (who.role === 'schlichter') return { pose: 'abwehren', verletzt: false }
  if (i.level === 'rangelei') return { pose: who.role === 'angreifer' ? 'schubsen' : late ? 'getroffen' : 'abwehren', verletzt: false }
  return { pose: who.role === 'angreifer' ? 'zuschlagen' : late ? 'getroffen' : 'abwehren', verletzt: false }
}

/** Was eine Figur davon wissen kann: Beteiligte ihre Rolle, Anwesende, was sie gesehen haben. */
export function incidentFacts(i: VenueIncident | null, personId: string, tick: number, names: Readonly<Record<string, string>> = {}): string[] {
  if (!i) return []
  const running = incidentRunning(i, tick)
  const what = i.level === 'kampf' ? 'eine Schlägerei' : 'eine Rangelei'
  const who = i.participants.find(p => p.personId === personId)
  const others = i.participants.filter(p => p.personId !== personId).map(p => names[p.personId]).filter(Boolean).slice(0, 3)
  const facts: string[] = []
  if (who) {
    const role = who.role === 'angreifer' ? 'du hast angefangen' : who.role === 'verteidiger' ? 'du wurdest angegangen' : 'du gehst dazwischen'
    facts.push(`${running ? 'Gerade gibt es' : 'Eben gab es'} hier ${what}${others.length ? ' mit ' + others.join(', ') : ''}; ${role}${i.cause ? ' – es ging um ' + i.cause : ''}`)
    if (who.outcome === 'verletzt') facts.push('Du bist verletzt und hast Schmerzen; du willst eher Hilfe als Gespräch')
    if (who.outcome === 'am_boden') facts.push('Du bist hingefallen und rappelst dich gerade wieder auf')
    if (i.removedIds.includes(personId)) facts.push('Du musst das Lokal verlassen')
  } else {
    facts.push(`${running ? 'Gerade gibt es' : 'Eben gab es'} hier ${what}${others.length ? ' zwischen ' + others.join(' und ') : ''}; alle sind aufgeregt`)
    if (i.removedIds.length) facts.push('Wer angefangen hat, wird hinausbegleitet')
  }
  facts.push('Erfinde keine Einzelheiten, die du nicht gesehen haben kannst')
  return facts.map(f => f.length > 150 ? f.slice(0, 149) + '…' : f)
}

/** Hinweis für den Spieler. */
export function incidentNotice(i: VenueIncident, tick: number): string {
  if (incidentRunning(i, tick)) return i.level === 'kampf' ? 'Eine Schlägerei! Halte Abstand – oder hol den Türsteher.' : 'Eine Rangelei am Tisch – es wird laut.'
  const hurt = i.participants.some(p => p.outcome === 'verletzt')
  return hurt ? 'Nach dem Streit: Jemand ist verletzt.' : 'Der Streit ist vorbei; die Stimmung ist angespannt.'
}
