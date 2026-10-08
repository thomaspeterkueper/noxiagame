// lib/research/colony/colonyRun.ts
// NOXIA-TIME-0001 — in-memory research run of the living population.
//
// Runs the same pure decision, day-rhythm, encounter, friction, memory,
// relationship and affect code as the live tick, without a database. One step is
// one game hour. Years of colony life take seconds, the live world is never
// touched, and the same snapshot and scenario always produce the same result.
//
// Simplified here: a visit takes one hour and stays inside the settlement, and a
// move happens at once whenever the person wants it and there is room.
// Not simulated (still bound to the database in the live engine): economy,
// construction, families and births, knowledge and colony pressures. Named
// persons use the general utility decision instead of their role logic.

import {
  affectProfileFromTraits,
  applyAffect,
  applyPain,
  appraisalFromPopulationEvent,
  appraiseEvent,
  decayAffect,
  encounterQualities,
  neutralAffect,
  painFromHealthEvent,
  type AffectState,
  type PainSource,
} from '../../game/cognition/personAffect'
import { memoryFromPopulationEvent, projectRelationship } from '../../game/personSocialMemory'
import { activityForAction, encounterNeedDelta, needDelta, passiveNeedDrift, RELOCATION_VARIETY_GAIN, varietyFloor } from '../../game/population/actionEffects'
import { circadianProfile, circadianState, DAY_TICKS, type CircadianProfile } from '../../game/population/circadian'
import { decidePopulationAction } from '../../game/population/decision'
import { derivePopulationEncounters, isFreshEncounter } from '../../game/population/encounters'
import { resolvedPresenceCandidates } from '../../game/population/presence'
import { fadeRelationships, pairCompatibility, relationshipTiers } from '../../game/population/relationshipDynamics'
import { decideRelocation, type RelocationKind, type RelocationOption } from '../../game/population/relocation'
import { encounterEventType, encounterOutcome, type FrictionPerson } from '../../game/population/socialFriction'
import { actionSpielraum, combineSpielraum, gini, materialAccess, placeSpielraum, relationalSpielraum, type SpielraumComponents } from '../../game/population/spielraum'
import { chooseVisitTarget } from '../../game/population/visitTarget'
import {
  NEED_CODES,
  type NeedCode,
  type Person,
  type PersonAssignment,
  type PersonNeed,
  type PersonRelationship,
  type PopulationEvent,
} from '../../game/population/types'

import { createMarket, type MarketResult, type MarketSetup } from './colonyMarket'

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
  relationshipType?: string | null
}

