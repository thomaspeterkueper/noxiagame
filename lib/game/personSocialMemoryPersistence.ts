// NOXIA-LIVING — persistent, idempotent projection of population events into social memory.
// Persistence is deliberately separate from the pure population tick.

import { deriveEmergentGoals, memoryFromPopulationEvent, projectRelationship, type PersonMemory } from './personSocialMemory'
import type { PersonRelationship, PopulationEvent } from './population/types'

export interface SocialMemoryProjectionResult {
  considered: number
  memoriesInserted: number
  memoriesExisting: number
  relationshipsUpdated: number
  errors: string[]
}

function memoryRow(memory: PersonMemory) {
  return {
    person_id: memory.personId,
    other_person_id: memory.otherPersonId ?? null,
    location_id: memory.locationId ?? null,
    memory_kind: memory.kind,
    tick: memory.tick,
    salience: memory.salience,
    valence: memory.valence,
    trust_delta: memory.trustDelta,
    summary: memory.summary,
    source_event_id: memory.sourceEventId,
  }
}

function relationshipFromRow(row: any): PersonRelationship | null {
  if (!row) return null
  return {
    id: row.id,
    personId: row.person_id,
    otherPersonId: row.other_person_id,
    relationshipType: row.relationship_type,
    familiarity: Number(row.familiarity),
    trust: Number(row.trust),
    affinity: Number(row.affinity),
    lastInteractionTick: row.last_interaction_tick == null ? null : Number(row.last_interaction_tick),
  }
}

export async function persistPopulationEventMemory(supabase: any, event: PopulationEvent, options: { projectRelationship?: boolean } = {}): Promise<SocialMemoryProjectionResult> {
  const result: SocialMemoryProjectionResult = { considered: 1, memoriesInserted: 0, memoriesExisting: 0, relationshipsUpdated: 0, errors: [] }
  const memory = memoryFromPopulationEvent(event)
  if (!memory) return result

  // Replay guard: source event + person is the canonical memory identity.
  const { data: existing, error: existingError } = await supabase
    .from('person_memories')
    .select('id')
    .eq('person_id', memory.personId)
    .eq('source_event_id', memory.sourceEventId)
    .maybeSingle()
  if (existingError) { result.errors.push(`memory lookup: ${existingError.message ?? existingError}`); return result }
  if (existing) { result.memoriesExisting++; return result }

  // Insert memory first. The DB unique constraint is the final concurrency guard.
  const { error: memoryError } = await supabase.from('person_memories').insert(memoryRow(memory))
  if (memoryError) {
    // A concurrent/replayed projector may have won after our lookup.
    if (String(memoryError.code ?? '') === '23505') { result.memoriesExisting++; return result }
    result.errors.push(`memory insert: ${memoryError.message ?? memoryError}`)
    return result
  }
  result.memoriesInserted++

  if (!memory.otherPersonId || options.projectRelationship === false) return result
  const { data: relationRow, error: relationError } = await supabase
    .from('person_relationships')
    .select('id, person_id, other_person_id, relationship_type, familiarity, trust, affinity, last_interaction_tick')
    .eq('person_id', memory.personId)
    .eq('other_person_id', memory.otherPersonId)
    .maybeSingle()
  if (relationError) { result.errors.push(`relationship lookup: ${relationError.message ?? relationError}`); return result }

  const projected = projectRelationship(relationshipFromRow(relationRow), memory)
  if (!projected) return result
  const row = {
    id: projected.id,
    person_id: projected.personId,
    other_person_id: projected.otherPersonId,
    relationship_type: projected.relationshipType,
    familiarity: projected.familiarity,
    trust: projected.trust,
    affinity: projected.affinity,
    last_interaction_tick: projected.lastInteractionTick,
  }
  const { error: upsertError } = await supabase.from('person_relationships').upsert(row, { onConflict: 'person_id,other_person_id' })
  if (upsertError) result.errors.push(`relationship upsert: ${upsertError.message ?? upsertError}`)
  else result.relationshipsUpdated++
  return result
}

export async function persistPopulationEventMemories(supabase: any, events: PopulationEvent[]): Promise<SocialMemoryProjectionResult> {
  const total: SocialMemoryProjectionResult = { considered: 0, memoriesInserted: 0, memoriesExisting: 0, relationshipsUpdated: 0, errors: [] }
  for (const event of events) {
    const r = await persistPopulationEventMemory(supabase, event)
    total.considered += r.considered
    total.memoriesInserted += r.memoriesInserted
    total.memoriesExisting += r.memoriesExisting
    total.relationshipsUpdated += r.relationshipsUpdated
    total.errors.push(...r.errors.map((error) => `${event.id}: ${error}`))
  }
  return total
}


function memoryFromRow(row: any): PersonMemory {
  return { id: row.id, personId: row.person_id, otherPersonId: row.other_person_id ?? null, locationId: row.location_id ?? null, kind: row.memory_kind, tick: Number(row.tick), salience: Number(row.salience), valence: Number(row.valence), trustDelta: Number(row.trust_delta), summary: row.summary, sourceEventId: row.source_event_id }
}

/** Recompute bounded emergent goals from the persisted memory log. Safe to replay. */
export async function reconcileEmergentGoals(supabase: any, personId: string): Promise<{ derived: number; upserted: number; errors: string[] }> {
  const result = { derived: 0, upserted: 0, errors: [] as string[] }
  const { data: rows, error } = await supabase.from('person_memories')
    .select('id, person_id, other_person_id, location_id, memory_kind, tick, salience, valence, trust_delta, summary, source_event_id')
    .eq('person_id', personId).order('tick', { ascending: true }).limit(200)
  if (error) { result.errors.push(`memory goal scan: ${error.message ?? error}`); return result }
  const goals = deriveEmergentGoals((rows ?? []).map(memoryFromRow))
  result.derived = goals.length
  for (const goal of goals) {
    const query = supabase.from('person_goals').select('id, progress').eq('person_id', personId).eq('goal_code', goal.code).eq('status', 'active')
    const scoped = goal.subjectRef == null ? query.is('subject_ref', null) : query.eq('subject_ref', goal.subjectRef)
    const { data: existing, error: lookupError } = await scoped.limit(1).maybeSingle()
    if (lookupError) { result.errors.push(`goal lookup ${goal.code}: ${lookupError.message ?? lookupError}`); continue }
    if (existing) {
      const { error: updateError } = await supabase.from('person_goals').update({ priority: goal.priority, updated_tick: goal.latestTick, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (updateError) result.errors.push(`goal update ${goal.code}: ${updateError.message ?? updateError}`)
      else result.upserted++
    } else {
      const { error: insertError } = await supabase.from('person_goals').insert({ person_id: personId, goal_code: goal.code, subject_type: goal.subjectType, subject_ref: goal.subjectRef, priority: goal.priority, progress: 0, status: 'active', created_tick: goal.latestTick, updated_tick: goal.latestTick })
      if (insertError) result.errors.push(`goal insert ${goal.code}: ${insertError.message ?? insertError}`)
      else result.upserted++
    }
  }
  return result
}
