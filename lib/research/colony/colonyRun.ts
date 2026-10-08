// lib/research/colony/colonyRun.ts
// NOXIA-TIME-0001 — in-memory research run of the living population.
//
// Runs the same pure decision, day-rhythm, encounter, memory, relationship and
// affect code as the live tick, without a database. One step is one game hour.
// Years of colony life take seconds, the live world is never touched, and the
// same snapshot and scenario always produce the same result.
//
// Not simulated here (still bound to the database in the live engine): economy,
// construction, families and births, travel between settlements, knowledge and
// colony pressures. Named persons use the general utility decision instead of
// their role logic in personBrain.

import {
  affectProfileFromTraits,
  applyAffect,
  applyPain,
  appraisalFromPopulationEvent,
  appraiseEvent,
  decayAffect,
  neutralAffect,
  painFromHealthEvent,
  type AffectState,
  type PainSource,
} from '../../game/cognition/personAffect'
import { memoryFromPopulationEvent, projectRelationship } from '../../game/personSocialMemory'
import { activityForAction, needDelta } from '../../game/population/actionEffects'
import { circadianProfile, circadianState, DAY_TICKS, type CircadianProfile } from '../../game/population/circadian'
import { decidePopulationAction } from '../../game/population/decision'
import { derivePopulationEncounters, isFreshEncounter } from '../../game/population/encounters'
import { resolvedPresenceCandidates } from '../../game/population/presence'
import {
  NEED_CODES,
  type NeedCode,
  type Person,
  type PersonAssignment,
  type PersonNeed,
  type PersonRelationship,
  type PopulationEvent,
} from '../../game/population/types'

export interface SnapshotPerson {
  id: string
  named?: boolean
  locationId: string
  traits?: Record<string, unknown> | null
  needs?: Partial<Record<NeedCode, number>> | null
  assignments?: { type: 'home' | 'work' | 'temporary'; locationId: string; tileEntityId: string | null }[] | null
}

export interface SnapshotRelationship {
  personId: string
  otherPersonId: string
  familiarity: number
  trust: number
  affinity: number
  lastInteractionTick: number | null
}

/** Same shape as experiments/colony/export-snapshot.sql returns. */
export interface ColonySnapshot {
  people: SnapshotPerson[]
  relationships?: SnapshotRelationship[] | null
  tick?: number | null
}

/** An intervention at a given game hour: the way to pose a "what if". */
export type ScenarioEvent =
  | { tick: number; type: PainSource; personId: string; severity: number }
  | {
      tick: number
      type: 'person_conflict' | 'person_assistance' | 'crisis_experience' | 'loss_experience' | 'shared_work'
      personId: string
      otherPersonId?: string
      /** Also record the mirrored event for the other person. Default true when otherPersonId is set. */
      mutual?: boolean
      severity?: number
    }

type HealthScenarioEvent = Extract<ScenarioEvent, { type: PainSource }>
const HEALTH_TYPES: readonly string[] = ['workplace_accident', 'environmental_exposure', 'exhaustion']
function isHealthEvent(event: ScenarioEvent): event is HealthScenarioEvent {
  return HEALTH_TYPES.includes(event.type)
}

export interface ColonyRunOptions {
  /** Game hours to simulate. */
  ticks: number
  /** First tick number. Defaults to the snapshot tick + 1, else 0. Scenario ticks are relative to this. */
  startTick?: number
  scenario?: ScenarioEvent[]
}

export interface ColonyDayRow {
  day: number
  /** Mean hours per person on this day. */
  sleepHours: number
  workHours: number
  restAvg: number
  sustenanceAvg: number
  encounters: number
  joyAvg: number
  fearAvg: number
  angerAvg: number
  sadnessAvg: number
  painAvg: number
  moodAvg: number
  relationships: number
  familiarityAvg: number
  trustAvg: number
  affinityAvg: number
  /** Directed relationships above the friendship thresholds of population/socialLife. */
  closeTies: number
}

