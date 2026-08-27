// lib/game/population/engine.ts
// NOXIA-LIVING-0001 — deterministischer v0.1 Population-Tick

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
  return 0
}

export async function runPopulationTick(supabase: SupabaseLike, tick: number) {
  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, activity_state, last_tick')
    .eq('simulation_tier', 'active')
    .order('id')
    .limit(50)

  if (peopleError) {
    // Migration may not yet be applied on a deployment. Do not break world heartbeat.
    if (String(peopleError.message ?? '').toLowerCase().includes('people')) return { processed: 0, skipped: true }
    throw peopleError
  }

  let processed = 0
  for (const person of people ?? []) {
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

    const { data: needs } = await supabase
      .from('person_needs')
      .select('need_code, satisfaction')
      .eq('person_id', person.id)

    for (const need of needs ?? []) {
      const current = Number(need.satisfaction ?? 1)
      const next = Math.max(0, Math.min(1, current + needDelta(decision.action, need.need_code)))
      await supabase
        .from('person_needs')
        .update({ satisfaction: next, updated_tick: tick, updated_at: new Date().toISOString() })
        .eq('person_id', person.id)
        .eq('need_code', need.need_code)
    }

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

  return { processed, skipped: false }
}
