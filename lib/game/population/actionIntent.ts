// NOXIA-LIVING — bridge from deterministic population decisions to validated world actions.
//
// This module deliberately does not mutate world state. It translates a decision into
// an auditable intent that an authoritative domain-action adapter may validate/execute.

import type { PersonAssignment, PopulationDecision } from './types'

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
    }

export type PopulationIntentResult =
  | { ok: true; intent: PopulationActionIntent }
  | { ok: false; reason: 'missing_home_assignment' | 'missing_work_assignment' | 'work_location_mismatch' }

function activeAssignment(assignments: PersonAssignment[], type: 'home' | 'work') {
  return assignments.find((assignment) => assignment.assignmentType === type && assignment.isActive) ?? null
}

function subjectRef(decision: PopulationDecision): string | null {
  return typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef
    ? decision.factors.subjectRef
    : null
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
}): PopulationIntentResult {
  const { personId, currentLocationId, assignments, decision } = input

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

  return {
    ok: true,
    intent: {
      kind: 'local',
      personId,
      action: decision.action,
      subjectRef: subjectRef(decision),
    },
  }
}