/** Same shape as experiments/colony/export-snapshot.sql returns. */
export interface ColonySnapshot {
  people: SnapshotPerson[]
  relationships?: SnapshotRelationship[] | null
  tick?: number | null
  /** 0..1 supply per settlement; missing settlements are fully supplied. */
  supply?: Record<string, number> | null
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
  /** Moves a person's home or workplace: the way to separate people or bring them together. */
  | { tick: number; type: 'reassign'; personId: string; assignment: 'home' | 'work'; tileEntityId: string | null; locationId?: string }
  /** Sets the supply of a settlement, e.g. 0.3 for a shortage and 1 for its end. */
  | { tick: number; type: 'supply'; locationId: string; level: number }

type HealthScenarioEvent = Extract<ScenarioEvent, { type: PainSource }>
type MoveScenarioEvent = Extract<ScenarioEvent, { type: 'reassign' }>
type SupplyScenarioEvent = Extract<ScenarioEvent, { type: 'supply' }>
const HEALTH_TYPES: readonly string[] = ['workplace_accident', 'environmental_exposure', 'exhaustion']
const isHealthEvent = (event: ScenarioEvent): event is HealthScenarioEvent => HEALTH_TYPES.includes(event.type)
const isMoveEvent = (event: ScenarioEvent): event is MoveScenarioEvent => event.type === 'reassign'
const isSupplyEvent = (event: ScenarioEvent): event is SupplyScenarioEvent => event.type === 'supply'

export interface ColonyRunOptions {
  /** Game hours to simulate. */
  ticks: number
  /** First tick number. Defaults to the snapshot tick + 1, else 0. Scenario ticks are relative to the start. */
  startTick?: number
  scenario?: ScenarioEvent[]
  /** Switch off single mechanisms to see what each one contributes. All default to true. */
  friction?: boolean
  relocation?: boolean
  /**
   * Housing and job market (NOXIA-LIVING-0010). With it, homes and jobs are scarce,
   * cost money and are granted or refused; Spielraum counts only places really open.
   */
  market?: MarketSetup
}

export interface ColonyDayRow {
  day: number
  /** Mean hours per person on this day. */
  sleepHours: number
  workHours: number
  restAvg: number
  sustenanceAvg: number
  socialAvg: number
  varietyAvg: number
  /** Meetings of two people on this day, of which conflicts and acts of help. */
  encounters: number
  conflicts: number
  assists: number
  visits: number
  moves: number
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
  /** Largest number of close ties any single person holds. */
  closeTiesMaxPerPerson: number
  /** Directed relationships with trust or affinity clearly below neutral. */
  strainedTies: number
  /** Spielraum (NOXIA-OMNI-0001): mean over all people, 0..1, and its three components. */
  spielraumAvg: number
  spielraumActionAvg: number
  spielraumRelationalAvg: number
  spielraumPlaceAvg: number
  /** The person with the least room on this day. */
  spielraumMin: number
  /** Share of people whose room is narrow (below 0.35). */
  spielraumNarrowShare: number
  /** How unequally room is distributed: 0 = equal. */
  spielraumGini: number
}

export interface ColonyMove {
  tick: number
  day: number
  personId: string
  kind: RelocationKind
  reason: string
  fromLocationId: string
  toLocationId: string
}

export interface ColonyRunResult {
  people: number
  ticks: number
  days: ColonyDayRow[]
  moves: ColonyMove[]
  /** Mean Spielraum of the residents of each settlement, one value per day (null while nobody lives there). */
  spielraumBySettlement: Record<string, (number | null)[]>
  /** Present when the run had a market. */
  market?: MarketResult
  final: {
    affect: AffectState[]
    relationships: PersonRelationship[]
    needs: Record<string, Record<NeedCode, number>>
    residents: Record<string, number>
    /** Home place of each person, in the order of the sorted ids; null without a home. */
    homes: (string | null)[]
    /** Spielraum of each person and the mean per settlement on the last day. */
    spielraum: Record<string, SpielraumComponents>
    spielraumBySettlement: Record<string, number>
  }
}

// Friendship thresholds from population/socialLife.ts (recency is not modelled here).
const CLOSE_FAMILIARITY = 0.45
const CLOSE_TRUST = 0.56
const CLOSE_AFFINITY = 0.58

const isClose = (relation: PersonRelationship): boolean => relation.familiarity >= CLOSE_FAMILIARITY && relation.trust >= CLOSE_TRUST && relation.affinity >= CLOSE_AFFINITY
const isStrained = (relation: PersonRelationship): boolean => relation.trust < 0.4 || relation.affinity < 0.4
const NARROW_SPIELRAUM = 0.35
const round = (value: number): number => Math.round(value * 10_000) / 10_000
const mean = (values: number[]): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0)
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const placeKey = (locationId: string, tileEntityId: string | null): string => `${locationId}\u0000${tileEntityId ?? ''}`

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface SimPerson {
  person: Person
  traits: Record<string, unknown> | null
  profile: CircadianProfile
  needs: Record<NeedCode, number>
  assignments: PersonAssignment[]
  visit: PersonAssignment | null
  affect: AffectState
  relationships: Map<string, PersonRelationship>
  relationshipList: PersonRelationship[] | null
  lastMoveTick: Record<RelocationKind, number | null>
  reviewHour: number
  varietyFloor: number
  /** Action room summed over the waking hours of the current day. */
  actionRoomSum: number
  actionRoomHours: number
}

interface Place {
  locationId: string
  tileEntityId: string | null
  capacity: number
}

