// Domain-level handoff plan for a server-owned absence actor.
// This module is pure: persistence, conversation events, route planning and walking
// remain responsibilities of the existing game services / world tick.
import {
  absenceGoodbye,
  chooseAbsenceDestination,
  isAbsenceActionAllowed,
  ownsAbsenceLease,
  type AbsenceDestination,
  type AbsenceState,
  type GoodbyeContext,
} from './absenceAutopilot'

export interface ActiveConversation {
  id: string
  context: GoodbyeContext
  /** If already closed, a second goodbye must never be generated. */
  isOpen: boolean
}

export interface AbsenceHandoffPlan {
  actorId: string
  leaseRevision: number
  /** Used by the persistence layer as a unique event/idempotency key. */
  eventKey: string
  destination: { id: string; kind: AbsenceDestination['kind'] } | null
  goodbye: { conversationId: string; text: string } | null
  /** A missing destination is a safe failure, not permission to teleport. */
  outcome: 'navigate' | 'await-safe-destination'
}

export interface AbsenceNavigationCommand {
  actorId: string
  destinationId: string
  expectedRevision: number
  eventKey: string
}

/**
 * Construct once when advanceAbsence emits 'handoff'. Persist atomically
 * against actor revision, then deliver idempotent dialogue/route commands.
 * No LLM may add commitments to this system-generated farewell.
 */
export function planAbsenceHandoff(args: {
  actorId: string
  state: AbsenceState
  destinations: readonly AbsenceDestination[]
  conversation?: ActiveConversation | null
}): AbsenceHandoffPlan | null {
  const { actorId, state, destinations, conversation } = args
  if (!actorId || !ownsAbsenceLease(state, state.revision) || state.handoffAt === null) return null
  const destination = chooseAbsenceDestination(destinations)
  const goodbye = conversation?.isOpen && conversation.id
    ? { conversationId: conversation.id, text: absenceGoodbye(conversation.context) }
    : null
  const eventKey = `absence:${actorId}:${state.revision}`
  return {
    actorId,
    leaseRevision: state.revision,
    eventKey,
    destination: destination ? { id: destination.id, kind: destination.kind } : null,
    goodbye,
    outcome: destination ? 'navigate' : 'await-safe-destination',
  }
}

/** Build a route request, NOT a movement or position mutation. */
export function navigationFromAbsencePlan(plan: AbsenceHandoffPlan, currentState: AbsenceState): AbsenceNavigationCommand | null {
  if (plan.outcome !== 'navigate' || !plan.destination) return null
  if (!ownsAbsenceLease(currentState, plan.leaseRevision)) return null
  return {
    actorId: plan.actorId,
    destinationId: plan.destination.id,
    expectedRevision: plan.leaseRevision,
    eventKey: `${plan.eventKey}:navigate`,
  }
}

export interface AbsenceTask {
  kind: string
  actorId: string
  expectedRevision: number
}

/** World workers must check the actor's persisted revision before each action. */
export function mayExecuteAbsenceTask(task: AbsenceTask, state: AbsenceState): boolean {
  return Boolean(task.actorId) && ownsAbsenceLease(state, task.expectedRevision) && isAbsenceActionAllowed(task.kind)
}

/**
 * The host game is responsible for enforcing idempotency in its datastore:
 * - (actor_id, lease_revision) unique handoff row
 * - (actor_id, event_key) unique event row
 * - compare-and-swap state revision on navigation and conversation closure
 * - pathfinding through actual doors/transit; never instantly change location
 * - no money/consent/relationship actions in this execution context
 */
