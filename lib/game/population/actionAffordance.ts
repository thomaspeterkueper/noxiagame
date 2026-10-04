// NOXIA-LIVING — pure action-affordance layer.
//
// This module does NOT execute actions and does NOT read canonical world truth.
// It answers only whether the currently known/persisted person state is structurally
// sufficient to attempt an action. Domain adapters remain authoritative.

import type { PersonAssignment, PersonKnowledge, PersonRelationship, SimulationTier } from './types'

export type PersonActionAffordanceCode =
  | 'work'
  | 'travel_home'
  | 'travel_work'
  | 'social_interaction'
  | 'local_visit'
  | 'inspect_problem'
  | 'report_problem'
  | 'seek_medical_care'
  | 'gather_information'
  | 'acquire_tool'
  | 'gain_capability'
  | 'secure_resource'

export type PersonActionAffordanceBlocker =
  | 'person_not_active'
  | 'missing_home_assignment'
  | 'missing_work_assignment'
  | 'work_location_mismatch'
  | 'missing_social_target'
  | 'unknown_subject'
  | 'missing_destination'
  | 'destination_location_mismatch'
  | 'invalid_resource_amount'

export interface PersonActionAffordanceContext {
  personId: string
  simulationTier: SimulationTier
  currentLocationId: string
  assignments: PersonAssignment[]
  relationships: PersonRelationship[]
  knowledge: PersonKnowledge[]
}

export type PersonActionAffordanceRequest =
  | { action: 'work' }
  | { action: 'travel_home' }
  | { action: 'travel_work' }
  | { action: 'social_interaction'; otherPersonId?: string | null }
  | { action: 'local_visit'; destinationLocationId?: string | null }
  | { action: 'inspect_problem'; subjectType: string; subjectRef: string }
  | { action: 'report_problem'; subjectType: string; subjectRef: string }
  | { action: 'seek_medical_care'; destinationLocationId?: string | null }
  | { action: 'gather_information'; subjectType: string; subjectRef: string }
  | { action: 'acquire_tool'; toolType: string }
  | { action: 'gain_capability'; capability: string }
  | { action: 'secure_resource'; resource: 'credits' | 'energy' | 'time'; amount: number }

export interface PersonActionAffordance {
  action: PersonActionAffordanceCode
  allowed: boolean
  blockers: PersonActionAffordanceBlocker[]
  factors: Record<string, string | number | boolean>
}

function activeAssignment(assignments: PersonAssignment[], type: 'home' | 'work') {
  return assignments.find((assignment) => assignment.assignmentType === type && assignment.isActive) ?? null
}

function knows(
  knowledge: PersonKnowledge[],
  subjectType: string,
  subjectRef: string,
  minConfidence = 0.35,
) {
  return knowledge.some((entry) =>
    entry.subjectType === subjectType &&
    entry.subjectRef === subjectRef &&
    entry.confidence >= minConfidence,
  )
}

function result(
  action: PersonActionAffordanceCode,
  blockers: PersonActionAffordanceBlocker[],
  factors: Record<string, string | number | boolean> = {},
): PersonActionAffordance {
  return { action, allowed: blockers.length === 0, blockers, factors }
}

/**
 * Structural affordance only.
 *
 * Examples:
 * - "work" requires an active work assignment and co-location with that assignment.
 * - "inspect_problem" requires that the person actually knows the subject.
 * - "local_visit" requires an active simulated person and a same-location target.
 *
 * The returned "allowed" means "may attempt", never "world mutation is authorized".
 */
export function evaluatePersonActionAffordance(
  context: PersonActionAffordanceContext,
  request: PersonActionAffordanceRequest,
): PersonActionAffordance {
  const home = activeAssignment(context.assignments, 'home')
  const work = activeAssignment(context.assignments, 'work')
  const active = context.simulationTier === 'active'

  switch (request.action) {
    case 'work': {
      const blockers: PersonActionAffordanceBlocker[] = []
      if (!work) blockers.push('missing_work_assignment')
      else if (work.locationId !== context.currentLocationId) blockers.push('work_location_mismatch')
      return result('work', blockers, {
        hasWork: Boolean(work),
        atWorkLocation: Boolean(work && work.locationId === context.currentLocationId),
      })
    }

    case 'travel_home':
      return result('travel_home', home ? [] : ['missing_home_assignment'], { hasHome: Boolean(home) })

    case 'travel_work':
      return result('travel_work', work ? [] : ['missing_work_assignment'], { hasWork: Boolean(work) })

    case 'social_interaction': {
      const target = request.otherPersonId
      const hasTarget = target
        ? context.relationships.some((relationship) => relationship.otherPersonId === target)
        : context.relationships.length > 0
      return result('social_interaction', hasTarget ? [] : ['missing_social_target'], {
        relationshipCount: context.relationships.length,
        explicitTarget: Boolean(target),
      })
    }

    case 'local_visit':
    case 'seek_medical_care': {
      const blockers: PersonActionAffordanceBlocker[] = []
      if (!active) blockers.push('person_not_active')
      if (!request.destinationLocationId) blockers.push('missing_destination')
      else if (request.destinationLocationId !== context.currentLocationId) blockers.push('destination_location_mismatch')
      return result(request.action, blockers, {
        active,
        sameLocation: request.destinationLocationId === context.currentLocationId,
      })
    }

    case 'inspect_problem':
    case 'report_problem': {
      const known = knows(context.knowledge, request.subjectType, request.subjectRef)
      return result(request.action, known ? [] : ['unknown_subject'], {
        knownSubject: known,
      })
    }

    case 'gather_information':
      // Missing knowledge is precisely why gathering information may be attempted.
      return result('gather_information', [], {
        alreadyKnown: knows(context.knowledge, request.subjectType, request.subjectRef),
      })

    case 'acquire_tool':
      return result('acquire_tool', [], { toolType: request.toolType })

    case 'gain_capability':
      return result('gain_capability', [], { capability: request.capability })

    case 'secure_resource':
      return result(
        'secure_resource',
        Number.isFinite(request.amount) && request.amount > 0 ? [] : ['invalid_resource_amount'],
        { resource: request.resource, amount: request.amount },
      )
  }
}
