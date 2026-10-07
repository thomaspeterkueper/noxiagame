// lib/game/population/affectRuntime.ts
// NOXIA-LIVING-0006 — persistence adapter for the pure affect layer.
//
// Affect is downstream of authoritative population events and is never
// load-bearing: every failure here (including a missing table before the
// migration is applied) degrades to "no affect" instead of failing the tick.

import {
  affectProfileFromTraits,
  applyAffect,
  applyPain,
  appraisalFromPopulationEvent,
  appraiseEvent,
  decayAffect,
  learnPlaceAversion,
  neutralAffect,
  painFromHealthEvent,
  placeSafetyPenalty,
  type AffectState,
  type EventAppraisalContext,
  type PainSource,
  type PlaceAversion,
} from '../cognition/personAffect'
import type { PersonNeed, PopulationEvent } from './types'

type SupabaseLike = any

export function affectFromRow(row: any): AffectState {
  return {
    personId: row.person_id,
    joy: Number(row.joy ?? 0),
    fear: Number(row.fear ?? 0),
    anger: Number(row.anger ?? 0),
    sadness: Number(row.sadness ?? 0),
    mood: Number(row.mood ?? 0),
    pain: Number(row.pain ?? 0),
    updatedTick: row.updated_tick == null ? null : Number(row.updated_tick),
  }
}

function affectRow(state: AffectState, sourceEventId: string | null) {
  return {
    person_id: state.personId,
    joy: state.joy,
    fear: state.fear,
    anger: state.anger,
    sadness: state.sadness,
    mood: state.mood,
    pain: state.pain,
    source_event_id: sourceEventId,
    updated_tick: state.updatedTick,
    updated_at: new Date().toISOString(),
  }
}

export interface AffectSnapshot {
  affectByPerson: Map<string, AffectState>
  aversionsByPerson: Map<string, PlaceAversion[]>
  available: boolean
}

/** Batch read for a tick. Returns an empty, unavailable snapshot on any error. */
export async function loadAffectSnapshot(supabase: SupabaseLike, personIds: string[]): Promise<AffectSnapshot> {
  const snapshot: AffectSnapshot = { affectByPerson: new Map(), aversionsByPerson: new Map(), available: false }
  if (!personIds.length) return { ...snapshot, available: true }
  try {
    const [affect, aversions] = await Promise.all([
      supabase.from('person_affect').select('*').in('person_id', personIds),
      supabase.from('person_place_aversions').select('person_id, location_id, strength, learned_tick').in('person_id', personIds),
    ])
    if (affect.error || aversions.error) return snapshot
    for (const row of affect.data ?? []) snapshot.affectByPerson.set(row.person_id, affectFromRow(row))
    for (const row of aversions.data ?? []) {
      const rows = snapshot.aversionsByPerson.get(row.person_id) ?? []
      rows.push({ locationId: row.location_id, strength: Number(row.strength), learnedTick: Number(row.learned_tick) })
      snapshot.aversionsByPerson.set(row.person_id, rows)
    }
    return { ...snapshot, available: true }
  } catch {
    return snapshot
  }
}

/** Current felt affect for a decision, decayed to `tick`. Undefined when the person has none. */
export function affectForDecision(
  snapshot: AffectSnapshot,
  personId: string,
  tick: number,
  traits: Record<string, unknown> | null | undefined,
): AffectState | undefined {
  const stored = snapshot.affectByPerson.get(personId)
  return stored ? decayAffect(stored, tick, affectProfileFromTraits(traits)) : undefined
}

/** A place that hurt before feels less safe: lowers the safety need for this decision only. */
export function needsWithPlaceAversion<T extends Pick<PersonNeed, 'needCode' | 'satisfaction'>>(
  needs: T[],
  aversions: PlaceAversion[] | undefined,
  locationId: string,
  tick: number,
): T[] {
  const penalty = aversions?.length ? placeSafetyPenalty(aversions, locationId, tick) : 0
  if (penalty <= 0) return needs
  return needs.map((need) => need.needCode === 'safety'
    ? { ...need, satisfaction: Math.max(0, need.satisfaction - penalty) }
    : need)
}

export type AffectWriteResult = 'applied' | 'no_affect' | 'replayed' | 'unavailable'

async function readAffect(supabase: SupabaseLike, personId: string): Promise<{ state: AffectState; sourceEventId: string | null } | null> {
  const { data, error } = await supabase.from('person_affect').select('*').eq('person_id', personId).maybeSingle()
  if (error) return null
  return data
    ? { state: affectFromRow(data), sourceEventId: data.source_event_id ?? null }
    : { state: neutralAffect(personId), sourceEventId: null }
}

/**
 * Folds one persisted population event into the actor's affect.
 * Call only with the DB id of the event; replays of the same event are ignored.
 */
export async function applyEventAffect(
  supabase: SupabaseLike,
  event: PopulationEvent,
  context: EventAppraisalContext & { traits?: Record<string, unknown> | null },
): Promise<AffectWriteResult> {
  if (!event.actorPersonId) return 'no_affect'
  const appraisal = appraisalFromPopulationEvent(event, context)
  if (!appraisal) return 'no_affect'
  try {
    const current = await readAffect(supabase, event.actorPersonId)
    if (!current) return 'unavailable'
    if (current.sourceEventId === event.id) return 'replayed'
    const profile = affectProfileFromTraits(context.traits)
    const next = applyAffect(current.state, appraiseEvent(appraisal, profile), event.tick, profile)
    const { error } = await supabase.from('person_affect').upsert(affectRow(next, event.id), { onConflict: 'person_id' })
    return error ? 'unavailable' : 'applied'
  } catch {
    return 'unavailable'
  }
}

/** Folds a health event into pain, its emotional echo and a learned place aversion. */
export async function applyHealthEventAffect(
  supabase: SupabaseLike,
  input: {
    personId: string
    locationId: string | null
    tick: number
    event: { eventType: PainSource; severity: number }
    sourceEventId: string
  },
): Promise<AffectWriteResult> {
  try {
    const current = await readAffect(supabase, input.personId)
    if (!current) return 'unavailable'
    if (current.sourceEventId === input.sourceEventId) return 'replayed'
    const { data: person } = await supabase.from('people').select('traits').eq('id', input.personId).maybeSingle()
    const profile = affectProfileFromTraits(person?.traits ?? null)
    const pain = painFromHealthEvent(input.event, profile)
    const next = applyPain(current.state, pain, input.tick, profile)
    const { error } = await supabase.from('person_affect').upsert(affectRow(next, input.sourceEventId), { onConflict: 'person_id' })
    if (error) return 'unavailable'

    const aversion = learnPlaceAversion(pain, input.locationId, input.tick)
    if (aversion) {
      const { data: existing } = await supabase.from('person_place_aversions')
        .select('strength, learned_tick').eq('person_id', input.personId).eq('location_id', aversion.locationId).maybeSingle()
      // Keep whichever is currently stronger: the old one faded, the new one is fresh.
      const remaining = existing
        ? placeSafetyPenalty([{ locationId: aversion.locationId, strength: Number(existing.strength), learnedTick: Number(existing.learned_tick) }], aversion.locationId, input.tick) / 0.4
        : 0
      if (aversion.strength >= remaining) {
        await supabase.from('person_place_aversions').upsert({
          person_id: input.personId,
          location_id: aversion.locationId,
          strength: aversion.strength,
          learned_tick: aversion.learnedTick,
          source_event_id: input.sourceEventId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'person_id,location_id' })
      }
    }
    return 'applied'
  } catch {
    return 'unavailable'
  }
}
