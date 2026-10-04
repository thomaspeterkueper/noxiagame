// NOXIA-LIVING — bridge named-person brain decisions into the shared action language.
//
// Pure projection only: no persistence and no world mutation.
// Named characters keep their richer actionCode vocabulary while execution-facing
// code receives a small shared set of intent kinds.

import { evaluatePersonActionAffordance, type PersonActionAffordance } from './actionAffordance'
import type { PersonAssignment, PersonKnowledge, PersonRelationship, SimulationTier } from './types'
import type { PersonDecision } from '../personBrain'

export type NamedPersonProjectedIntent =
  | { kind: 'rest'; personId: string; sourceActionCode: string }
  | { kind: 'satisfy_basic_need'; personId: string; sourceActionCode: string }
  | { kind: 'work'; personId: string; assignmentId: string; locationId: string; tileEntityId: string | null; employerActorId: string | null; roleCode: string | null; sourceActionCode: string }
  | { kind: 'social_interaction'; personId: string; otherPersonId: string; sourceActionCode: string }
  | { kind: 'inspect'; personId: string; subjectType: string; subjectRef: string; sourceActionCode: string }
  | { kind: 'coordinate'; personId: string; subjectType: string | null; subjectRef: string | null; sourceActionCode: string }
  | { kind: 'external_supply'; personId: string; subjectType: string | null; subjectRef: string | null; sourceActionCode: string }

export type NamedPersonIntentProjection =
  | { ok: true; intent: NamedPersonProjectedIntent; affordance?: PersonActionAffordance }
  | { ok: false; reason: string; affordance?: PersonActionAffordance }

export interface NamedPersonIntentContext {
  personId: string
  simulationTier: SimulationTier
  currentLocationId: string
  assignments: PersonAssignment[]
  relationships: PersonRelationship[]
  knowledge: PersonKnowledge[]
  decision: PersonDecision
}

function activeWork(assignments: PersonAssignment[]) {
  return assignments.find((assignment) => assignment.assignmentType === 'work' && assignment.isActive) ?? null
}

function bestRelationship(relationships: PersonRelationship[]) {
  return relationships.slice().sort((a, b) =>
    (b.familiarity + b.trust + b.affinity) - (a.familiarity + a.trust + a.affinity)
    || a.otherPersonId.localeCompare(b.otherPersonId),
  )[0] ?? null
}

function knownSubject(context: NamedPersonIntentContext) {
  const ref = context.decision.subjectRef
  if (!ref) return null
  return context.knowledge
    .filter((entry) => entry.subjectRef === ref)
    .sort((a, b) => b.confidence - a.confidence || a.subjectType.localeCompare(b.subjectType))[0] ?? null
}

function affordanceContext(context: NamedPersonIntentContext) {
  return {
    personId: context.personId,
    simulationTier: context.simulationTier,
    currentLocationId: context.currentLocationId,
    assignments: context.assignments,
    relationships: context.relationships,
    knowledge: context.knowledge,
  }
}

export function projectNamedPersonDecisionToIntent(
  context: NamedPersonIntentContext,
): NamedPersonIntentProjection {
  const { decision, personId } = context

  if (decision.actionCode === 'recover_rest') {
    return { ok: true, intent: { kind: 'rest', personId, sourceActionCode: decision.actionCode } }
  }

  if (decision.actionCode === 'restore_sustenance') {
    return { ok: true, intent: { kind: 'satisfy_basic_need', personId, sourceActionCode: decision.actionCode } }
  }

  if (decision.actionCode === 'perform_assigned_work'
    || decision.actionCode === 'prioritize_repair_fabrication'
    || decision.actionCode === 'prioritize_resource_analysis'
    || decision.actionCode === 'prepare_field_support') {
    const affordance = evaluatePersonActionAffordance(affordanceContext(context), { action: 'work' })
    if (!affordance.allowed) return { ok: false, reason: affordance.blockers[0], affordance }
    const work = activeWork(context.assignments)
    if (!work) return { ok: false, reason: 'missing_work_assignment', affordance }
    return {
      ok: true,
      affordance,
      intent: {
        kind: 'work',
        personId,
        assignmentId: work.id,
        locationId: work.locationId,
        tileEntityId: work.tileEntityId,
        employerActorId: work.employerActorId,
        roleCode: work.roleCode,
        sourceActionCode: decision.actionCode,
      },
    }
  }

  if (decision.actionCode === 'seek_social_contact') {
    const target = bestRelationship(context.relationships)
    const affordance = evaluatePersonActionAffordance(
      affordanceContext(context),
      { action: 'social_interaction', otherPersonId: target?.otherPersonId ?? null },
    )
    if (!affordance.allowed || !target) return { ok: false, reason: affordance.blockers[0] ?? 'missing_social_target', affordance }
    return {
      ok: true,
      affordance,
      intent: { kind: 'social_interaction', personId, otherPersonId: target.otherPersonId, sourceActionCode: decision.actionCode },
    }
  }

  if (decision.actionCode === 'assess_water_health_risk'
    || decision.actionCode === 'assess_medical_capacity'
    || decision.actionCode === 'inspect_life_support_pressure') {
    if (!decision.subjectRef) return { ok: false, reason: 'missing_subject' }
    const known = knownSubject(context)
    // Named-person pressure decisions currently originate from authoritative pressure
    // projection. If personal knowledge exists, enforce it. Otherwise preserve current
    // named-person behaviour until pressure->knowledge projection is unified.
    if (known) {
      const affordance = evaluatePersonActionAffordance(
        affordanceContext(context),
        { action: 'inspect_problem', subjectType: known.subjectType, subjectRef: decision.subjectRef },
      )
      if (!affordance.allowed) return { ok: false, reason: affordance.blockers[0], affordance }
      return {
        ok: true,
        affordance,
        intent: {
          kind: 'inspect',
          personId,
          subjectType: known.subjectType,
          subjectRef: decision.subjectRef,
          sourceActionCode: decision.actionCode,
        },
      }
    }
    return {
      ok: true,
      intent: {
        kind: 'inspect',
        personId,
        subjectType: decision.subjectType ?? 'pressure',
        subjectRef: decision.subjectRef,
        sourceActionCode: decision.actionCode,
      },
    }
  }

  if (decision.actionCode === 'coordinate_colony_response') {
    return {
      ok: true,
      intent: {
        kind: 'coordinate',
        personId,
        subjectType: decision.subjectType ?? null,
        subjectRef: decision.subjectRef ?? null,
        sourceActionCode: decision.actionCode,
      },
    }
  }

  if (decision.actionCode === 'evaluate_external_supply_contract') {
    return {
      ok: true,
      intent: {
        kind: 'external_supply',
        personId,
        subjectType: decision.subjectType ?? null,
        subjectRef: decision.subjectRef ?? null,
        sourceActionCode: decision.actionCode,
      },
    }
  }

  return { ok: false, reason: 'unsupported_named_action' }
}
