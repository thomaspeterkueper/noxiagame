// lib/game/population/engine.ts
// NOXIA-LIVING-0001 — persistence adapter for the deterministic population model.
// Named people remain owned by personBrain; unnamed people use decision.ts.

import { decidePopulationAction as decideFromState, type PopulationDecisionContext } from './decision'
import { actionIntentForDecision } from './actionIntent'
import { executePopulationActionIntent } from './personActionExecutor'
import { derivePopulationEncounters, isFreshEncounter, type PopulationEncounter } from './encounters'
import { projectEncounterRelationship } from './encounterProjection'
import { resolvedPresenceCandidates } from './presence'
import { persistPopulationEventMemory } from '../personSocialMemoryPersistence'
import { persistObservableKnowledge } from './observableKnowledge'
import { projectInteriorPresence } from './interiorPresence'
import { circadianProfile, circadianState } from './circadian'
import { activityForAction, encounterNeedDelta, needDelta, passiveNeedDrift, varietyFloor, type NeedEnvironment } from './actionEffects'
import { encounterEventType, encounterOutcome, ENCOUNTER_EVENT_TYPES, type EncounterOutcome } from './socialFriction'
import { encounterQualities, decayAffect, affectProfileFromTraits } from '../cognition/personAffect'
import { fadeRelationships, pairCompatibility } from './relationshipDynamics'
import { affectForDecision, applyEventAffect, loadAffectSnapshot, needsWithPlaceAversion, type AffectSnapshot } from './affectRuntime'
import type { Person, PersonActivityState, PersonAssignment, PersonRelationship, PopulationAction, PopulationEvent } from './types'

type SupabaseLike = any

export type PopulationTickDecision = {
  action: PopulationAction
  activityState: PersonActivityState
  factors: Record<string, number | string | boolean>
}

export function decidePopulationAction(tick: number, hasWork: boolean): PopulationTickDecision {
  const phase = Math.abs(tick) % 4
  if (!hasWork) return { action: 'rest', activityState: 'resting', factors: { phase, hasWork: false, reason: 'no_active_work_assignment' } }
  if (phase === 0) return { action: 'travel_work', activityState: 'travelling', factors: { phase, hasWork: true, destination: 'work' } }
  if (phase === 1 || phase === 2) return { action: 'work', activityState: 'working', factors: { phase, hasWork: true, obligation: 1 } }
  return { action: 'travel_home', activityState: 'travelling', factors: { phase, hasWork: true, destination: 'home' } }
}

function actionFromNamedActivity(activity: PersonActivityState): PopulationAction {
  if (activity === 'working') return 'work'
  if (activity === 'resting') return 'rest'
  if (activity === 'travelling') return 'travel_work'
  if (activity === 'socialising') return 'social_interaction'
  if (activity === 'inspecting') return 'inspect_problem'
  return 'satisfy_basic_need'
}

function personFromRow(person: any): Person {
  return {
    id: person.id,
    displayName: person.display_name,
    birthYear: person.birth_year ?? null,
    currentLocationId: person.current_location_id,
    simulationTier: person.simulation_tier,
    activityState: person.activity_state,
    lastAction: person.last_action ?? null,
    lastDecisionFactors: person.last_decision_factors ?? {},
    lastTick: person.last_tick ?? null,
  }
}

function assignmentFromRow(row: any): PersonAssignment {
  return {
    id: row.id,
    personId: row.person_id,
    assignmentType: row.assignment_type,
    locationId: row.location_id,
    tileEntityId: row.tile_entity_id ?? null,
    employerActorId: row.employer_actor_id ?? null,
    roleCode: row.role_code ?? null,
    startsTick: row.starts_tick ?? null,
    endsTick: row.ends_tick ?? null,
    isActive: Boolean(row.is_active),
  }
}

function relationshipFromRow(row: any): PersonRelationship {
  return {
    id: row.id,
    personId: row.person_id,
    otherPersonId: row.other_person_id,
    relationshipType: row.relationship_type,
    familiarity: Number(row.familiarity),
    trust: Number(row.trust),
    affinity: Number(row.affinity),
    lastInteractionTick: row.last_interaction_tick ?? null,
  }
}

