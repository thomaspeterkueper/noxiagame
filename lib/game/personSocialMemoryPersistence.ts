// NOXIA-LIVING — persistent, idempotent projection of population events into social memory.
// Persistence is deliberately separate from the pure population tick.

import { memoryFromPopulationEvent, projectRelationship, type PersonMemory } from './personSocialMemory'
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
