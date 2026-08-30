// lib/game/personBrain.ts
// NOXIA-LIVING-0004 — deterministic person decision engine
// Parent: #20
// Simulation truth is deterministic and auditable. No random or LLM decisions.

export type PersonActivity = 'idle' | 'travelling' | 'working' | 'resting' | 'socialising' | 'inspecting'
export interface PersonNeedState { sustenance?: number; rest?: number; safety?: number; social?: number; purpose?: number }
export interface PersonSkillState { [skillCode: string]: number | undefined }
export interface ColonyPressure { code: 'water' | 'energy' | 'medical' | 'maintenance' | 'habitat' | string; severity: number; subjectRef?: string; reason?: string }
export interface PersonDecisionContext {
  person: { id: string; personKey?: string | null; publicRole?: string | null; roleCode?: string | null; traits?: Record<string, unknown> | null; currentActivity: PersonActivity }
  needs: PersonNeedState
  skills: PersonSkillState
  pressures: ColonyPressure[]
  tick: number
}
export interface PersonDecision { activity: PersonActivity; actionCode: string; subjectType?: string; subjectRef?: string; priority: number; factors: Record<string, unknown>; reason: string }

function clamp01(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0, Math.min(1, value))
}
function skill(skills: PersonSkillState, ...codes: string[]): number { return Math.max(0, ...codes.map((code) => clamp01(skills[code]))) }
function strongestPressure(pressures: ColonyPressure[], codes: string[]): ColonyPressure | undefined {
  return pressures.filter((p) => codes.includes(p.code)).slice().sort((a, b) => (clamp01(b.severity) - clamp01(a.severity)) || a.code.localeCompare(b.code))[0]
}

export function decidePerson(context: PersonDecisionContext): PersonDecision {
  const { person, needs, skills, pressures, tick } = context
  const role = person.roleCode ?? ''
  const rest = clamp01(needs.rest, 1)
  const sustenance = clamp01(needs.sustenance, 1)
  const safety = clamp01(needs.safety, 1)
  if (rest < 0.25) return { activity: 'resting', actionCode: 'recover_rest', priority: 0.95, factors: { rest, tick }, reason: `Rest need critical (${rest.toFixed(2)})` }
  if (sustenance < 0.25) return { activity: 'idle', actionCode: 'restore_sustenance', priority: 0.94, factors: { sustenance, tick }, reason: `Sustenance need critical (${sustenance.toFixed(2)})` }

  if (role === 'medical_center_lead') {
    const p = strongestPressure(pressures, ['medical', 'water'])
    const competence = skill(skills, 'medicine', 'emergency_medicine', 'triage', 'colony_health', 'systems_risk_assessment')
    if (p && p.severity >= 0.35 && competence >= 0.55) return { activity: 'inspecting', actionCode: p.code === 'water' ? 'assess_water_health_risk' : 'assess_medical_capacity', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.55 + p.severity * 0.4), factors: { pressure: p, competence, safety, tick }, reason: `${person.personKey ?? person.id} prioritizes ${p.code} pressure (${p.severity.toFixed(2)}) as a colony-health risk` }
  }
  if (role === 'water_life_support_lead') {
    const p = strongestPressure(pressures, ['water', 'maintenance', 'energy'])
    const competence = skill(skills, 'water_systems', 'life_support', 'maintenance', 'systems_diagnostics')
    if (p && p.severity >= 0.30 && competence >= 0.50) return { activity: 'inspecting', actionCode: 'inspect_life_support_pressure', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.50 + p.severity * 0.45), factors: { pressure: p, competence, tick }, reason: `Life-support role responds to ${p.code} pressure (${p.severity.toFixed(2)})` }
  }
  if (role === 'fabrication_center_lead') {
    const p = strongestPressure(pressures, ['maintenance'])
    const competence = skill(skills, 'fabrication', 'additive_manufacturing', 'repair', 'materials')
    if (p && p.severity >= 0.35 && competence >= 0.50) return { activity: 'working', actionCode: 'prioritize_repair_fabrication', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.50 + p.severity * 0.4), factors: { pressure: p, competence, tick }, reason: `Fabrication capacity is redirected to maintenance pressure (${p.severity.toFixed(2)})` }
  }
  if (role === 'geology_lab_lead') {
    const p = strongestPressure(pressures, ['water'])
    const competence = skill(skills, 'geology', 'mineralogy', 'sample_analysis', 'spectroscopy')
    if (p && p.severity >= 0.55 && competence >= 0.55) return { activity: 'working', actionCode: 'prioritize_resource_analysis', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.45 + p.severity * 0.4), factors: { pressure: p, competence, tick }, reason: `Geology/lab role supports source investigation under water pressure (${p.severity.toFixed(2)})` }
  }
  if (role === 'rover_operations_lead') {
    const p = strongestPressure(pressures, ['water', 'maintenance'])
    const competence = skill(skills, 'rover_operations', 'field_operations', 'navigation', 'maintenance')
    if (p && p.severity >= 0.55 && competence >= 0.50) return { activity: 'working', actionCode: 'prepare_field_support', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.45 + p.severity * 0.4), factors: { pressure: p, competence, tick }, reason: `Rover operations prepares field support for ${p.code} pressure (${p.severity.toFixed(2)})` }
  }
  if (role === 'infrastructure_coordinator') {
    const p = pressures.slice().sort((a, b) => clamp01(b.severity) - clamp01(a.severity))[0]
    const competence = skill(skills, 'infrastructure_coordination', 'logistics', 'planning', 'systems_risk_assessment')
    if (p && p.severity >= 0.35 && competence >= 0.50) return { activity: 'working', actionCode: 'coordinate_colony_response', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.50 + p.severity * 0.4), factors: { pressure: p, competence, tick }, reason: `Infrastructure coordination responds to strongest colony pressure: ${p.code} (${p.severity.toFixed(2)})` }
  }
  if (role === 'helioscorp_liaison') {
    const p = strongestPressure(pressures, ['water', 'energy', 'maintenance'])
    const competence = skill(skills, 'contracts', 'trade', 'negotiation', 'logistics')
    if (p && p.severity >= 0.60 && competence >= 0.50) return { activity: 'working', actionCode: 'evaluate_external_supply_contract', subjectType: 'pressure', subjectRef: p.subjectRef ?? p.code, priority: clamp01(0.40 + p.severity * 0.4), factors: { pressure: p, competence, tick }, reason: `External supply option becomes relevant under ${p.code} pressure (${p.severity.toFixed(2)})` }
  }
  const social = clamp01(needs.social, 1)
  if (social < 0.30) return { activity: 'socialising', actionCode: 'seek_social_contact', priority: 0.45, factors: { social, tick }, reason: `Social need low (${social.toFixed(2)})` }
  return { activity: 'working', actionCode: 'perform_assigned_work', priority: 0.30, factors: { roleCode: role || null, tick }, reason: 'No higher-priority pressure or need; continue assigned work' }
}