async function updateNeedsForAction(
  supabase: SupabaseLike,
  personId: string,
  needs: any[],
  action: PopulationAction,
  tick: number,
  environment: NeedEnvironment = {},
) {
  for (const need of needs) {
    const current = Number(need.satisfaction ?? 1)
    // NOXIA-LIVING-0009: the action's effect under local supply, plus what wears off every hour.
    const next = Math.max(0, Math.min(1, current + needDelta(action, need.need_code, environment) + passiveNeedDrift(need.need_code, environment, current)))
    await supabase.from('person_needs').update({ satisfaction: next, updated_tick: tick, updated_at: new Date().toISOString() }).eq('person_id', personId).eq('need_code', need.need_code)
    // Keep the in-memory row current: later steps of this tick read it.
    need.satisfaction = next
    need.updated_tick = tick
  }
}

/** Supply of a settlement as far as the world state knows it: supplied or not. */
const UNSUPPLIED_LEVEL = 0.4
function supplyFromLocationRow(row: any): number {
  return row && row.is_supplied === false ? UNSUPPLIED_LEVEL : 1
}

async function decideBackgroundPerson(
  supabase: SupabaseLike,
  person: any,
  tick: number,
  needRows: any[],
  assignmentRows: any[],
  affectSnapshot: AffectSnapshot,
) {
  const [{ data: skillRows }, { data: relationRows }, { data: knowledgeRows }] = await Promise.all([
    supabase.from('person_skills').select('*').eq('person_id', person.id),
    supabase.from('person_relationships').select('*').eq('person_id', person.id),
    supabase.from('person_knowledge').select('*').eq('person_id', person.id),
  ])
  const circadian = circadianState(tick, circadianProfile(person.id, person.traits ?? null))
  const knowledge = (knowledgeRows ?? []).map((r: any) => ({ id: r.id, personId: person.id, subjectType: r.subject_type, subjectRef: r.subject_ref, knowledgeType: r.knowledge_type, confidence: Number(r.confidence), learnedTick: Number(r.learned_tick), sourceEventId: r.source_event_id ?? null, details: r.details ?? {} }))
  const context: PopulationDecisionContext = {
    person: personFromRow(person),
    assignments: (assignmentRows ?? []).map(assignmentFromRow),
    // NOXIA-LIVING-0006: a place that hurt before lowers perceived safety for this decision only.
    needs: needsWithPlaceAversion(
      (needRows ?? []).map((r: any) => ({ personId: person.id, needCode: r.need_code, satisfaction: Number(r.satisfaction), updatedTick: r.updated_tick ?? null })),
      affectSnapshot.aversionsByPerson.get(person.id),
      person.current_location_id,
      tick,
    ),
    skills: (skillRows ?? []).map((r: any) => ({ personId: person.id, skillCode: r.skill_code, level: Number(r.level), experience: Number(r.experience), updatedTick: r.updated_tick ?? null })),
    // NOXIA-LIVING-0008: decisions see relationships as they stand now, faded since the last contact.
    relationships: fadeRelationships((relationRows ?? []).map(relationshipFromRow), tick),
    knowledge,
    localProblems: knowledge.filter((k: any) => k.knowledgeType === 'observed_failure' || k.knowledgeType === 'known_problem').map((k: any) => ({ subjectType: k.subjectType, subjectRef: k.subjectRef, severity: Number(k.details?.severity ?? k.confidence), requiredSkill: k.details?.requiredSkill ?? null, reportable: k.details?.reportable !== false })),
    // NOXIA-LIVING-0007: work follows the person's day rhythm instead of a four-tick cycle.
    workObligation: (assignmentRows ?? []).some((r: any) => r.assignment_type === 'work') ? circadian.workObligation : 0,
    sleepDrive: circadian.sleepDrive,
    travelCostHome: 0.1,
    travelCostWork: 0.1,
    affect: affectForDecision(affectSnapshot, person.id, tick, person.traits ?? null),
  }
  return { decision: decideFromState(context), context }
}

interface EncounterAffectContext {
  needsByPerson: Map<string, any[]>
  traitsByPerson: Map<string, Record<string, unknown> | null>
  affectSnapshot: AffectSnapshot
  supplyByLocation: Map<string, number>
}

