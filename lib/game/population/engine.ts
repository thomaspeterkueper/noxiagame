// lib/game/population/engine.ts
// NOXIA-LIVING-0001 — persistence adapter for the deterministic population model.
// Named people remain owned by personBrain; unnamed people use decision.ts.

import { decidePopulationAction as decideFromState, type PopulationDecisionContext } from './decision'
import type { PersonActivityState, PopulationAction } from './types'

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

function activityForAction(action: PopulationAction): PersonActivityState {
  if (action === 'work') return 'working'
  if (action === 'rest') return 'resting'
  if (action === 'travel_home' || action === 'travel_work') return 'travelling'
  if (action === 'social_interaction') return 'socialising'
  if (action === 'inspect_problem' || action === 'report_problem') return 'inspecting'
  return 'idle'
}

function needDelta(action: PopulationAction, needCode: string) {
  if (action === 'work') return needCode === 'rest' ? -0.05 : needCode === 'sustenance' ? -0.025 : needCode === 'purpose' ? 0.04 : needCode === 'social' ? 0.01 : 0
  if (action === 'rest') return needCode === 'rest' ? 0.12 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? -0.01 : 0
  if (action === 'satisfy_basic_need') return needCode === 'sustenance' ? 0.16 : needCode === 'safety' ? 0.05 : 0
  if (action === 'social_interaction') return needCode === 'social' ? 0.12 : needCode === 'rest' || needCode === 'sustenance' ? -0.01 : 0
  if (action === 'inspect_problem' || action === 'report_problem') return needCode === 'rest' ? -0.03 : needCode === 'sustenance' ? -0.015 : needCode === 'purpose' ? 0.05 : 0
  if (action === 'travel_home' || action === 'travel_work') return needCode === 'rest' ? -0.015 : needCode === 'sustenance' ? -0.01 : 0
  return 0
}

function actionFromNamedActivity(activity: PersonActivityState): PopulationAction {
  if (activity === 'working') return 'work'
  if (activity === 'resting') return 'rest'
  if (activity === 'travelling') return 'travel_work'
  if (activity === 'socialising') return 'social_interaction'
  if (activity === 'inspecting') return 'inspect_problem'
  return 'satisfy_basic_need'
}

async function updateNeedsForAction(supabase: SupabaseLike, personId: string, action: PopulationAction, tick: number) {
  const { data: needs } = await supabase.from('person_needs').select('need_code, satisfaction').eq('person_id', personId)
  for (const need of needs ?? []) {
    const next = Math.max(0, Math.min(1, Number(need.satisfaction ?? 1) + needDelta(action, need.need_code)))
    await supabase.from('person_needs').update({ satisfaction: next, updated_tick: tick, updated_at: new Date().toISOString() }).eq('person_id', personId).eq('need_code', need.need_code)
  }
}

async function decideBackgroundPerson(supabase: SupabaseLike, person: any, tick: number) {
  const [{ data: assignmentRows }, { data: needRows }, { data: skillRows }, { data: relationRows }, { data: knowledgeRows }] = await Promise.all([
    supabase.from('person_assignments').select('*').eq('person_id', person.id).eq('is_active', true),
    supabase.from('person_needs').select('*').eq('person_id', person.id),
    supabase.from('person_skills').select('*').eq('person_id', person.id),
    supabase.from('person_relationships').select('*').eq('person_id', person.id),
    supabase.from('person_knowledge').select('*').eq('person_id', person.id),
  ])
  const knowledge = (knowledgeRows ?? []).map((r: any) => ({ id: r.id, personId: person.id, subjectType: r.subject_type, subjectRef: r.subject_ref, knowledgeType: r.knowledge_type, confidence: Number(r.confidence), learnedTick: Number(r.learned_tick), sourceEventId: r.source_event_id ?? null, details: r.details ?? {} }))
  const context: PopulationDecisionContext = {
    person: { id: person.id, displayName: person.display_name, birthYear: person.birth_year ?? null, currentLocationId: person.current_location_id, simulationTier: person.simulation_tier, activityState: person.activity_state, lastAction: person.last_action ?? null, lastDecisionFactors: person.last_decision_factors ?? {}, lastTick: person.last_tick ?? null },
    assignments: (assignmentRows ?? []).map((r: any) => ({ id: r.id, personId: person.id, assignmentType: r.assignment_type, locationId: r.location_id, tileEntityId: r.tile_entity_id ?? null, employerActorId: r.employer_actor_id ?? null, roleCode: r.role_code ?? null, startsTick: r.starts_tick ?? null, endsTick: r.ends_tick ?? null, isActive: Boolean(r.is_active) })),
    needs: (needRows ?? []).map((r: any) => ({ personId: person.id, needCode: r.need_code, satisfaction: Number(r.satisfaction), updatedTick: r.updated_tick ?? null })),
    skills: (skillRows ?? []).map((r: any) => ({ personId: person.id, skillCode: r.skill_code, level: Number(r.level), experience: Number(r.experience), updatedTick: r.updated_tick ?? null })),
    relationships: (relationRows ?? []).map((r: any) => ({ id: r.id, personId: person.id, otherPersonId: r.other_person_id, relationshipType: r.relationship_type, familiarity: Number(r.familiarity), trust: Number(r.trust), affinity: Number(r.affinity), lastInteractionTick: r.last_interaction_tick ?? null })),
    knowledge,
    localProblems: knowledge.filter((k: any) => k.knowledgeType === 'observed_failure' || k.knowledgeType === 'known_problem').map((k: any) => ({ subjectType: k.subjectType, subjectRef: k.subjectRef, severity: Number(k.details?.severity ?? k.confidence), requiredSkill: k.details?.requiredSkill ?? null, reportable: k.details?.reportable !== false })),
    workObligation: (assignmentRows ?? []).some((r: any) => r.assignment_type === 'work') ? (Math.abs(tick) % 4 === 3 ? 0.35 : 0.85) : 0,
    travelCostHome: 0.1,
    travelCostWork: 0.1,
  }
  return decideFromState(context)
}

export async function runPopulationTick(supabase: SupabaseLike, tick: number) {
  const { data: people, error: peopleError } = await supabase.from('people').select('*').eq('simulation_tier', 'active').order('id').limit(50)
  if (peopleError) {
    if (String(peopleError.message ?? '').toLowerCase().includes('people')) return { processed: 0, namedNeedsAdvanced: 0, skipped: true }
    throw peopleError
  }
  let processed = 0
  let namedNeedsAdvanced = 0
  for (const person of people ?? []) {
    if (Number(person.last_tick ?? -1) >= tick) continue
    if (person.person_key) {
      await updateNeedsForAction(supabase, person.id, actionFromNamedActivity(person.activity_state), tick)
      namedNeedsAdvanced += 1
      continue
    }
    const decision = await decideBackgroundPerson(supabase, person, tick)
    await supabase.from('people').update({ activity_state: activityForAction(decision.action), last_action: decision.action, last_decision_factors: { ...decision.factors, score: decision.score }, last_tick: tick, updated_at: new Date().toISOString() }).eq('id', person.id)
    await updateNeedsForAction(supabase, person.id, decision.action, tick)
    await supabase.from('population_events').insert({ tick, event_type: `npc_${decision.action}`, actor_person_id: person.id, location_id: person.current_location_id, subject_type: typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef ? 'problem' : null, subject_ref: typeof decision.factors.subjectRef === 'string' && decision.factors.subjectRef ? decision.factors.subjectRef : null, payload: { action: decision.action, score: decision.score, factors: decision.factors } })
    processed += 1
  }
  return { processed, namedNeedsAdvanced, skipped: false }
}