export interface ColonyRunResult {
  people: number
  ticks: number
  days: ColonyDayRow[]
  final: {
    affect: AffectState[]
    relationships: PersonRelationship[]
    needs: Record<string, Record<NeedCode, number>>
  }
}

// Friendship thresholds from population/socialLife.ts (recency is not modelled here).
const CLOSE_FAMILIARITY = 0.45
const CLOSE_TRUST = 0.56
const CLOSE_AFFINITY = 0.58

const round = (value: number): number => Math.round(value * 10_000) / 10_000
const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)

interface SimPerson {
  person: Person
  traits: Record<string, unknown> | null
  profile: CircadianProfile
  needs: Record<NeedCode, number>
  assignments: PersonAssignment[]
  affect: AffectState
  relationships: Map<string, PersonRelationship>
  relationshipList: PersonRelationship[] | null
}

function initialPeople(snapshot: ColonySnapshot): SimPerson[] {
  const people = [...snapshot.people].sort((a, b) => a.id.localeCompare(b.id)).map((entry): SimPerson => {
    const needs = {} as Record<NeedCode, number>
    for (const code of NEED_CODES) needs[code] = Math.max(0, Math.min(1, Number(entry.needs?.[code] ?? 1)))
    return {
      person: {
        id: entry.id, displayName: entry.id, birthYear: null, currentLocationId: entry.locationId,
        simulationTier: 'active', activityState: 'idle', lastAction: null, lastDecisionFactors: {}, lastTick: null,
      },
      traits: entry.traits ?? null,
      profile: circadianProfile(entry.id, entry.traits ?? null),
      needs,
      assignments: (entry.assignments ?? []).map((assignment, index) => ({
        id: `${entry.id}:${assignment.type}:${index}`, personId: entry.id, assignmentType: assignment.type,
        locationId: assignment.locationId, tileEntityId: assignment.tileEntityId, employerActorId: null,
        roleCode: null, startsTick: null, endsTick: null, isActive: true,
      })),
      affect: neutralAffect(entry.id),
      relationships: new Map(),
      relationshipList: null,
    }
  })
  const byId = new Map(people.map((entry) => [entry.person.id, entry]))
  for (const relation of snapshot.relationships ?? []) {
    const owner = byId.get(relation.personId)
    if (!owner || !byId.has(relation.otherPersonId)) continue
    owner.relationships.set(relation.otherPersonId, {
      id: `relationship:${relation.personId}:${relation.otherPersonId}`, personId: relation.personId,
      otherPersonId: relation.otherPersonId, relationshipType: 'acquaintance', familiarity: Number(relation.familiarity),
      trust: Number(relation.trust), affinity: Number(relation.affinity),
      lastInteractionTick: relation.lastInteractionTick == null ? null : Number(relation.lastInteractionTick),
    })
  }
  return people
}

