// NOXIA-LIVING — bridge from deterministic population decisions to validated world actions.
//
// This module deliberately does not mutate world state. It translates a decision into
// an auditable intent that an authoritative domain-action adapter may validate/execute.

import { evaluatePersonActionAffordance, type PersonActionAffordanceBlocker, type PersonActionAffordanceRequest } from './actionAffordance'
import type { PersonAssignment, PersonKnowledge, PersonRelationship, PopulationDecision, SimulationTier } from './types'

export type PopulationActionIntent =
  | {
      kind: 'travel'
      personId: string
      assignmentId: string
      destinationLocationId: string
      destinationTileEntityId: string | null
      purpose: 'home' | 'work'
    }
  | {
      kind: 'work'
      personId: string
      assignmentId: string
      locationId: string
      tileEntityId: string | null
      employerActorId: string | null
      roleCode: string | null
    }
  | { kind: 'acquire_tool'; personId: string; toolType: string; purpose: 'research' }
  | { kind: 'gain_capability'; personId: string; capability: string; minLevel: number; purpose: 'research' }
  | { kind: 'secure_resource'; personId: string; resource: 'credits' | 'energy' | 'time'; amount: number; purpose: 'research' }
  | {
      kind: 'local'
      personId: string
      action: Exclude<PopulationDecision['action'], 'travel_home' | 'travel_work' | 'work'>
      subjectRef: string | null
      relatedPersonId?: string | null
    }

export type PopulationIntentBlocker = 'missing_home_assignment' | 'missing_work_assignment' | 'work_location_mismatch' | PersonActionAffordanceBlocker

export type PopulationIntentResult =
  | { ok: true; intent: PopulationActionIntent }
  | { ok: false; reason: PopulationIntentBlocker }

function activeAssignment(assignments: PersonAssignment[], type: 'home' | 'work') {
  return assignments.find((assignment) => assignment.assignmentType === type && assignment.isActive) ?? null
}

function subjectRef(decision: PopulationDecision): string | null {
  return typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef
    ? decision.factors.subjectRef
    : null
}

function affordanceRequestForDecision(
  decision: PopulationDecision,
  relationships: PersonRelationship[],
  knowledge: PersonKnowledge[],
): PersonActionAffordanceRequest | null {
  if (decision.action === 'work' || decision.action === 'travel_home' || decision.action === 'travel_work') {
    return { action: decision.action }
  }
  if (decision.action === 'social_interaction') {
    const target = relationships
      .slice()
      .sort((a, b) => (b.familiarity + b.trust + b.affinity) - (a.familiarity + a.trust + a.affinity)
        || a.otherPersonId.localeCompare(b.otherPersonId))[0]?.otherPersonId ?? null
    return { action: 'social_interaction', otherPersonId: target }
  }
  if (decision.action === 'inspect_problem' || decision.action === 'report_problem') {
    const ref = subjectRef(decision)
    if (!ref) return null
    const known = knowledge
      .filter((entry) => entry.subjectRef === ref)
      .sort((a, b) => b.confidence - a.confidence || a.subjectType.localeCompare(b.subjectType))[0]
    return { action: decision.action, subjectType: known?.subjectType ?? 'problem', subjectRef: ref }
  }
  return null
}

/**
 * Pure deterministic translation. The returned intent is not permission to mutate the
 * world; execution belongs to the authoritative Core/domain-action layer.
 */
export function actionIntentForDecision(input: {
  personId: string
  currentLocationId: string
  assignments: PersonAssignment[]
  decision: PopulationDecision
  simulationTier?: SimulationTier
  relationships?: PersonRelationship[]
  knowledge?: PersonKnowledge[]
}): PopulationIntentResult {
  const { personId, currentLocationId, assignments, decision } = input
  const relationships = input.relationships ?? []
  const knowledge = input.knowledge ?? []
  const request = affordanceRequestForDecision(decision, relationships, knowledge)
  if (request) {
    const affordance = evaluatePersonActionAffordance({
      personId,
      simulationTier: input.simulationTier ?? 'active',
      currentLocationId,
      assignments,
      relationships,
      knowledge,
    }, request)
    if (!affordance.allowed) return { ok: false, reason: affordance.blockers[0] }
  }

  if (decision.action === 'travel_home' || decision.action === 'travel_work') {
    const purpose = decision.action === 'travel_home' ? 'home' : 'work'
    const assignment = activeAssignment(assignments, purpose)
    if (!assignment) {
      return { ok: false, reason: purpose === 'home' ? 'missing_home_assignment' : 'missing_work_assignment' }
    }
    return {
      ok: true,
      intent: {
        kind: 'travel',
        personId,
        assignmentId: assignment.id,
        destinationLocationId: assignment.locationId,
        destinationTileEntityId: assignment.tileEntityId,
        purpose,
      },
    }
  }

  if (decision.action === 'work') {
    const assignment = activeAssignment(assignments, 'work')
    if (!assignment) return { ok: false, reason: 'missing_work_assignment' }
    if (assignment.locationId !== currentLocationId) return { ok: false, reason: 'work_location_mismatch' }
    return {
      ok: true,
      intent: {
        kind: 'work',
        personId,
        assignmentId: assignment.id,
        locationId: assignment.locationId,
        tileEntityId: assignment.tileEntityId,
        employerActorId: assignment.employerActorId,
        roleCode: assignment.roleCode,
      },
    }
  }

  const relatedPersonId = decision.action === 'social_interaction'
    ? relationships
      .slice()
      .sort((a, b) => (b.familiarity + b.trust + b.affinity) - (a.familiarity + a.trust + a.affinity)
        || a.otherPersonId.localeCompare(b.otherPersonId))[0]?.otherPersonId ?? null
    : null

  return {
    ok: true,
    intent: {
      kind: 'local',
      personId,
      action: decision.action,
      subjectRef: subjectRef(decision),
      relatedPersonId,
    },
  }
}