async function persistEncounterDirection(supabase: SupabaseLike, event: PopulationEvent, affectContext: EncounterAffectContext): Promise<boolean> {
  if (!event.actorPersonId || !event.relatedPersonId) return false
  let persistedEvent: PopulationEvent | null = null

  // NOXIA-LIVING-0007: a reunion within the cooldown is not a new encounter.
  // Checked before anything is written, so it leaves no event, memory or affect.
  // All relationships of the actor: the one with this person for the cooldown,
  // the others to decide whether it holds a close slot (NOXIA-LIVING-0008).
  const { data: actorRelationshipRows, error: recentError } = await supabase
    .from('person_relationships')
    .select('*')
    .eq('person_id', event.actorPersonId)
  if (recentError) throw recentError
  const actorRelationships: PersonRelationship[] = (actorRelationshipRows ?? []).map(relationshipFromRow)
  const recentRelationship = actorRelationships.find((relation) => relation.otherPersonId === event.relatedPersonId)
  const lastInteractionTick = recentRelationship?.lastInteractionTick ?? null
  // An interaction recorded for this very tick is a replay and falls through to the guards below.
  if (lastInteractionTick !== event.tick && !isFreshEncounter(lastInteractionTick, event.tick)) return false

  const { data: existingEvents, error: eventLookupError } = await supabase
    .from('population_events')
    .select('id')
    .eq('tick', event.tick)
    // Any encounter type counts: on a replay the outcome must not be stored a second time under another type.
    .in('event_type', ENCOUNTER_EVENT_TYPES as string[])
    .eq('actor_person_id', event.actorPersonId)
    .eq('related_person_id', event.relatedPersonId)
    .limit(1)
  if (eventLookupError) throw eventLookupError

  if (!existingEvents?.length) {
    const { data: insertedEvent, error: insertError } = await supabase.from('population_events').insert({
      tick: event.tick,
      event_type: event.eventType,
      actor_person_id: event.actorPersonId,
      related_person_id: event.relatedPersonId,
      location_id: event.locationId,
      subject_type: event.subjectType,
      subject_ref: event.subjectRef,
      payload: event.payload,
    }).select('id').single()
    if (insertError) throw insertError
    // Memory is downstream of the authoritative persisted event. Use its DB UUID,
    // never the synthetic in-memory encounter id, as source_event_id.
    persistedEvent = { ...event, id: insertedEvent.id }
    const memoryResult = await persistPopulationEventMemory(supabase, persistedEvent, { projectRelationship: false })
    if (memoryResult.errors.length) throw new Error(memoryResult.errors.join('; '))
    await persistObservableKnowledge(supabase, persistedEvent)
  }

  const { data: relationshipRow, error: relationshipError } = await supabase
    .from('person_relationships')
    .select('*')
    .eq('person_id', event.actorPersonId)
    .eq('other_person_id', event.relatedPersonId)
    .maybeSingle()
  if (relationshipError) throw relationshipError

  const current = relationshipRow ? relationshipFromRow(relationshipRow) : null

  // NOXIA-LIVING-0006: appraise the newly persisted event against the relationship
  // as it stood before this encounter. Affect failures never fail the tick.
  if (persistedEvent) {
    await applyEventAffect(supabase, persistedEvent, {
      needs: (affectContext.needsByPerson.get(event.actorPersonId) ?? []).map((r: any) => ({ needCode: r.need_code, satisfaction: Number(r.satisfaction) })),
      relationship: current,
      traits: affectContext.traitsByPerson.get(event.actorPersonId) ?? null,
    })
    // NOXIA-LIVING-0009: someone close answers the need for contact, someone new the need for variety.
    const qualities = event.eventType === 'person_conflict' ? { novelty: 0, closeness: 0 } : encounterQualities(current ? fadeRelationships([current], event.tick)[0] : null)
    for (const need of affectContext.needsByPerson.get(event.actorPersonId) ?? []) {
      const gain = encounterNeedDelta(need.need_code, qualities)
      if (gain === 0) continue
      const next = Math.max(0, Math.min(1, Number(need.satisfaction ?? 1) + gain))
      await supabase.from('person_needs').update({ satisfaction: next, updated_tick: event.tick, updated_at: new Date().toISOString() }).eq('person_id', event.actorPersonId).eq('need_code', need.need_code)
      need.satisfaction = next
    }
  }
  if ((current?.lastInteractionTick ?? -1) >= event.tick) return false

  const projection = projectEncounterRelationship(event, current, actorRelationships)
  if (!projection) return false
  const relationship = projection.relationship
  const { error: upsertError } = await supabase.from('person_relationships').upsert({
    person_id: relationship.personId,
    other_person_id: relationship.otherPersonId,
    relationship_type: relationship.relationshipType,
    familiarity: relationship.familiarity,
    trust: relationship.trust,
    affinity: relationship.affinity,
    last_interaction_tick: relationship.lastInteractionTick,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'person_id,other_person_id' })
  if (upsertError) throw upsertError
  return true
}