function initialPeople(snapshot: ColonySnapshot): SimPerson[] {
  const people = [...snapshot.people].sort((a, b) => a.id.localeCompare(b.id)).map((entry): SimPerson => {
    const needs = {} as Record<NeedCode, number>
    for (const code of NEED_CODES) needs[code] = clamp01(Number(entry.needs?.[code] ?? 1))
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
      visit: null,
      affect: neutralAffect(entry.id),
      relationships: new Map(),
      relationshipList: null,
      lastMoveTick: { home: null, work: null },
      reviewHour: hash(`review:${entry.id}`) % DAY_TICKS,
      varietyFloor: varietyFloor(entry.id, entry.traits ?? null),
      actionRoomSum: 0,
      actionRoomHours: 0,
    }
  })
  const byId = new Map(people.map((entry) => [entry.person.id, entry]))
  for (const relation of snapshot.relationships ?? []) {
    const owner = byId.get(relation.personId)
    if (!owner || !byId.has(relation.otherPersonId)) continue
    owner.relationships.set(relation.otherPersonId, {
      id: `relationship:${relation.personId}:${relation.otherPersonId}`, personId: relation.personId,
      otherPersonId: relation.otherPersonId, relationshipType: relation.relationshipType ?? 'acquaintance', familiarity: Number(relation.familiarity),
      trust: Number(relation.trust), affinity: Number(relation.affinity),
      lastInteractionTick: relation.lastInteractionTick == null ? null : Number(relation.lastInteractionTick),
    })
  }
  return people
}

/** Homes and workplaces known from the snapshot, each with one place to spare. */
function initialPlaces(people: SimPerson[], kind: RelocationKind): Map<string, Place> {
  const places = new Map<string, Place>()
  for (const entry of people) {
    for (const assignment of entry.assignments) {
      if (assignment.assignmentType !== kind) continue
      const key = placeKey(assignment.locationId, assignment.tileEntityId)
      const place = places.get(key) ?? { locationId: assignment.locationId, tileEntityId: assignment.tileEntityId, capacity: 1 }
      place.capacity += 1
      places.set(key, place)
    }
  }
  return places
}

