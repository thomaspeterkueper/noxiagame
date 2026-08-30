// lib/game/population/engine.ts
// NOXIA-LIVING-0001 — deterministischer v0.1 Population-Tick
//
// Ownership rule:
// - background people: this engine decides routine/action and updates needs/experience
// - named people (person_key != null): personBrain owns decisions; this engine only
//   advances basic needs from their already-persisted activity state.

import type { PersonActivityState, PopulationAction } from './types'

type SupabaseLike = any

export type PopulationTickDecision = {
  action: PopulationAction
  activityState: PersonActivityState
  factors: Record<string, number | string | boolean>
}

export function decidePopulationAction(tick: number, hasWork: boolean): PopulationTickDecision {
  const phase = Math.abs(tick) % 4

  if (!hasWork) {
    return {
      action: 'rest',
      activityState: 'resting',
      factors: { phase, hasWork: false, reason: 'no_active_work_assignment' },
    }
  }

  if (phase === 0) {
    return {
      action: 'travel_work',
      activityState: 'travelling',
      factors: { phase, hasWork: true, destination: 'work' },
    }
  }
  if (phase === 1 || phase === 2) {
    return {
      action: 'work',
      activityState: 'working',
      factors: { phase, hasWork: true, obligation: 1 },
    }
  }
  return {
    action: 'travel_home',
    activityState: 'travelling',
    factors: { phase, hasWork: true, destination: 'home' },
  }
}

function needDelta(action: PopulationAction, needCode: string) {
  if (action === 'work') {
    if (needCode === 'rest') return -0.05
    if (needCode === 'sustenance') return -0.025
    if (needCode === 'purpose') return 0.04
    if (needCode === 'social') return 0.01
    return 0
  }
  if (action === 'rest') {
    if (needCode === 'rest') return 0.12
    if (needCode === 'sustenance') return -0.015
    if (needCode === 'purpose') return -0.01
    return 0
  }
  if (action === 'travel_home' || action === 'travel_work') {
    if (needCode === 'rest') return -0.015
    if (needCode === 'sustenance') return -0.01
  }
  if (action === 'social_interaction') {
    if (needCode === 'social') return 0.12
    if (needCode === 'rest') return -0.01
    if (needCode === 'sustenance') return -0.01
  }
  if (action === 'inspect_problem' || action === 'report_problem') {
    if (needCode === 'rest') return -0.03
    if (needCode === 'sustenance') return -0.015
    if (needCode === 'purpose') return 0.05
  }
  return 0
}

function actionFromNamedActivity(activity: PersonActivityState): PopulationAction {
  switch (activity) {
    case 'working': return 'work'
    case 'resting': return 'rest'
    case 'travelling': return 'travel_work'
    case 'socialising': return 'social_interaction'
    case 'inspecting': return 'inspect_problem'
    case 'idle':
    default: return 'satisfy_basic_need'
  }
}

async function updateNeedsForAction(supabase: SupabaseLike, personId: string, action: PopulationAction, tick: number) {
  const { data: needs } = await supabase
    .from('person_needs')
    .select('need_code, satisfaction')
    .eq('person_id', personId)

  for (const need of needs ?? []) {
    const current = Number(need.satisfaction ?? 1)
    const next = Math.max(0, Math.min(1, current + needDelta(action, need.need_code)))
    await supabase
      .from('person_needs')
      .update({ satisfaction: next, updated_tick: tick, updated_at: new Date().toISOString() })
      .eq('person_id', personId)
      .eq('need_code', need.need_code)
  }
}

export async function runPopulationTick(supabase: SupabaseLike, tick: number) {
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, person_key, activity_state, last_tick')
    .eq('simulation_tier', 'active')
    .order('id')
    .limit(50)

  if (peopleError) {
    // Migration may not yet be applied on a deployment. Do not break world heartbeat.
    if (String(peopleError.message ?? '').toLowerCase().includes('people')) return { processed: 0, namedNeedsAdvanced: 0, skipped: true }
    throw peopleError
  }

  let processed = 0
  let namedNeedsAdvanced = 0
  for (const person of people ?? []) {
    // Named people are decided by personBrain. We still advance their physiological
    // needs so their specialist decisions remain embedded in the same living-world model.
    if (person.person_key) {
      const action = actionFromNamedActivity(person.activity_state as PersonActivityState)
      await updateNeedsForAction(supabase, person.id, action, tick)
      namedNeedsAdvanced += 1
      continue
    }

    if (Number(person.last_tick ?? -1) >= tick) continue

    const { data: work } = await supabase
      .from('person_assignments')
      .select('id, tile_entity_id, role_code')
      .eq('person_id', person.id)
      .eq('assignment_type', 'work')
      .eq('is_active', true)
      .maybeSingle()

    const decision = decidePopulationAction(tick, Boolean(work))

    await supabase
      .from('people')
      .update({
        activity_state: decision.activityState,
        last_action: decision.action,
        last_decision_factors: decision.factors,
        last_tick: tick,
        updated_at: new Date().toISOString(),
      })
      .eq('id', person.id)

    await updateNeedsForAction(supabase, person.id, decision.action, tick)

    if (decision.action === 'work' && work?.role_code) {
      const skillByRole: Record<string, string> = {
        technician: 'maintenance', scientist: 'research', geologist: 'geology',
        operator: 'maintenance', trader: 'logistics', administrator: 'administration',
      }
      const skillCode = skillByRole[work.role_code]
      if (skillCode) {
        const { data: skill } = await supabase
          .from('person_skills')
          .select('level, experience')
          .eq('person_id', person.id)
          .eq('skill_code', skillCode)
          .maybeSingle()
        if (skill) {
          await supabase
            .from('person_skills')
            .update({
              experience: Number(skill.experience ?? 0) + 1,
              level: Math.min(1, Number(skill.level ?? 0) + 0.002),
              updated_tick: tick,
              updated_at: new Date().toISOString(),
            })
            .eq('person_id', person.id)
            .eq('skill_code', skillCode)
        }
      }
    }

    processed += 1
  }

  return { processed, namedNeedsAdvanced, skipped: false }
}