/** NOXIA-LIVING-0009: how this meeting goes, from the state of both people and the settlement. */
async function decideEncounterOutcome(supabase: SupabaseLike, encounter: PopulationEncounter, context: EncounterAffectContext): Promise<EncounterOutcome> {
  const { data: rows, error } = await supabase
    .from('person_relationships')
    .select('*')
    .in('person_id', [encounter.personAId, encounter.personBId])
    .in('other_person_id', [encounter.personAId, encounter.personBId])
  if (error) throw error
  const faded = fadeRelationships((rows ?? []).map(relationshipFromRow), encounter.tick)
  const affinity = (from: string, to: string) => faded.find((relation) => relation.personId === from && relation.otherPersonId === to)?.affinity
  const person = (id: string) => {
    const needs: Record<string, number> = {}
    for (const row of context.needsByPerson.get(id) ?? []) needs[row.need_code] = Number(row.satisfaction)
    const stored = context.affectSnapshot.affectByPerson.get(id)
    return { id, needs, affect: stored ? decayAffect(stored, encounter.tick, affectProfileFromTraits(context.traitsByPerson.get(id) ?? null)) : null }
  }
  return encounterOutcome({
    tick: encounter.tick,
    a: person(encounter.personAId),
    b: person(encounter.personBId),
    compatibility: pairCompatibility(encounter.personAId, encounter.personBId),
    affinityAB: affinity(encounter.personAId, encounter.personBId),
    affinityBA: affinity(encounter.personBId, encounter.personAId),
    supply: context.supplyByLocation.get(encounter.locationId) ?? 1,
  })
}

async function persistEncounter(supabase: SupabaseLike, encounter: PopulationEncounter, affectContext: EncounterAffectContext): Promise<number> {
  const outcome = await decideEncounterOutcome(supabase, encounter, affectContext)
  const typed = (event: PopulationEvent): PopulationEvent => ({
    ...event,
    eventType: encounterEventType(outcome, event.actorPersonId ?? ''),
    payload: { ...event.payload, outcome: outcome.kind },
  })
  let projected = 0
  if (await persistEncounterDirection(supabase, typed(encounter.eventA), affectContext)) projected += 1
  if (await persistEncounterDirection(supabase, typed(encounter.eventB), affectContext)) projected += 1
  return projected
}

