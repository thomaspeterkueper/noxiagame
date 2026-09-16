// Canonical NOXIA person/NPC simulation primitives.
// Pure domain code: no persistence and no world mutation lives here.

export type PersonSimulationLod = 'aggregate' | 'background' | 'active' | 'agent'

export type PersonActivity =
  | 'rest'
  | 'work'
  | 'socialize'
  | 'recover'
  | 'travel'
  | 'standby'

export interface PersonNeeds {
  rest: number
  wellbeing: number
  social: number
  purpose: number
  safety: number
}

export interface PersonSimulationState {
  personId: string
  lod: PersonSimulationLod
  activity: PersonActivity
  locationId: string | null
  assignmentId: string | null
  needs: PersonNeeds
}

export interface PersonDecisionContext {
  canWork: boolean
  canTravel: boolean
  hasSocialOpportunity: boolean
  hasRecoveryOpportunity: boolean
  safetyPressure: number
}

export interface PersonActionCandidate {
  activity: PersonActivity
  score: number
  reasons: readonly string[]
}

export interface PersonDecisionTrace {
  personId: string
  candidates: readonly PersonActionCandidate[]
  selected: PersonActionCandidate
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function candidate(activity: PersonActivity, score: number, reasons: string[]): PersonActionCandidate {
  return { activity, score: clamp01(score), reasons }
}

/**
 * Deterministic first-pass utility scoring for active persons.
 * Needs are satisfaction values: 0 = critical, 1 = fulfilled.
 * This function selects intent only. The selected intent must still pass the
 * canonical Core/domain action validation before it can mutate world state.
 */
export function scorePersonActions(
  state: PersonSimulationState,
  context: PersonDecisionContext,
): readonly PersonActionCandidate[] {
  const { needs } = state
  const safetyPressure = clamp01(context.safetyPressure)
  const actions: PersonActionCandidate[] = [
    candidate('rest', 1 - needs.rest, ['rest-deficit']),
    candidate('standby', 0.15 + safetyPressure * 0.55, ['safe-default', 'safety-pressure']),
  ]

  if (context.canWork && state.assignmentId) {
    actions.push(candidate('work', (1 - needs.purpose) * 0.65 + needs.rest * 0.2, ['assignment', 'purpose']))
  }
  if (context.hasSocialOpportunity) {
    actions.push(candidate('socialize', (1 - needs.social) * 0.8, ['social-deficit', 'opportunity']))
  }
  if (context.hasRecoveryOpportunity) {
    actions.push(candidate('recover', (1 - needs.wellbeing) * 0.9, ['wellbeing-deficit', 'recovery-opportunity']))
  }
  if (context.canTravel) {
    actions.push(candidate('travel', 0.1 + (1 - needs.purpose) * 0.15, ['mobility-available']))
  }

  return actions
}

export function decidePersonActivity(
  state: PersonSimulationState,
  context: PersonDecisionContext,
): PersonDecisionTrace {
  const candidates = scorePersonActions(state, context)
  const selected = candidates.reduce((best, current) => current.score > best.score ? current : best)
  return { personId: state.personId, candidates, selected }
}
