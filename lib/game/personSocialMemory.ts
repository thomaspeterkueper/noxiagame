// NOXIA-LIVING — deterministic personal memory and relationship projection
// Memory is simulation truth derived from auditable events; no LLM writes state.

export type PersonMemoryKind = 'interaction' | 'assistance' | 'conflict' | 'shared_work' | 'crisis'

export interface PersonMemory {
  id: string
  personId: string
  otherPersonId?: string | null
  locationId?: string | null
  kind: PersonMemoryKind
  tick: number
  salience: number
  valence: number
  trustDelta: number
  summary: string
  sourceEventId?: string | null
}

export interface PersonRelationshipState {
  personId: string
  otherPersonId: string
  familiarity: number
  trust: number
  supportBalance: number
  lastInteractionTick: number
}

export interface PersonLongTermGoal {
  id: string
  personId: string
  code: string
  subjectType?: string | null
  subjectRef?: string | null
  priority: number
  progress: number
  status: 'active' | 'completed' | 'abandoned'
  createdTick: number
  updatedTick: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0))
}

export function normalizeMemory(memory: PersonMemory): PersonMemory {
  return {
    ...memory,
    salience: clamp(memory.salience, 0, 1),
    valence: clamp(memory.valence, -1, 1),
    trustDelta: clamp(memory.trustDelta, -1, 1),
  }
}

export function projectRelationship(
  current: PersonRelationshipState | null,
  memory: PersonMemory,
): PersonRelationshipState | null {
  if (!memory.otherPersonId || memory.otherPersonId === memory.personId) return current
  const m = normalizeMemory(memory)
  const base: PersonRelationshipState = current ?? {
    personId: m.personId,
    otherPersonId: m.otherPersonId,
    familiarity: 0,
    trust: 0,
    supportBalance: 0,
    lastInteractionTick: m.tick,
  }
  if (base.personId !== m.personId || base.otherPersonId !== m.otherPersonId) {
    throw new Error('relationship identity does not match memory')
  }
  const weight = 0.15 + 0.85 * m.salience
  const support = m.kind === 'assistance' ? m.valence * weight : 0
  return {
    ...base,
    familiarity: clamp(base.familiarity + 0.04 + m.salience * 0.12, 0, 1),
    trust: clamp(base.trust + m.trustDelta * weight, -1, 1),
    supportBalance: clamp(base.supportBalance + support, -10, 10),
    lastInteractionTick: Math.max(base.lastInteractionTick, m.tick),
  }
}

export function relationshipDecisionFactors(
  relationships: PersonRelationshipState[],
  goals: PersonLongTermGoal[],
): Record<string, unknown> {
  const trusted = relationships
    .filter((r) => r.trust > 0.25)
    .sort((a, b) => (b.trust - a.trust) || a.otherPersonId.localeCompare(b.otherPersonId))
    .slice(0, 5)
    .map((r) => ({ personId: r.otherPersonId, trust: r.trust, familiarity: r.familiarity }))
  const activeGoals = goals
    .filter((g) => g.status === 'active')
    .sort((a, b) => (b.priority - a.priority) || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((g) => ({ id: g.id, code: g.code, priority: clamp(g.priority, 0, 1), progress: clamp(g.progress, 0, 1), subjectType: g.subjectType ?? null, subjectRef: g.subjectRef ?? null }))
  return { trusted, activeGoals }
}