export async function runPopulationTick(supabase: SupabaseLike, tick: number) {
  const { data: people, error: peopleError } = await supabase.from('people').select('*').eq('simulation_tier', 'active').order('id').limit(50)
  if (peopleError) {
    if (String(peopleError.message ?? '').toLowerCase().includes('people')) return { processed: 0, namedNeedsAdvanced: 0, encounters: 0, relationshipsProjected: 0, skipped: true }
    throw peopleError
  }

  const peopleRows = people ?? []
  const personIds = peopleRows.map((person: any) => person.id)
  let assignmentRows: any[] = []
  if (personIds.length) {
    const { data, error } = await supabase.from('person_assignments').select('*').eq('is_active', true).in('person_id', personIds)
    if (error) throw error
    assignmentRows = data ?? []
  }
  const assignments = assignmentRows.map(assignmentFromRow)
  const assignmentRowsByPerson = new Map<string, any[]>()
  for (const row of assignmentRows) {
    const rows = assignmentRowsByPerson.get(row.person_id) ?? []
    rows.push(row)
    assignmentRowsByPerson.set(row.person_id, rows)
  }

  let needRows: any[] = []
  if (personIds.length) {
    const { data, error } = await supabase
      .from('person_needs')
      .select('person_id, need_code, satisfaction, updated_tick')
      .in('person_id', personIds)
    if (error) throw error
    needRows = data ?? []
  }
  const needsByPerson = new Map<string, any[]>()
  for (const row of needRows) {
    const rows = needsByPerson.get(row.person_id) ?? []
    rows.push(row)
    needsByPerson.set(row.person_id, rows)
  }

  const affectSnapshot = await loadAffectSnapshot(supabase, personIds)
  const traitsByPerson = new Map<string, Record<string, unknown> | null>(peopleRows.map((person: any) => [person.id, person.traits ?? null] as const))

  // NOXIA-LIVING-0009: local supply changes what a meal restores and how tense people are.
  const supplyByLocation = new Map<string, number>()
  const locationIds = [...new Set(peopleRows.map((person: any) => person.current_location_id).filter(Boolean))]
  if (locationIds.length) {
    const { data: locationRows } = await supabase.from('locations').select('id, is_supplied').in('id', locationIds)
    for (const row of locationRows ?? []) supplyByLocation.set(row.id, supplyFromLocationRow(row))
  }
  const environmentOf = (person: any): NeedEnvironment => ({
    supply: supplyByLocation.get(person.current_location_id) ?? 1,
    varietyFloor: varietyFloor(person.id, person.traits ?? null),
  })

  const previousPeople: Person[] = peopleRows.map(personFromRow)
  const currentPeople = new Map<string, Person>(previousPeople.map(person => [person.id, person] as const))
  const previousCandidates = resolvedPresenceCandidates(previousPeople, assignments)

  let processed = 0
  let namedNeedsAdvanced = 0
  for (const person of peopleRows) {
    if (Number(person.last_tick ?? -1) >= tick) continue
    if (person.person_key) {
      await updateNeedsForAction(supabase, person.id, needsByPerson.get(person.id) ?? [], actionFromNamedActivity(person.activity_state), tick, environmentOf(person))
      namedNeedsAdvanced += 1
      continue
    }
    const personNeeds = needsByPerson.get(person.id) ?? []
    const { decision, context } = await decideBackgroundPerson(
      supabase,
      person,
      tick,
      personNeeds,
      assignmentRowsByPerson.get(person.id) ?? [],
      affectSnapshot,
    )
    const intent = actionIntentForDecision({
      personId: person.id,
      currentLocationId: person.current_location_id,
      assignments: context.assignments,
      decision,
      simulationTier: context.person.simulationTier,
      relationships: context.relationships,
      knowledge: context.knowledge,
    })
    const execution = intent.ok
      ? await executePopulationActionIntent(supabase, intent.intent, tick)
      : { executed: false as const, kind: 'blocked' as const, reason: intent.reason }

    const nextActivity = activityForAction(decision.action)
    const lastAction = decision.factors.asleep === true
      ? 'sleep'
      : execution.executed && execution.kind === 'social_visit' ? 'visit:social' : decision.action
    const decisionFactors = {
      ...decision.factors,
      score: decision.score,
      intent: intent.ok ? intent.intent.kind : null,
      intentBlocker: intent.ok ? null : intent.reason,
      execution: execution.executed ? execution.kind : null,
    }
    await supabase.from('people').update({ activity_state: nextActivity, last_action: lastAction, last_decision_factors: decisionFactors, last_tick: tick, updated_at: new Date().toISOString() }).eq('id', person.id)
    await updateNeedsForAction(supabase, person.id, personNeeds, decision.action, tick, environmentOf(person))
    await supabase.from('population_events').insert({
      tick,
      event_type: intent.ok ? `npc_${decision.action}` : 'npc_action_blocked',
      actor_person_id: person.id,
      location_id: person.current_location_id,
      subject_type: typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef ? 'problem' : null,
      subject_ref: typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef ? decision.factors.subjectRef : null,
      payload: {
        action: decision.action,
        score: decision.score,
        factors: decision.factors,
        intent: intent.ok ? intent.intent : null,
        blocker: intent.ok ? null : intent.reason,
        execution,
      },
    })
    currentPeople.set(person.id, {
      ...personFromRow(person),
      activityState: nextActivity,
      lastAction,
      lastDecisionFactors: decisionFactors,
      lastTick: tick,
    })
    processed += 1
  }

  const interiorPresence = await projectInteriorPresence(
    supabase,
    tick,
    peopleRows.map((person:any)=>({
      id:person.id,
      activity_state:(currentPeople.get(person.id)?.activityState ?? person.activity_state) as PersonActivityState,
    })),
    assignmentRows,
  )

  const currentCandidates = resolvedPresenceCandidates([...currentPeople.values()], assignments)
  const encounters = derivePopulationEncounters({ tick, candidates: currentCandidates, previousCandidates })
  let relationshipsProjected = 0
  for (const encounter of encounters) relationshipsProjected += await persistEncounter(supabase, encounter, { needsByPerson, traitsByPerson, affectSnapshot, supplyByLocation })

  return { processed, namedNeedsAdvanced, encounters: encounters.length, relationshipsProjected, interiorPresence, affectAvailable: affectSnapshot.available, skipped: false }
}
