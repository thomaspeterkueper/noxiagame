// lib/game/population/tick.ts
// Version: 0.1.0
// Reiner, deterministischer Population-Tick. Persistenz erfolgt bewusst separat.

import { decidePopulationAction, type PopulationDecisionContext } from './decision'
import {
  clampUnit,
  type Person,
  type PersonNeed,
  type PopulationAction,
  type PopulationDecision,
  type PopulationEvent,
} from './types'

export interface PopulationTickInput extends PopulationDecisionContext {
  tick: number
}

export interface PopulationTickResult {
  tick: number
  person: Person
  needs: PersonNeed[]
  decision: PopulationDecision
  events: PopulationEvent[]
}

const NEED_DELTAS: Partial<Record<PopulationAction, Partial<Record<PersonNeed['needCode'], number>>>> = {
  work: { sustenance: -0.04, rest: -0.06, social: -0.01, purpose: 0.1 },
  rest: { sustenance: -0.01, rest: 0.24, safety: 0.02 },
  satisfy_basic_need: { sustenance: 0.22, safety: 0.08 },
  travel_home: { sustenance: -0.02, rest: -0.03, safety: 0.03 },
  travel_work: { sustenance: -0.02, rest: -0.03, purpose: 0.02 },
  social_interaction: { sustenance: -0.01, rest: -0.01, social: 0.2, purpose: 0.03 },
  inspect_problem: { rest: -0.03, safety: -0.01, purpose: 0.08 },
  report_problem: { social: 0.02, purpose: 0.09 },
}

function eventTypeForAction(action: PopulationAction): string {
  switch (action) {
    case 'work': return 'npc_started_work'
    case 'rest': return 'npc_resting'
    case 'satisfy_basic_need': return 'npc_satisfied_basic_need'
    case 'travel_home': return 'npc_travelled_home'
    case 'travel_work': return 'npc_travelled_work'
    case 'social_interaction': return 'npc_met_person'
    case 'inspect_problem': return 'npc_observed_problem'
    case 'report_problem': return 'npc_reported_problem'
  }
}

function activityForAction(action: PopulationAction): Person['activityState'] {
  switch (action) {
    case 'work': return 'working'
    case 'rest': return 'resting'
    case 'satisfy_basic_need': return 'idle'
    case 'travel_home':
    case 'travel_work': return 'travelling'
    case 'social_interaction': return 'socialising'
    case 'inspect_problem':
    case 'report_problem': return 'inspecting'
  }
}

function updateLocationForTravel(input: PopulationTickInput, action: PopulationAction): string {
  if (action !== 'travel_home' && action !== 'travel_work') return input.person.currentLocationId
  const assignmentType = action === 'travel_home' ? 'home' : 'work'
  const assignment = input.assignments.find((entry) => entry.assignmentType === assignmentType && entry.isActive)
  return assignment?.locationId ?? input.person.currentLocationId
}

function updateNeeds(needs: PersonNeed[], action: PopulationAction, tick: number): PersonNeed[] {
  const deltas = NEED_DELTAS[action] ?? {}
  return needs.map((need) => ({
    ...need,
    satisfaction: clampUnit(need.satisfaction + (deltas[need.needCode] ?? 0)),
    updatedTick: tick,
  }))
}

function relatedPersonForAction(input: PopulationTickInput, action: PopulationAction): string | null {
  if (action !== 'social_interaction') return null
  const sorted = [...input.relationships].sort((a, b) => {
    const aScore = a.familiarity + a.trust + a.affinity
    const bScore = b.familiarity + b.trust + b.affinity
    if (bScore !== aScore) return bScore - aScore
    return a.otherPersonId.localeCompare(b.otherPersonId)
  })
  return sorted[0]?.otherPersonId ?? null
}

function eventSubject(decision: PopulationDecision): { subjectType: string | null; subjectRef: string | null } {
  const ref = typeof decision.factors.subjectRef === 'string' ? decision.factors.subjectRef : ''
  if (!ref) return { subjectType: null, subjectRef: null }
  return { subjectType: 'problem', subjectRef: ref }
}

export function runPopulationTick(input: PopulationTickInput): PopulationTickResult {
  const decision = decidePopulationAction(input)
  const currentLocationId = updateLocationForTravel(input, decision.action)
  const person: Person = {
    ...input.person,
    currentLocationId,
    activityState: activityForAction(decision.action),
    lastAction: decision.action,
    lastDecisionFactors: { ...decision.factors, score: decision.score },
    lastTick: input.tick,
  }
  const needs = updateNeeds(input.needs, decision.action, input.tick)
  const subject = eventSubject(decision)
  const relatedPersonId = relatedPersonForAction(input, decision.action)

  const event: PopulationEvent = {
    id: `population:${input.tick}:${input.person.id}:${decision.action}`,
    tick: input.tick,
    eventType: eventTypeForAction(decision.action),
    actorPersonId: input.person.id,
    relatedPersonId,
    locationId: currentLocationId,
    subjectType: subject.subjectType,
    subjectRef: subject.subjectRef,
    payload: {
      action: decision.action,
      score: decision.score,
      factors: decision.factors,
    },
  }

  return {
    tick: input.tick,
    person,
    needs,
    decision,
    events: [event],
  }
}
