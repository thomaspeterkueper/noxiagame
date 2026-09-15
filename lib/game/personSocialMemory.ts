// NOXIA-LIVING — deterministic personal memory projection.
// Extends the existing population relationship model; it does not replace it.

import type { PersonRelationship, PopulationEvent } from './population/types'

export type PersonMemoryKind = 'interaction' | 'assistance' | 'conflict' | 'shared_work' | 'crisis'
export interface PersonMemory { id: string; personId: string; otherPersonId?: string | null; locationId?: string | null; kind: PersonMemoryKind; tick: number; salience: number; valence: number; trustDelta: number; summary: string; sourceEventId: string }
export interface PersonLongTermGoal { id: string; personId: string; code: string; subjectType?: string | null; subjectRef?: string | null; priority: number; progress: number; status: 'active' | 'completed' | 'abandoned'; createdTick: number; updatedTick: number }

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)) }
function numberPayload(payload: Record<string, unknown>, key: string, fallback: number): number { return typeof payload[key] === 'number' ? Number(payload[key]) : fallback }

/** Pure deterministic projection. Unknown events deliberately produce no memory. */
export function memoryFromPopulationEvent(event: PopulationEvent): PersonMemory | null {
  if (!event.actorPersonId) return null
  const p = event.payload ?? {}
  let kind: PersonMemoryKind | null = null
  let defaultValence = 0, defaultTrust = 0, defaultSalience = 0.4
  if (event.eventType === 'npc_social_interaction' || event.eventType === 'social_interaction') { if (!event.relatedPersonId) return null; kind = 'interaction'; defaultValence = 0.2; defaultTrust = 0.04; defaultSalience = 0.45 }
  else if (event.eventType === 'person_assistance' || event.eventType === 'npc_assistance') { if (!event.relatedPersonId) return null; kind = 'assistance'; defaultValence = 0.65; defaultTrust = 0.12; defaultSalience = 0.7 }
  else if (event.eventType === 'person_conflict' || event.eventType === 'npc_conflict') { if (!event.relatedPersonId) return null; kind = 'conflict'; defaultValence = -0.65; defaultTrust = -0.15; defaultSalience = 0.75 }
  else if (event.eventType === 'shared_work') { if (!event.relatedPersonId) return null; kind = 'shared_work'; defaultValence = 0.25; defaultTrust = 0.05; defaultSalience = 0.5 }
  else if (event.eventType === 'crisis_experience') { kind = 'crisis'; defaultValence = -0.4; defaultSalience = 0.85 }
  else return null
  return { id: `memory:${event.id}:${event.actorPersonId}`, personId: event.actorPersonId, otherPersonId: event.relatedPersonId, locationId: event.locationId, kind, tick: event.tick, salience: clamp(numberPayload(p, 'salience', defaultSalience), 0, 1), valence: clamp(numberPayload(p, 'valence', defaultValence), -1, 1), trustDelta: clamp(numberPayload(p, 'trustDelta', defaultTrust), -1, 1), summary: typeof p.summary === 'string' && p.summary.trim() ? p.summary.trim() : `${kind}:${event.subjectRef ?? event.relatedPersonId ?? event.locationId ?? 'event'}`, sourceEventId: event.id }
}

/** Project one memory onto the already-existing PersonRelationship shape. */
export function projectRelationship(current: PersonRelationship | null, memory: PersonMemory): PersonRelationship | null {
  if (!memory.otherPersonId || memory.otherPersonId === memory.personId) return current
  const base: PersonRelationship = current ?? { id: `relationship:${memory.personId}:${memory.otherPersonId}`, personId: memory.personId, otherPersonId: memory.otherPersonId, relationshipType: 'acquaintance', familiarity: 0, trust: 0.5, affinity: 0.5, lastInteractionTick: null }
  if (base.personId !== memory.personId || base.otherPersonId !== memory.otherPersonId) throw new Error('relationship identity does not match memory')
  const weight = 0.15 + 0.85 * clamp(memory.salience, 0, 1)
  return { ...base, familiarity: clamp(base.familiarity + 0.04 + memory.salience * 0.12, 0, 1), trust: clamp(base.trust + memory.trustDelta * weight, 0, 1), affinity: clamp(base.affinity + memory.valence * weight * 0.08, 0, 1), lastInteractionTick: Math.max(base.lastInteractionTick ?? 0, memory.tick) }
}

export function relationshipDecisionFactors(relationships: PersonRelationship[], goals: PersonLongTermGoal[]): Record<string, unknown> {
  const trusted = relationships.filter((r) => r.trust > 0.6).sort((a, b) => (b.trust - a.trust) || a.otherPersonId.localeCompare(b.otherPersonId)).slice(0, 5).map((r) => ({ personId: r.otherPersonId, trust: r.trust, familiarity: r.familiarity, affinity: r.affinity }))
  const activeGoals = goals.filter((g) => g.status === 'active').sort((a, b) => (b.priority - a.priority) || a.id.localeCompare(b.id)).slice(0, 5).map((g) => ({ id: g.id, code: g.code, priority: clamp(g.priority, 0, 1), progress: clamp(g.progress, 0, 1), subjectType: g.subjectType ?? null, subjectRef: g.subjectRef ?? null }))
  return { trusted, activeGoals }
}
