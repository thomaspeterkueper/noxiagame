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
import { affectActionModifiers, type AffectState } from '../cognition/personAffect'
import { habitActionModifier, type HabitState } from '../cognition/personHabit'

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
  /** NOXIA-LIVING-0007. 0..1 Schlafdruck aus dem Tagesrhythmus; 1 = im Schlaffenster. */
  sleepDrive?: number
  /** NOXIA-LIVING-0006. Bereits auf den aktuellen Tick abgeklungener Affektzustand. */
  affect?: AffectState
  habits?: HabitState[]
  habitContextKey?: string
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

/** Bedürfnisdruck, ab dem eine schlafende Person aufwacht. */
const WAKE_SUSTENANCE_PRESSURE = 0.75
const WAKE_SAFETY_PRESSURE = 0.5

const SLEEP_DRIVE_WEIGHT: Partial<Record<PopulationAction, number>> = {
  rest: 0.9,
  satisfy_basic_need: -0.9,
  report_problem: -0.9,
  travel_home: 0.5,
  work: -0.9,
  travel_work: -0.9,
  inspect_problem: -0.9,
  social_interaction: -0.9,
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

/** 0..1: is there anyone among the known people who would be a change to see? */
function noveltyOpportunity(context: PopulationDecisionContext): number {
  return context.relationships.reduce((best, relation) =>
    Math.max(best, relation.affinity >= 0.5 ? Math.max(0, (1 - clampUnit(relation.familiarity)) - 0.2) / 0.8 : 0), 0)
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
  // NOXIA-LIVING-0009: boredom pulls towards other people and slightly away from routine work.
  const varietyPressure = needPressure(context.needs, 'variety')
  const workObligation = clampUnit(context.workObligation ?? 0.5)
  const problem = bestKnownProblem(context)
  const problemSeverity = problem ? clampUnit(problem.severity) : 0
  const problemSkill = problem ? bestSkillLevel(context.skills, problem.requiredSkill) : 0
  const relationshipOpportunity = socialOpportunity(context)
  // Going out only answers boredom if there is someone to see who is not routine.
  const novelty = noveltyOpportunity(context)

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
        ? 0.1 + workObligation * 0.72 + purposePressure * 0.28 + (atWork ? 0.15 : -0.18) - varietyPressure * 0.1
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
        ? 0.05 + socialPressure * 0.7 + varietyPressure * 0.35 * novelty + relationshipOpportunity * 0.24
        : -1,
      factors: { socialPressure, varietyPressure, noveltyOpportunity: novelty, relationshipOpportunity, hasRelationship: context.relationships.length > 0 },
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

  // NOXIA-LIVING-0006: Affekt verschiebt verfügbare Handlungen, schaltet aber keine frei.
  const modifiers = context.affect ? affectActionModifiers(context.affect) : null
  // NOXIA-LIVING-0007: Schlafdruck zieht zur Ruhe und weg von Aktivität.
  // Nur ein Notfall weckt: starker Hunger oder Gefahr. Dann entfällt der Schlafbonus,
  // und das Grundbedürfnis setzt sich mit seinem normalen Score durch.
  const sleepDrive = clampUnit(context.sleepDrive ?? 0)
  const wakeEmergency = sustenancePressure >= WAKE_SUSTENANCE_PRESSURE || safetyPressure >= WAKE_SAFETY_PRESSURE

  return result.map((entry) => {
    const available = entry.score > -1
    const affectModifier = modifiers && available ? modifiers[entry.action] ?? 0 : 0
    const sleepWeight = wakeEmergency
      ? (entry.action === 'rest' || entry.action === 'satisfy_basic_need' ? 0 : SLEEP_DRIVE_WEIGHT[entry.action] ?? 0)
      : SLEEP_DRIVE_WEIGHT[entry.action] ?? 0
    const sleepModifier = sleepDrive > 0 && available ? sleepDrive * sleepWeight : 0
    return {
      ...entry,
      score: roundScore(entry.score + affectModifier + sleepModifier),
      factors: {
        ...entry.factors,
        ...(modifiers ? { affectModifier } : {}),
        ...(sleepDrive > 0 ? { sleepDrive, wakeEmergency, asleep: entry.action === 'rest' && sleepDrive >= 1 && !wakeEmergency } : {}),
      },
    }
  })
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
    options: scores.map((entry) => ({ action: entry.action, score: entry.score })),
  }
}