export function runColony(snapshot: ColonySnapshot, options: ColonyRunOptions): ColonyRunResult {
  const people = initialPeople(snapshot)
  const byId = new Map(people.map((entry) => [entry.person.id, entry]))
  const allAssignments = people.flatMap((entry) => entry.assignments)
  const startTick = options.startTick ?? (snapshot.tick != null ? Number(snapshot.tick) + 1 : 0)
  const scenario = new Map<number, ScenarioEvent[]>()
  for (const event of options.scenario ?? []) {
    const list = scenario.get(event.tick) ?? []
    list.push(event)
    scenario.set(event.tick, list)
  }

  const needsOf = (entry: SimPerson): PersonNeed[] =>
    NEED_CODES.map((needCode) => ({ personId: entry.person.id, needCode, satisfaction: entry.needs[needCode], updatedTick: null }))
  const relationshipsOf = (entry: SimPerson): PersonRelationship[] =>
    (entry.relationshipList ??= [...entry.relationships.values()])

  /** One directed social event: memory → relationship → affect, as the engine does. */
  const applySocialEvent = (event: PopulationEvent): void => {
    const actor = event.actorPersonId ? byId.get(event.actorPersonId) : undefined
    if (!actor) return
    const current = event.relatedPersonId ? actor.relationships.get(event.relatedPersonId) ?? null : null
    const profile = affectProfileFromTraits(actor.traits)
    const appraisal = appraisalFromPopulationEvent(event, { needs: needsOf(actor), relationship: current })
    if (appraisal) actor.affect = applyAffect(actor.affect, appraiseEvent(appraisal, profile), event.tick, profile)
    const memory = memoryFromPopulationEvent(event)
    const next = memory ? projectRelationship(current, memory) : null
    if (next && event.relatedPersonId) {
      actor.relationships.set(event.relatedPersonId, next)
      actor.relationshipList = null
    }
  }

  const days: ColonyDayRow[] = []
  let sleepTicks = 0, workTicks = 0, encounters = 0

  for (let step = 0; step < options.ticks; step += 1) {
    const tick = startTick + step
    const previous = resolvedPresenceCandidates(people.map((entry) => entry.person), allAssignments)

    for (const entry of people) {
      const circadian = circadianState(tick, entry.profile)
      const hasWork = entry.assignments.some((assignment) => assignment.assignmentType === 'work')
      const decision = decidePopulationAction({
        person: entry.person,
        needs: needsOf(entry),
        assignments: entry.assignments,
        skills: [],
        relationships: relationshipsOf(entry),
        knowledge: [],
        workObligation: hasWork ? circadian.workObligation : 0,
        travelCostHome: 0.1,
        travelCostWork: 0.1,
        sleepDrive: circadian.sleepDrive,
        affect: decayAffect(entry.affect, tick, affectProfileFromTraits(entry.traits)),
      })
      for (const code of NEED_CODES) {
        entry.needs[code] = Math.max(0, Math.min(1, entry.needs[code] + needDelta(decision.action, code)))
      }
      const asleep = decision.factors.asleep === true
      if (asleep) sleepTicks += 1
      if (decision.action === 'work') workTicks += 1
      // Travel is resolved in one hour: the person is at the destination next tick.
      const destination = decision.action === 'travel_home' ? 'home' : decision.action === 'travel_work' ? 'work' : null
      const target = destination ? entry.assignments.find((assignment) => assignment.assignmentType === destination) : undefined
      entry.person = {
        ...entry.person,
        currentLocationId: target?.locationId ?? entry.person.currentLocationId,
        activityState: activityForAction(decision.action),
        lastAction: asleep ? 'sleep' : decision.action,
        lastTick: tick,
      }
    }

    const current = resolvedPresenceCandidates(people.map((entry) => entry.person), allAssignments)
    for (const encounter of derivePopulationEncounters({ tick, candidates: current, previousCandidates: previous })) {
      let counted = false
      for (const event of [encounter.eventA, encounter.eventB]) {
        const last = byId.get(event.actorPersonId!)?.relationships.get(event.relatedPersonId!)?.lastInteractionTick
        if (!isFreshEncounter(last, tick)) continue
        applySocialEvent(event)
        counted = true
      }
      if (counted) encounters += 1
    }

    for (const event of scenario.get(step) ?? []) {
      const subject = byId.get(event.personId)
      if (!subject) continue
      if (isHealthEvent(event)) {
        const profile = affectProfileFromTraits(subject.traits)
        subject.affect = applyPain(subject.affect, painFromHealthEvent({ eventType: event.type, severity: event.severity }, profile), tick, profile)
        continue
      }
      const social = event
      const directed = (actorId: string, otherId: string | null): PopulationEvent => ({
        id: `scenario:${step}:${social.type}:${actorId}`, tick, eventType: social.type, actorPersonId: actorId,
        relatedPersonId: otherId, locationId: byId.get(actorId)?.person.currentLocationId ?? null,
        subjectType: null, subjectRef: null, payload: social.severity == null ? {} : { severity: social.severity },
      })
      applySocialEvent(directed(social.personId, social.otherPersonId ?? null))
      if (social.otherPersonId && social.mutual !== false) applySocialEvent(directed(social.otherPersonId, social.personId))
    }

    if ((step + 1) % DAY_TICKS === 0 || step === options.ticks - 1) {
      const hours = ((step % DAY_TICKS) + 1)
      const affect = people.map((entry) => decayAffect(entry.affect, tick, affectProfileFromTraits(entry.traits)))
      const relations = people.flatMap((entry) => [...entry.relationships.values()])
      days.push({
        day: days.length + 1,
        sleepHours: round((sleepTicks / people.length) * (DAY_TICKS / hours)),
        workHours: round((workTicks / people.length) * (DAY_TICKS / hours)),
        restAvg: round(mean(people.map((entry) => entry.needs.rest))),
        sustenanceAvg: round(mean(people.map((entry) => entry.needs.sustenance))),
        encounters,
        joyAvg: round(mean(affect.map((state) => state.joy))),
        fearAvg: round(mean(affect.map((state) => state.fear))),
        angerAvg: round(mean(affect.map((state) => state.anger))),
        sadnessAvg: round(mean(affect.map((state) => state.sadness))),
        painAvg: round(mean(affect.map((state) => state.pain))),
        moodAvg: round(mean(affect.map((state) => state.mood))),
        relationships: relations.length,
        familiarityAvg: round(mean(relations.map((relation) => relation.familiarity))),
        trustAvg: round(mean(relations.map((relation) => relation.trust))),
        affinityAvg: round(mean(relations.map((relation) => relation.affinity))),
        closeTies: relations.filter((relation) => relation.familiarity >= CLOSE_FAMILIARITY && relation.trust >= CLOSE_TRUST && relation.affinity >= CLOSE_AFFINITY).length,
      })
      sleepTicks = 0; workTicks = 0; encounters = 0
    }
  }

  const lastTick = startTick + options.ticks - 1
  return {
    people: people.length,
    ticks: options.ticks,
    days,
    final: {
      affect: people.map((entry) => decayAffect(entry.affect, lastTick, affectProfileFromTraits(entry.traits))),
      relationships: people.flatMap((entry) => [...entry.relationships.values()]),
      needs: Object.fromEntries(people.map((entry) => [entry.person.id, { ...entry.needs }])),
    },
  }
}

