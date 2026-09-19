// NOXIA-LIVING — deterministic observer loop for autonomous simulated persons.
//
// This layer gives an autonomous person the same decision/tick path as the rest of
// the population. It does not create a player profile, actor, permission or world
// mutation authority. It only turns observable blockers/problems into diagnostics.

import { runPopulationTick, type PopulationTickInput, type PopulationTickResult } from './tick'

export type AutonomousActorDiagnosticKind = 'blocked_action' | 'observed_problem' | 'reported_problem'

export interface AutonomousActorDiagnostic {
  personId: string
  tick: number
  kind: AutonomousActorDiagnosticKind
  subjectRef: string | null
  blocker: string | null
  action: string
}

export interface AutonomousActorStep {
  tickResult: PopulationTickResult
  diagnostics: AutonomousActorDiagnostic[]
}

/**
 * Runs one ordinary population tick and derives read-only diagnostics from the
 * resulting canonical event. There is intentionally no privileged fallback:
 * blocked actions stay blocked and must be solved by normal game systems.
 */
export function runAutonomousActorStep(input: PopulationTickInput): AutonomousActorStep {
  const tickResult = runPopulationTick(input)
  const diagnostics: AutonomousActorDiagnostic[] = []

  for (const event of tickResult.events) {
    const blocker = typeof event.payload.blocker === 'string' ? event.payload.blocker : null
    if (event.eventType === 'npc_action_blocked') {
      diagnostics.push({
        personId: input.person.id,
        tick: input.tick,
        kind: 'blocked_action',
        subjectRef: event.subjectRef,
        blocker,
        action: tickResult.decision.action,
      })
    } else if (event.eventType === 'npc_observed_problem' || event.eventType === 'npc_reported_problem') {
      diagnostics.push({
        personId: input.person.id,
        tick: input.tick,
        kind: event.eventType === 'npc_observed_problem' ? 'observed_problem' : 'reported_problem',
        subjectRef: event.subjectRef,
        blocker: null,
        action: tickResult.decision.action,
      })
    }
  }

  return { tickResult, diagnostics }
}