export interface PersonTickResult { processed: number; decisions: number; events: number; errors: string[] }
export async function runPersonTick(supabase: any, tick: number, pressuresByLocation: Map<string, ColonyPressure[]> = new Map()): Promise<PersonTickResult> {
  const result: PersonTickResult = { processed: 0, decisions: 0, events: 0, errors: [] }
  const { data: people, error } = await supabase.from('people').select('id, person_key, public_role, traits, current_location_id, simulation_tier, activity_state, last_action, last_tick').eq('simulation_tier', 'active')
  if (error) return { ...result, errors: [`people load: ${error.message ?? error}`] }
  for (const person of people ?? []) {
    try {
      const [{ data: needsRows }, { data: skillsRows }, { data: work }] = await Promise.all([
        supabase.from('person_needs').select('need_code, satisfaction').eq('person_id', person.id),
        supabase.from('person_skills').select('skill_code, level').eq('person_id', person.id),
        supabase.from('person_assignments').select('role_code').eq('person_id', person.id).eq('assignment_type', 'work').eq('is_active', true).maybeSingle(),
      ])
      const needs: PersonNeedState = {}
      for (const n of needsRows ?? []) (needs as any)[n.need_code] = Number(n.satisfaction)
      const skills: PersonSkillState = {}
      for (const s of skillsRows ?? []) skills[s.skill_code] = Number(s.level)
      const decision = decidePerson({ person: { id: person.id, personKey: person.person_key, publicRole: person.public_role, roleCode: work?.role_code ?? null, traits: person.traits ?? {}, currentActivity: person.activity_state as PersonActivity }, needs, skills, pressures: pressuresByLocation.get(person.current_location_id) ?? [], tick })
      await supabase.from('people').update({ activity_state: decision.activity, last_action: decision.actionCode, last_decision_factors: decision.factors, last_tick: tick, updated_at: new Date().toISOString() }).eq('id', person.id)
      result.decisions++
      const meaningful = person.last_action !== decision.actionCode || Boolean(decision.subjectRef)
      if (meaningful) {
        const { error: eventError } = await supabase.from('population_events').insert({ tick, event_type: 'person_decision', actor_person_id: person.id, location_id: person.current_location_id, subject_type: decision.subjectType ?? 'routine', subject_ref: decision.subjectRef ?? decision.actionCode, payload: { action_code: decision.actionCode, activity: decision.activity, priority: decision.priority, reason: decision.reason, factors: decision.factors } })
        if (!eventError) result.events++
        else result.errors.push(`event ${person.person_key ?? person.id}: ${eventError.message ?? eventError}`)
      }
      result.processed++
    } catch (err: any) { result.errors.push(`${person.person_key ?? person.id}: ${err?.message ?? String(err)}`) }
  }
  return result
}
