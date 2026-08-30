// lib/game/population/decision.ts
// Version: 0.1.0
// Deterministische, erklärbare Handlungswahl für NOXIA-LIVING-0001.

import {
  clampUnit,
  type Person,
  type PersonAssignment,
  type PersonKnowledge,
  type PersonNeed,
  type PersonRelationship,
  type PersonSkill,
  type PopulationAction,
  type PopulationDecision,
} from './types'

export interface KnownLocalProblem {
  subjectType: string
  subjectRef: string
  severity: number
  requiredSkill?: string | null
  reportable?: boolean
}

export interface PopulationDecisionContext {
  person: Person
  needs: PersonNeed[]
  assignments: PersonAssignment[]
  skills: PersonSkill[]
  relationships: PersonRelationship[]
  knowledge: PersonKnowledge[]
  localProblems?: KnownLocalProblem[]
  /** 0..1. 1 bedeutet: Arbeit ist in diesem Tick stark fällig. */
  workObligation?: number
  /** Optionale deterministische Reisekosten 0..1 je Zieltyp. */
  travelCostHome?: number
  travelCostWork?: number
}

interface ScoredAction {
  action: PopulationAction
  score: number
  factors: Record<string, number | string | boolean>
}

const ACTION_TIE_BREAK: readonly PopulationAction[] = [
  'satisfy_basic_need',
  'rest',
  'report_problem',
  'inspect_problem',
  'work',
  'travel_work',
  'travel_home',
  'social_interaction',
]

const NEED_WEIGHT: Record<string, number> = {
  sustenance: 1.25,
  rest: 1.15,
  safety: 1.35,
  social: 0.7,
  purpose: 0.6,
}

function roundScore(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function needSatisfaction(needs: PersonNeed[], code: string): number {
  return clampUnit(needs.find((need) => need.needCode === code)?.satisfaction ?? 1)
}

function needPressure(needs: PersonNeed[], code: string): number {
  return 1 - needSatisfaction(needs, code)
}

function activeAssignment(assignments: PersonAssignment[], type: 'home' | 'work'): PersonAssignment | null {
  return assignments.find((assignment) => assignment.assignmentType === type && assignment.isActive) ?? null
}

function bestSkillLevel(skills: PersonSkill[], skillCode?: string | null): number {
  if (!skillCode) return 0.35
  return clampUnit(skills.find((skill) => skill.skillCode === skillCode)?.level ?? 0)
}

function knowsSubject(knowledge: PersonKnowledge[], problem: KnownLocalProblem): boolean {
  return knowledge.some((entry) =>
    entry.subjectType === problem.subjectType &&
    entry.subjectRef === problem.subjectRef &&
    entry.confidence >= 0.35,
  )
}

function bestKnownProblem(context: PopulationDecisionContext): KnownLocalProblem | null {
  const candidates = (context.localProblems ?? [])
    .filter((problem) => knowsSubject(context.knowledge, problem))
    .map((problem) => ({
      problem,
      relevance: clampUnit(problem.severity) * (0.5 + 0.5 * bestSkillLevel(context.skills, problem.requiredSkill)),
    }))
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      const aKey = `${a.problem.subjectType}:${a.problem.subjectRef}`
      const bKey = `${b.problem.subjectType}:${b.problem.subjectRef}`
      return aKey.localeCompare(bKey)
    })

  return candidates[0]?.problem ?? null
}

function socialOpportunity(context: PopulationDecisionContext): number {
  if (context.relationships.length === 0) return 0
  return context.relationships.reduce((best, relation) => {
    const value = (clampUnit(relation.familiarity) + clampUnit(relation.trust) + clampUnit(relation.affinity)) / 3
    return Math.max(best, value)
  }, 0)
}