/** A synthetic colony for runs without a live snapshot. Deterministic for equal arguments. */
export function syntheticColony(input: { people: number; settlements?: number; workplacesPerSettlement?: number; homesPerSettlement?: number }): ColonySnapshot {
  const settlements = Math.max(1, input.settlements ?? 1)
  const workplaces = Math.max(1, input.workplacesPerSettlement ?? 3)
  const homes = Math.max(1, input.homesPerSettlement ?? 4)
  const people: SnapshotPerson[] = []
  for (let index = 0; index < input.people; index += 1) {
    const settlement = index % settlements
    const local = Math.floor(index / settlements)
    const locationId = `settlement-${settlement}`
    people.push({
      id: `person-${String(index).padStart(4, '0')}`,
      locationId,
      traits: {},
      needs: { sustenance: 0.8, rest: 0.8, safety: 1, social: 1, purpose: 1 },
      assignments: [
        { type: 'home', locationId, tileEntityId: `${locationId}:home-${local % homes}` },
        { type: 'work', locationId, tileEntityId: `${locationId}:work-${(local * 7 + 3) % workplaces}` },
      ],
    })
  }
  return { people, relationships: [], tick: null }
}

export function daysToCsv(days: ColonyDayRow[]): string {
  if (!days.length) return ''
  const columns = Object.keys(days[0]) as (keyof ColonyDayRow)[]
  return [columns.join(','), ...days.map((row) => columns.map((column) => row[column]).join(','))].join('\n') + '\n'
}