export function runColony(snapshot: ColonySnapshot, options: ColonyRunOptions): ColonyRunResult {
  const people = initialPeople(snapshot)
  const byId = new Map(people.map((entry) => [entry.person.id, entry]))
  const places: Record<RelocationKind, Map<string, Place>> = { home: initialPlaces(people, 'home'), work: initialPlaces(people, 'work') }
  const supply = new Map<string, number>(Object.entries(snapshot.supply ?? {}).map(([id, level]) => [id, clamp01(Number(level))]))
  const supplyOf = (locationId: string): number => supply.get(locationId) ?? 1
  const withFriction = options.friction !== false
  const withRelocation = options.relocation !== false
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
  const fadedAt = (entry: SimPerson, tick: number): PersonRelationship[] => fadeRelationships(relationshipsOf(entry), tick)
  const affectAt = (entry: SimPerson, tick: number): AffectState => decayAffect(entry.affect, tick, affectProfileFromTraits(entry.traits))
  const assignmentOf = (entry: SimPerson, kind: RelocationKind): PersonAssignment | undefined =>
    entry.assignments.find((assignment) => assignment.assignmentType === kind)
  const presenceAssignments = (): PersonAssignment[] =>
    people.flatMap((entry) => (entry.visit ? [...entry.assignments, entry.visit] : entry.assignments))
  const frictionPerson = (entry: SimPerson, tick: number): FrictionPerson => ({ id: entry.person.id, needs: entry.needs, affect: affectAt(entry, tick) })
  const adjustNeed = (entry: SimPerson, code: NeedCode, delta: number): void => { entry.needs[code] = clamp01(entry.needs[code] + delta) }

  /** One directed social event: memory → relationship → affect, as the engine does. */
  const applySocialEvent = (event: PopulationEvent): void => {
    const actor = event.actorPersonId ? byId.get(event.actorPersonId) : undefined
    if (!actor) return
    const current = event.relatedPersonId ? actor.relationships.get(event.relatedPersonId) ?? null : null
    const profile = affectProfileFromTraits(actor.traits)
    const appraisal = appraisalFromPopulationEvent(event, { needs: needsOf(actor), relationship: current })
    if (appraisal) actor.affect = applyAffect(actor.affect, appraiseEvent(appraisal, profile), event.tick, profile)
    const memory = memoryFromPopulationEvent(event)
    const next = memory ? projectRelationship(current, memory, relationshipsOf(actor)) : null
    if (next && event.relatedPersonId) {
      actor.relationships.set(event.relatedPersonId, next)
      actor.relationshipList = null
    }
  }

  const reassign = (entry: SimPerson, kind: RelocationKind, locationId: string, tileEntityId: string | null): void => {
    const index = entry.assignments.findIndex((assignment) => assignment.assignmentType === kind)
    const base: PersonAssignment = index >= 0 ? entry.assignments[index] : {
      id: `${entry.person.id}:${kind}:scenario`, personId: entry.person.id, assignmentType: kind, locationId,
      tileEntityId: null, employerActorId: null, roleCode: null, startsTick: null, endsTick: null, isActive: true,
    }
    const next = { ...base, locationId, tileEntityId }
    if (index >= 0) entry.assignments[index] = next
    else entry.assignments.push(next)
    const key = placeKey(locationId, tileEntityId)
    if (!places[kind].has(key)) places[kind].set(key, { locationId, tileEntityId, capacity: 2 })
    if (spielraumBySettlement[locationId] === undefined) spielraumBySettlement[locationId] = days.map(() => null)
  }

  const occupants = (kind: RelocationKind): Map<string, SimPerson[]> => {
    const map = new Map<string, SimPerson[]>()
    for (const entry of people) {
      const assignment = assignmentOf(entry, kind)
      if (!assignment) continue
      const key = placeKey(assignment.locationId, assignment.tileEntityId)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return map
  }

  /** Daily review: does this person want to move home or change workplace, and is there somewhere to go? */
  const reviewRelocation = (entry: SimPerson, tick: number, day: number, moves: ColonyMove[]): boolean => {
    const faded = fadedAt(entry, tick)
    const affinityTo = new Map(faded.map((relation) => [relation.otherPersonId, relation.affinity]))
    const tiers = relationshipTiers(faded)
    const company = (others: SimPerson[]) => {
      const rest = others.filter((other) => other !== entry)
      return {
        affinity: rest.length ? mean(rest.map((other) => affinityTo.get(other.person.id) ?? 0.5)) : 0.5,
        close: rest.filter((other) => tiers.get(other.person.id) === 'close' || tiers.get(other.person.id) === 'partner').length,
      }
    }
    // One change at a time: a new home and a new job do not follow each other at once.
    const lastMove = [entry.lastMoveTick.home, entry.lastMoveTick.work].reduce<number | null>((latest, value) => value == null ? latest : latest == null ? value : Math.max(latest, value), null)
    for (const kind of ['home', 'work'] as const) {
      const current = assignmentOf(entry, kind)
      if (!current) continue
      const occupied = occupants(kind)
      const here = company(occupied.get(placeKey(current.locationId, current.tileEntityId)) ?? [])
      const workplaces = kind === 'home' ? occupants('work') : null
      const candidates: RelocationOption[] = []
      for (const [key, place] of places[kind]) {
        // A new workplace must be in the settlement the person lives in.
        if (kind === 'work' && place.locationId !== entry.person.currentLocationId) continue
        // A new home in another settlement needs a free workplace there.
        if (kind === 'home' && place.locationId !== current.locationId && assignmentOf(entry, 'work')) {
          const room = [...places.work.entries()].some(([workKey, work]) => work.locationId === place.locationId && (workplaces!.get(workKey)?.length ?? 0) < work.capacity)
          if (!room) continue
        }
        const there = company(occupied.get(key) ?? [])
        candidates.push({
          locationId: place.locationId, tileEntityId: place.tileEntityId ?? '',
          freePlaces: place.capacity - (occupied.get(key)?.length ?? 0), supply: supplyOf(place.locationId),
          affinityToResidents: there.affinity, closeTies: there.close,
        })
      }
      const decision = decideRelocation({
        personId: entry.person.id, tick, kind, needs: entry.needs,
        current: { locationId: current.locationId, tileEntityId: current.tileEntityId ?? '', supply: supplyOf(current.locationId), affinityToResidents: here.affinity, closeTies: here.close },
        lastMoveTick: lastMove, options: candidates,
      })
      if (!decision.move || !decision.target) continue
      const from = current.locationId
      reassign(entry, kind, decision.target.locationId, decision.target.tileEntityId || null)
      entry.lastMoveTick[kind] = tick
      if (kind === 'home' && decision.target.locationId !== from) {
        // Moving to another settlement: take the freest workplace there.
        const taken = occupants('work')
        const work = [...places.work.entries()]
          .filter(([, place]) => place.locationId === decision.target!.locationId)
          .map(([key, place]) => ({ place, free: place.capacity - (taken.get(key)?.length ?? 0) }))
          .filter((option) => option.free > 0)
          .sort((a, b) => (b.free - a.free) || (a.place.tileEntityId ?? '').localeCompare(b.place.tileEntityId ?? ''))[0]
        if (work && assignmentOf(entry, 'work')) {
          reassign(entry, 'work', work.place.locationId, work.place.tileEntityId)
          entry.lastMoveTick.work = tick
        }
        entry.person = { ...entry.person, currentLocationId: decision.target.locationId }
      }
      adjustNeed(entry, 'variety', RELOCATION_VARIETY_GAIN)
      moves.push({ tick, day, personId: entry.person.id, kind, reason: decision.reason, fromLocationId: from, toLocationId: decision.target.locationId })
      return true
    }
    return false
  }

  /** Spielraum of every person at `tick`, from the day's waking hours, their ties and the places open to them. */
  const measureSpielraum = (tick: number): SpielraumComponents[] => {
    const homes = occupants('home'), jobs = occupants('work')
    const free = (kind: RelocationKind, key: string, place: Place): boolean => ((kind === 'home' ? homes : jobs).get(key)?.length ?? 0) < place.capacity
    const jobLocations = new Set([...places.work.entries()].filter(([key, place]) => free('work', key, place)).map(([, place]) => place.locationId))
    return people.map((entry) => {
      const home = assignmentOf(entry, 'home'), work = assignmentOf(entry, 'work')
      let open = market ? market.openPlaces(entry.person.id, tick) : 0
      for (const [key, place] of market ? [] : places.home) {
        if (!free('home', key, place) || (home && key === placeKey(home.locationId, home.tileEntityId))) continue
        // Another settlement is only an option if one could also work there.
        if (place.locationId !== entry.person.currentLocationId && work && !jobLocations.has(place.locationId)) continue
        open += 1
      }
      for (const [key, place] of market ? [] : places.work) {
        if (place.locationId !== entry.person.currentLocationId || !free('work', key, place)) continue
        if (work && key === placeKey(work.locationId, work.tileEntityId)) continue
        open += 1
      }
      return combineSpielraum({
        action: entry.actionRoomHours ? entry.actionRoomSum / entry.actionRoomHours : 0,
        relational: relationalSpielraum(fadedAt(entry, tick)),
        place: placeSpielraum(
          open,
          supplyOf(entry.person.currentLocationId),
          market ? materialAccess(market.materialMeans(entry.person.id)) : 1,
        ),
      })
    })
  }

  const days: ColonyDayRow[] = []
  const moves: ColonyMove[] = []
  const unassign = (entry: SimPerson, kind: RelocationKind): void => { entry.assignments = entry.assignments.filter((assignment) => assignment.assignmentType !== kind) }
  const companyOf = (entry: SimPerson, others: string[], tick: number): { affinity: number; close: number } => {
    const faded = fadedAt(entry, tick)
    const affinityTo = new Map(faded.map((relation) => [relation.otherPersonId, relation.affinity]))
    const tiers = relationshipTiers(faded)
    const rest = others.filter((id) => id !== entry.person.id)
    return {
      affinity: rest.length ? mean(rest.map((id) => affinityTo.get(id) ?? 0.5)) : 0.5,
      close: rest.filter((id) => tiers.get(id) === 'close' || tiers.get(id) === 'partner').length,
    }
  }
  if (options.market) {
    // Capacity comes from the market, not from who happens to live or work somewhere.
    places.home.clear(); places.work.clear()
    for (const dwelling of options.market.dwellings) places.home.set(placeKey(dwelling.locationId, dwelling.tileEntityId ?? dwelling.id), { locationId: dwelling.locationId, tileEntityId: dwelling.tileEntityId ?? dwelling.id, capacity: dwelling.capacity })
    for (const job of options.market.jobs) places.work.set(placeKey(job.locationId, job.tileEntityId ?? job.id), { locationId: job.locationId, tileEntityId: job.tileEntityId ?? job.id, capacity: job.positions })
  }
  const market = options.market ? createMarket(options.market, {
    personIds: people.map((entry) => entry.person.id),
    location: (id) => byId.get(id)!.person.currentLocationId,
    home: (id) => assignmentOf(byId.get(id)!, 'home')?.tileEntityId ?? null,
    work: (id) => assignmentOf(byId.get(id)!, 'work')?.tileEntityId ?? null,
    setHome: (id, place) => { const entry = byId.get(id)!; if (place) reassign(entry, 'home', place.locationId, place.tileEntityId); else unassign(entry, 'home') },
    setWork: (id, place) => { const entry = byId.get(id)!; if (place) reassign(entry, 'work', place.locationId, place.tileEntityId); else unassign(entry, 'work') },
    moveTo: (id, locationId) => { const entry = byId.get(id)!; entry.person = { ...entry.person, currentLocationId: locationId } },
    needs: (id) => byId.get(id)!.needs,
    adjustNeed: (id, code, delta) => adjustNeed(byId.get(id)!, code, delta),
    company: (id, others, tick) => companyOf(byId.get(id)!, others, tick),
    affinity: (fromId, toId, tick) => { const from = byId.get(fromId); return from ? fadedAt(from, tick).find((relation) => relation.otherPersonId === toId)?.affinity : undefined },
    supply: supplyOf,
    lastMove: (id) => { const entry = byId.get(id)!; const { home, work } = entry.lastMoveTick; return home == null ? work : work == null ? home : Math.max(home, work) },
  }) : null
  let lastSpielraum: SpielraumComponents[] = []
  const settlementIds = [...new Set([...places.home.values(), ...places.work.values()].map((place) => place.locationId))].sort()
  const spielraumBySettlement: Record<string, (number | null)[]> = Object.fromEntries(settlementIds.map((id) => [id, []]))
  let sleepTicks = 0, workTicks = 0, encounters = 0, conflicts = 0, assists = 0, visits = 0, movesToday = 0

  for (let step = 0; step < options.ticks; step += 1) {
    const tick = startTick + step
    const day = Math.floor(step / DAY_TICKS) + 1
    const previous = resolvedPresenceCandidates(people.map((entry) => entry.person), presenceAssignments())

    for (const entry of people) {
      const circadian = circadianState(tick, entry.profile)
      const environment = { supply: supplyOf(entry.person.currentLocationId), varietyFloor: entry.varietyFloor, shelter: market ? market.shelter(entry.person.id) : undefined }
      const faded = fadedAt(entry, tick)
      const decision = decidePopulationAction({
        person: entry.person,
        needs: needsOf(entry),
        assignments: entry.assignments,
        skills: [],
        relationships: faded,
        knowledge: [],
        workObligation: assignmentOf(entry, 'work') ? circadian.workObligation : 0,
        travelCostHome: 0.1,
        travelCostWork: 0.1,
        sleepDrive: circadian.sleepDrive,
        affect: affectAt(entry, tick),
      })
      for (const code of NEED_CODES) adjustNeed(entry, code, needDelta(decision.action, code, environment) + passiveNeedDrift(code, environment, entry.needs[code]))
      const asleep = decision.factors.asleep === true
      if (asleep) sleepTicks += 1
      // Room to act is measured while awake; nobody chooses in their sleep.
      if (circadian.sleepDrive === 0 && decision.options) {
        entry.actionRoomSum += actionSpielraum(decision.options)
        entry.actionRoomHours += 1
      }
      if (decision.action === 'work') workTicks += 1

      // A visit: one hour at the home of the chosen person, inside the settlement.
      entry.visit = null
      if (decision.action === 'social_interaction') {
        const targetId = chooseVisitTarget(faded, {
          socialPressure: Number(decision.factors.socialPressure ?? 0),
          varietyPressure: Number(decision.factors.varietyPressure ?? 0),
        })
        const host = targetId ? byId.get(targetId) : undefined
        const hostHome = host ? assignmentOf(host, 'home') : undefined
        if (host && hostHome && hostHome.locationId === entry.person.currentLocationId) {
          entry.visit = { ...hostHome, id: `${entry.person.id}:visit`, personId: entry.person.id, assignmentType: 'temporary' }
          visits += 1
        }
      }

      // Travel is resolved in one hour: the person is at the destination next tick.
      const destination = decision.action === 'travel_home' ? 'home' : decision.action === 'travel_work' ? 'work' : null
      const target = destination ? assignmentOf(entry, destination) : undefined
      entry.person = {
        ...entry.person,
        currentLocationId: target?.locationId ?? entry.person.currentLocationId,
        activityState: activityForAction(decision.action),
        lastAction: asleep ? 'sleep' : decision.action,
        lastTick: tick,
      }
    }

    const current = resolvedPresenceCandidates(people.map((entry) => entry.person), presenceAssignments())
    for (const encounter of derivePopulationEncounters({ tick, candidates: current, previousCandidates: previous })) {
      const a = byId.get(encounter.personAId)!, b = byId.get(encounter.personBId)!
      const lastAB = a.relationships.get(b.person.id)?.lastInteractionTick
      const lastBA = b.relationships.get(a.person.id)?.lastInteractionTick
      // A reunion inside the cooldown is a continuation, not a new encounter.
      if (!isFreshEncounter(lastAB, tick) && !isFreshEncounter(lastBA, tick)) continue
      const fadedA = fadedAt(a, tick).find((relation) => relation.otherPersonId === b.person.id)
      const fadedB = fadedAt(b, tick).find((relation) => relation.otherPersonId === a.person.id)
      const outcome = withFriction
        ? encounterOutcome({
            tick, a: frictionPerson(a, tick), b: frictionPerson(b, tick),
            compatibility: pairCompatibility(a.person.id, b.person.id),
            affinityAB: fadedA?.affinity, affinityBA: fadedB?.affinity, supply: supplyOf(encounter.locationId),
          })
        : { kind: 'neutral' as const }
      encounters += 1
      if (outcome.kind === 'conflict') conflicts += 1
      if (outcome.kind === 'assistance') assists += 1
      for (const [actor, faded, event] of [[a, fadedA, encounter.eventA], [b, fadedB, encounter.eventB]] as const) {
        // What the meeting gives depends on what it meant before it happened.
        const qualities = outcome.kind === 'conflict' ? { novelty: 0, closeness: 0 } : encounterQualities(faded ?? null)
        applySocialEvent({ ...event, eventType: encounterEventType(outcome, actor.person.id) })
        for (const code of NEED_CODES) adjustNeed(actor, code, encounterNeedDelta(code, qualities))
      }
    }

    for (const event of scenario.get(step) ?? []) {
      if (isSupplyEvent(event)) { supply.set(event.locationId, clamp01(event.level)); continue }
      const subject = byId.get(event.personId)
      if (!subject) continue
      if (isMoveEvent(event)) {
        reassign(subject, event.assignment, event.locationId ?? assignmentOf(subject, event.assignment)?.locationId ?? subject.person.currentLocationId, event.tileEntityId)
        continue
      }
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

    if (withRelocation) {
      const hour = ((tick % DAY_TICKS) + DAY_TICKS) % DAY_TICKS
      if (market && hour === 0 && step > 0) market.daily(tick, day - 1)
      for (const entry of people) {
        if (entry.reviewHour !== hour) continue
        if (!market) { if (reviewRelocation(entry, tick, day, moves)) movesToday += 1; continue }
        const change = market.review(entry.person.id, tick, day)
        if (!change) continue
        entry.lastMoveTick[change.kind] = tick
        adjustNeed(entry, 'variety', RELOCATION_VARIETY_GAIN)
        if (spielraumBySettlement[change.toLocationId] === undefined) spielraumBySettlement[change.toLocationId] = days.map(() => null)
        moves.push({ tick, day, personId: entry.person.id, kind: change.kind, reason: change.reason, fromLocationId: change.fromLocationId, toLocationId: change.toLocationId })
        movesToday += 1
      }
    }

    if ((step + 1) % DAY_TICKS === 0 || step === options.ticks - 1) {
      const hours = (step % DAY_TICKS) + 1
      const affect = people.map((entry) => affectAt(entry, tick))
      const perPerson = people.map((entry) => fadedAt(entry, tick))
      const relations = perPerson.flat()
      const room = measureSpielraum(tick)
      days.push({
        day: days.length + 1,
        sleepHours: round((sleepTicks / people.length) * (DAY_TICKS / hours)),
        workHours: round((workTicks / people.length) * (DAY_TICKS / hours)),
        restAvg: round(mean(people.map((entry) => entry.needs.rest))),
        sustenanceAvg: round(mean(people.map((entry) => entry.needs.sustenance))),
        socialAvg: round(mean(people.map((entry) => entry.needs.social))),
        varietyAvg: round(mean(people.map((entry) => entry.needs.variety))),
        encounters, conflicts, assists, visits, moves: movesToday,
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
        closeTies: relations.filter(isClose).length,
        closeTiesMaxPerPerson: Math.max(0, ...perPerson.map((list) => list.filter(isClose).length)),
        strainedTies: relations.filter(isStrained).length,
        spielraumAvg: round(mean(room.map((value) => value.total))),
        spielraumActionAvg: round(mean(room.map((value) => value.action))),
        spielraumRelationalAvg: round(mean(room.map((value) => value.relational))),
        spielraumPlaceAvg: round(mean(room.map((value) => value.place))),
        spielraumMin: round(Math.min(...room.map((value) => value.total))),
        spielraumNarrowShare: round(room.filter((value) => value.total < NARROW_SPIELRAUM).length / room.length),
        spielraumGini: gini(room.map((value) => value.total)),
      })
      lastSpielraum = room
      market?.closeDay(days.length, tick)
      for (const locationId of Object.keys(spielraumBySettlement)) {
        const local = room.filter((_, index) => people[index].person.currentLocationId === locationId)
        spielraumBySettlement[locationId].push(local.length ? round(mean(local.map((value) => value.total))) : null)
      }
      for (const entry of people) { entry.actionRoomSum = 0; entry.actionRoomHours = 0 }
      sleepTicks = 0; workTicks = 0; encounters = 0; conflicts = 0; assists = 0; visits = 0; movesToday = 0
    }
  }

  const lastTick = startTick + options.ticks - 1
  const residents: Record<string, number> = {}
  for (const entry of people) residents[entry.person.currentLocationId] = (residents[entry.person.currentLocationId] ?? 0) + 1
  return {
    people: people.length,
    ticks: options.ticks,
    days,
    moves,
    spielraumBySettlement,
    ...(market ? { market: market.result() } : {}),
    final: {
      affect: people.map((entry) => affectAt(entry, lastTick)),
      relationships: people.flatMap((entry) => fadedAt(entry, lastTick)),
      needs: Object.fromEntries(people.map((entry) => [entry.person.id, { ...entry.needs }])),
      residents,
      homes: people.map((entry) => assignmentOf(entry, 'home')?.tileEntityId ?? null),
      spielraum: Object.fromEntries(people.map((entry, index) => [entry.person.id, lastSpielraum[index]])),
      spielraumBySettlement: Object.fromEntries(Object.keys(residents).sort().map((locationId) => [locationId, round(mean(people.map((entry, index) => ({ entry, room: lastSpielraum[index] })).filter((item) => item.entry.person.currentLocationId === locationId).map((item) => item.room.total)))])),
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
      needs: { sustenance: 0.8, rest: 0.8, safety: 1, social: 1, purpose: 1, variety: 0.8 },
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