function scoreActions(context: PopulationDecisionContext): ScoredAction[] {
  const home = activeAssignment(context.assignments, 'home')
  const work = activeAssignment(context.assignments, 'work')
  const atHome = Boolean(home && home.locationId === context.person.currentLocationId)
  const atWork = Boolean(work && work.locationId === context.person.currentLocationId)

  const sustenancePressure = needPressure(context.needs, 'sustenance')
  const restPressure = needPressure(context.needs, 'rest')
  const safetyPressure = needPressure(context.needs, 'safety')
  const socialPressure = needPressure(context.needs, 'social')
  const purposePressure = needPressure(context.needs, 'purpose')
  const workObligation = clampUnit(context.workObligation ?? 0.5)
  const problem = bestKnownProblem(context)
  const problemSeverity = problem ? clampUnit(problem.severity) : 0
  const problemSkill = problem ? bestSkillLevel(context.skills, problem.requiredSkill) : 0
  const relationshipOpportunity = socialOpportunity(context)

  const basicNeedPressure = Math.max(
    sustenancePressure * NEED_WEIGHT.sustenance,
    safetyPressure * NEED_WEIGHT.safety,
  )

  const result: ScoredAction[] = [
    {
      action: 'satisfy_basic_need',
      score: 0.12 + basicNeedPressure,
      factors: { sustenancePressure, safetyPressure, basicNeedPressure },
    },
    {
      action: 'rest',
      score: 0.08 + restPressure * NEED_WEIGHT.rest + (atHome ? 0.12 : 0),
      factors: { restPressure, atHome },
    },
    {
      action: 'work',
      score: work
        ? 0.1 + workObligation * 0.72 + purposePressure * 0.28 + (atWork ? 0.15 : -0.18)
        : -1,
      factors: { hasWork: Boolean(work), workObligation, purposePressure, atWork },
    },
    {
      action: 'travel_work',
      score: work && !atWork
        ? 0.08 + workObligation * 0.78 + purposePressure * 0.2 - clampUnit(context.travelCostWork ?? 0.1)
        : -1,
      factors: {
        hasWork: Boolean(work),
        atWork,
        workObligation,
        purposePressure,
        travelCost: clampUnit(context.travelCostWork ?? 0.1),
      },
    },
    {
      action: 'travel_home',
      score: home && !atHome
        ? 0.05 + Math.max(restPressure, safetyPressure) * 0.68 - clampUnit(context.travelCostHome ?? 0.1)
        : -1,
      factors: {
        hasHome: Boolean(home),
        atHome,
        restPressure,
        safetyPressure,
        travelCost: clampUnit(context.travelCostHome ?? 0.1),
      },
    },
    {
      action: 'social_interaction',
      score: context.relationships.length > 0
        ? 0.05 + socialPressure * 0.7 + relationshipOpportunity * 0.24
        : -1,
      factors: { socialPressure, relationshipOpportunity, hasRelationship: context.relationships.length > 0 },
    },
    {
      action: 'inspect_problem',
      score: problem
        ? 0.07 + problemSeverity * 0.52 + problemSkill * 0.28 + purposePressure * 0.16
        : -1,
      factors: {
        hasKnownProblem: Boolean(problem),
        problemSeverity,
        problemSkill,
        subjectRef: problem?.subjectRef ?? '',
      },
    },
    {
      action: 'report_problem',
      score: problem?.reportable
        ? 0.09 + problemSeverity * 0.62 + purposePressure * 0.12
        : -1,
      factors: {
        hasReportableProblem: Boolean(problem?.reportable),
        problemSeverity,
        subjectRef: problem?.subjectRef ?? '',
      },
    },
  ]

  return result.map((entry) => ({ ...entry, score: roundScore(entry.score) }))
}

export function decidePopulationAction(context: PopulationDecisionContext): PopulationDecision {
  const scores = scoreActions(context)
  const order = new Map(ACTION_TIE_BREAK.map((action, index) => [action, index]))

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (order.get(a.action) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.action) ?? Number.MAX_SAFE_INTEGER)
  })

  const winner = scores[0]
  return {
    personId: context.person.id,
    action: winner.action,
    score: winner.score,
    factors: {
      ...winner.factors,
      deterministicTieBreak: ACTION_TIE_BREAK.indexOf(winner.action),
    },
  }
}
