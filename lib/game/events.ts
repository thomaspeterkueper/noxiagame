// lib/game/events.ts
// Erstellt: 31.08.2026 — generalisierter NOXIA-Eventstrom + temporale Zustände

import { createServiceClient } from '@/lib/supabase/service'

export type SimulationEffect = {
  type: string
  resource?: string
  amount?: number
  field?: string
  from?: unknown
  to?: unknown
  [key: string]: unknown
}

export type SimulationEventInput = {
  eventType: string
  subjectType: string
  subjectId?: string | null
  actorId?: string | null
  locationId?: string | null
  tick?: number | null
  effects?: SimulationEffect[]
  metadata?: Record<string, unknown>
  occurredAt?: string
}

export async function recordSimulationEvent(input: SimulationEventInput) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('simulation_events')
    .insert({
      event_type: input.eventType,
      subject_type: input.subjectType,
      subject_id: input.subjectId ?? null,
      actor_id: input.actorId ?? null,
      location_id: input.locationId ?? null,
      tick: input.tick ?? null,
      effects: input.effects ?? [],
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select('id, effect_group_id, occurred_at')
    .single()

  if (error) throw error
  return data
}

export async function replaceEntityState(input: {
  subjectType: string
  subjectId: string
  properties: Record<string, unknown>
  sourceEventId?: string | null
  validFrom?: string
}) {
  const supabase = createServiceClient()
  const validFrom = input.validFrom ?? new Date().toISOString()

  const { error: closeError } = await supabase
    .from('entity_states')
    .update({ valid_to: validFrom })
    .eq('subject_type', input.subjectType)
    .eq('subject_id', input.subjectId)
    .is('valid_to', null)

  if (closeError) throw closeError

  const { data, error } = await supabase
    .from('entity_states')
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      valid_from: validFrom,
      properties: input.properties,
      source_event: input.sourceEventId ?? null,
    })
    .select('id, valid_from')
    .single()

  if (error) throw error
  return data
}

/**
 * Convenience boundary for changes that both happen and become state.
 * The event is written first; the resulting state references it.
 */
export async function recordEventAndState(
  event: SimulationEventInput & { subjectId: string },
  properties: Record<string, unknown>,
) {
  const occurredAt = event.occurredAt ?? new Date().toISOString()
  const recorded = await recordSimulationEvent({ ...event, occurredAt })
  const state = await replaceEntityState({
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    properties,
    sourceEventId: recorded.id,
    validFrom: occurredAt,
  })
  return { event: recorded, state }
}
