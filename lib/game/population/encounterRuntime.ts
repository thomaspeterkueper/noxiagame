// NOXIA-LIVING — persistence adapter for deterministic co-location encounters.
// Uses existing people, assignments and population_events; no parallel presence store.

import { derivePopulationEncounters, type EncounterCandidate } from './encounters'
import type { Person, PersonActivityState, PersonAssignment } from './types'

type SupabaseLike = any

function assignmentTile(activity: PersonActivityState, assignments: PersonAssignment[]): string | null {
  const type = activity === 'working' || activity === 'inspecting' ? 'work'
    : activity === 'resting' ? 'home'
    : null
  if (!type) return null
  return assignments.find(a => a.isActive && a.assignmentType === type)?.tileEntityId ?? null
}

export async function persistPopulationEncounters(supabase: SupabaseLike, tick: number) {
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, display_name, birth_year, current_location_id, simulation_tier, activity_state, last_action, last_decision_factors, last_tick')
    .eq('simulation_tier', 'active')
    .neq('activity_state', 'travelling')
    .order('id')
    .limit(100)

  if (peopleError) return { candidates: 0, encounters: 0, events: 0, skipped: true, reason: 'people_unavailable' }
  const personIds = (people ?? []).map((p: any) => p.id)
  if (!personIds.length) return { candidates: 0, encounters: 0, events: 0, skipped: false }

  const { data: rows, error: assignmentError } = await supabase
    .from('person_assignments')
    .select('id, person_id, assignment_type, location_id, tile_entity_id, employer_actor_id, role_code, starts_tick, ends_tick, is_active')
    .in('person_id', personIds)
    .eq('is_active', true)

  if (assignmentError) return { candidates: 0, encounters: 0, events: 0, skipped: true, reason: 'assignments_unavailable' }

  const assignments = (rows ?? []).map((r: any): PersonAssignment => ({
    id: r.id, personId: r.person_id, assignmentType: r.assignment_type, locationId: r.location_id,
    tileEntityId: r.tile_entity_id ?? null, employerActorId: r.employer_actor_id ?? null,
    roleCode: r.role_code ?? null, startsTick: r.starts_tick ?? null, endsTick: r.ends_tick ?? null,
    isActive: Boolean(r.is_active),
  }))

  // Runtime encounters deliberately require building/tile-level presence.
  // Location-only state is too coarse: it would make an entire colony "meet" every tick.
  const candidates: EncounterCandidate[] = (people ?? []).flatMap((p: any) => {
    const person: Person = {
      id: p.id, displayName: p.display_name, birthYear: p.birth_year ?? null,
      currentLocationId: p.current_location_id, simulationTier: p.simulation_tier,
      activityState: p.activity_state, lastAction: p.last_action ?? null,
      lastDecisionFactors: p.last_decision_factors ?? {}, lastTick: p.last_tick ?? null,
    }
    const tileEntityId = assignmentTile(person.activityState, assignments.filter(a => a.personId === person.id))
    return tileEntityId ? [{ person, tileEntityId }] : []
  })

  const encounters = derivePopulationEncounters({ tick, candidates })
  if (!encounters.length) return { candidates: candidates.length, encounters: 0, events: 0, skipped: false }

  const rowsToInsert = encounters.flatMap(encounter => [encounter.eventA, encounter.eventB]).map(event => ({
    tick: event.tick,
    event_type: event.eventType,
    actor_person_id: event.actorPersonId,
    related_person_id: event.relatedPersonId,
    location_id: event.locationId,
    subject_type: event.subjectType,
    subject_ref: event.subjectRef,
    payload: event.payload,
  }))

  // Retry-safe without adding a second persistence model: if this tick already has
  // encounter events, suppress identical actor/partner pairs before insert.
  const { data: existing } = await supabase
    .from('population_events')
    .select('actor_person_id, related_person_id')
    .eq('tick', tick)
    .eq('event_type', 'social_interaction')

  const keys = new Set((existing ?? []).map((e: any) => `${e.actor_person_id}:${e.related_person_id}`))
  const pending = rowsToInsert.filter(row => !keys.has(`${row.actor_person_id}:${row.related_person_id}`))
  if (pending.length) {
    const { error } = await supabase.from('population_events').insert(pending)
    if (error) throw error
  }

  return { candidates: candidates.length, encounters: encounters.length, events: pending.length, skipped: false }
}
