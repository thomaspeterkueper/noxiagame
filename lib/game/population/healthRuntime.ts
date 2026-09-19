import { projectHealthEffect, type HealthAffectingEvent } from './healthEffects'
import type { PersonHealthState } from './health'

type SupabaseLike = any

export async function applyHealthAffectingEvent(
  supabase: SupabaseLike,
  input: {
    personId: string
    locationId: string
    tick: number
    event: HealthAffectingEvent
    sourceSubjectType?: string | null
    sourceSubjectRef?: string | null
  },
): Promise<PersonHealthState> {
  const { data: existing, error: healthError } = await supabase.from('person_health')
    .select('*').eq('person_id', input.personId).maybeSingle()
  if (healthError) throw healthError

  const current: PersonHealthState = existing ? {
    personId: existing.person_id,
    wellbeing: Number(existing.wellbeing),
    conditionCode: existing.condition_code ?? null,
    severity: Number(existing.severity),
    requiresMedicalCare: Boolean(existing.requires_medical_care),
    updatedTick: existing.updated_tick ?? null,
  } : {
    personId: input.personId,
    wellbeing: 1,
    conditionCode: null,
    severity: 0,
    requiresMedicalCare: false,
    updatedTick: null,
  }

  const next = projectHealthEffect(current, input.event, input.tick)
  const { data: sourceEvent, error: eventError } = await supabase.from('population_events').insert({
    tick: input.tick,
    event_type: input.event.eventType,
    actor_person_id: input.personId,
    location_id: input.locationId,
    subject_type: input.sourceSubjectType ?? null,
    subject_ref: input.sourceSubjectRef ?? null,
    payload: { severity: input.event.severity, healthEffect: { conditionCode: next.conditionCode, severity: next.severity } },
  }).select('id').single()
  if (eventError) throw eventError

  const { error: upsertError } = await supabase.from('person_health').upsert({
    person_id: input.personId,
    wellbeing: next.wellbeing,
    condition_code: next.conditionCode,
    severity: next.severity,
    requires_medical_care: next.requiresMedicalCare,
    source_event_id: sourceEvent.id,
    updated_tick: input.tick,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'person_id' })
  if (upsertError) throw upsertError

  return next
}
