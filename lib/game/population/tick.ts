// lib/game/population/tick.ts
// Version: 0.2.0
// Reiner, deterministischer Population-Tick. Persistenz und Weltmutation erfolgen bewusst separat.

import { actionIntentForDecision, type PopulationIntentResult } from './actionIntent'
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
  intent: PopulationIntentResult
  events: PopulationEvent[]
}

const NEED_DELTAS: Partial<Record<PopulationAction, Partial<Record<PersonNeed['needCode'], number>>>> = {
  work: { sustenance: -0.04, rest: -0.06, social: -0.01, purpose: 0.1 },
  rest: { sustenance: -0.01, rest: 0.24, safety: 0.02 },
  satisfy_basic_need: { sustenance: 0.22, safety: 0.08 },
  travel_home: { sustenance: -0.02, rest: -0.03, safety: 0.03 },
  travel_work: { sustenance: -0.02, rest: -0.03, purpose: 0.02 },
  social_interaction: { sustenance: -0.01, rest: -0.01, social: 0.2, purpose: 0.03 },
  seek_medical_care: {},
  inspect_problem: { rest: -0.03, safety: -0.01, purpose: 0.08 },
  report_problem: { social: 0.02, purpose: 0.09 },
}

function eventTypeForAction(action: PopulationAction, intent: PopulationIntentResult): string {
  if (!intent.ok) return 'npc_action_blocked'
  switch (action) {
    case 'work': return 'npc_started_work'
    case 'rest': return 'npc_resting'
    case 'satisfy_basic_need': return 'npc_satisfied_basic_need'
    case 'travel_home':
    case 'travel_work': return 'npc_started_travel'
    case 'social_interaction': return 'npc_met_person'
    case 'seek_medical_care': return 'npc_seeking_medical_care'
    case 'inspect_problem': return 'npc_observed_problem'
    case 'report_problem': return 'npc_reported_problem'
  }
}

function activityForAction(action: PopulationAction, intent: PopulationIntentResult): Person['activityState'] {
  if (!intent.ok) return 'idle'
  switch (action) {
    case 'work': return 'working'
    case 'rest': return 'resting'
    case 'satisfy_basic_need': return 'idle'
    case 'travel_home':
    case 'travel_work': return 'travelling'
    case 'social_interaction': return 'socialising'
    case 'seek_medical_care': return 'travelling'
    case 'inspect_problem':
    case 'report_problem': return 'inspecting'
  }
}

function updateNeeds(needs: PersonNeed[], action: PopulationAction, tick: number, intent: PopulationIntentResult): PersonNeed[] {
  if (!intent.ok || intent.intent.kind === 'travel' || intent.intent.kind === 'work') return needs
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
  const intent = actionIntentForDecision({
    personId: input.person.id,
    currentLocationId: input.person.currentLocationId,
    assignments: input.assignments,
    decision,
  })
  const blocker = 'reason' in intent ? intent.reason : null

  const person: Person = {
    ...input.person,
    activityState: activityForAction(decision.action, intent),
    lastAction: intent.ok ? decision.action : `blocked:${decision.action}`,
    lastDecisionFactors: {
      ...decision.factors,
      score: decision.score,
      ...(blocker ? { blocker } : {}),
    },
    lastTick: input.tick,
  }
  const needs = updateNeeds(input.needs, decision.action, input.tick, intent)
  const subject = eventSubject(decision)
  const relatedPersonId = relatedPersonForAction(input, decision.action)

  const event: PopulationEvent = {
    id: `population:${input.tick}:${input.person.id}:${decision.action}`,
    tick: input.tick,
    eventType: eventTypeForAction(decision.action, intent),
    actorPersonId: input.person.id,
    relatedPersonId,
    locationId: input.person.currentLocationId,
    subjectType: subject.subjectType,
    subjectRef: subject.subjectRef,
    payload: {
      action: decision.action,
      score: decision.score,
      factors: decision.factors,
      intent: intent.ok ? intent.intent : null,
      blocker,
    },
  }

  return { tick: input.tick, person, needs, decision, intent, events: [event] }
}
