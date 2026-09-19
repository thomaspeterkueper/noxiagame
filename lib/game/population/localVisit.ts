// NOXIA-LIVING — deterministic local visits without teleporting or fake co-location.
//
// A visit is represented by an explicit temporary assignment. Presence resolution
// already understands temporary assignments, so encounters remain derived from
// canonical persisted state rather than being emitted by this module.

export interface LocalVisitRequest {
  personId: string
  locationId: string
  destinationTileEntityId: string
  reason: 'medical_care' | 'social' | 'service' | 'inspection'
  subjectRef?: string | null
}

export interface LocalVisitResult {
  ok: boolean
  assignmentId?: string
  reason?: 'person_not_active' | 'destination_not_found' | 'destination_location_mismatch'
}

type SupabaseLike = any

export async function startLocalVisit(
  supabase: SupabaseLike,
  request: LocalVisitRequest,
  tick: number,
): Promise<LocalVisitResult> {
  const [{ data: person, error: personError }, { data: destination, error: destinationError }] = await Promise.all([
    supabase.from('people').select('id, current_location_id, simulation_tier').eq('id', request.personId).maybeSingle(),
    supabase.from('tile_entities').select('id, location_id, status').eq('id', request.destinationTileEntityId).maybeSingle(),
  ])
  if (personError) throw personError
  if (destinationError) throw destinationError
  if (!person || person.simulation_tier !== 'active') return { ok: false, reason: 'person_not_active' }
  if (!destination || destination.status !== 'active') return { ok: false, reason: 'destination_not_found' }
  if (person.current_location_id !== request.locationId || destination.location_id !== request.locationId) {
    return { ok: false, reason: 'destination_location_mismatch' }
  }

  // One active temporary destination per person. Repeating the same request is idempotent.
  const { data: existing, error: existingError } = await supabase
    .from('person_assignments')
    .select('id, tile_entity_id')
    .eq('person_id', request.personId)
    .eq('assignment_type', 'temporary')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
  if (existingError) throw existingError
  if (existing?.[0]?.tile_entity_id === request.destinationTileEntityId) {
    return { ok: true, assignmentId: existing[0].id }
  }
  if (existing?.length) {
    const { error } = await supabase.from('person_assignments').update({
      is_active: false,
      ends_tick: tick,
      updated_at: new Date().toISOString(),
    }).eq('id', existing[0].id)
    if (error) throw error
  }

  const { data: assignment, error: assignmentError } = await supabase.from('person_assignments').insert({
    person_id: request.personId,
    assignment_type: 'temporary',
    location_id: request.locationId,
    tile_entity_id: request.destinationTileEntityId,
    role_code: `visit:${request.reason}`,
    starts_tick: tick,
    is_active: true,
  }).select('id').single()
  if (assignmentError) throw assignmentError

  const { error: personUpdateError } = await supabase.from('people').update({
    activity_state: 'socialising',
    last_action: `visit:${request.reason}`,
    last_decision_factors: {
      reason: request.reason,
      destinationTileEntityId: request.destinationTileEntityId,
      subjectRef: request.subjectRef ?? null,
    },
    last_tick: tick,
    updated_at: new Date().toISOString(),
  }).eq('id', request.personId)
  if (personUpdateError) throw personUpdateError

  const { error: eventError } = await supabase.from('population_events').insert({
    tick,
    event_type: 'npc_local_visit_started',
    actor_person_id: request.personId,
    location_id: request.locationId,
    subject_type: 'tile_entity',
    subject_ref: request.destinationTileEntityId,
    payload: {
      reason: request.reason,
      assignmentId: assignment.id,
      subjectRef: request.subjectRef ?? null,
    },
  })
  if (eventError) throw eventError

  return { ok: true, assignmentId: assignment.id }
}

export async function endLocalVisit(
  supabase: SupabaseLike,
  personId: string,
  tick: number,
): Promise<boolean> {
  const { data: visits, error } = await supabase.from('person_assignments')
    .select('id')
    .eq('person_id', personId)
    .eq('assignment_type', 'temporary')
    .eq('is_active', true)
  if (error) throw error
  if (!visits?.length) return false

  const ids = visits.map((visit: any) => visit.id)
  const { error: updateError } = await supabase.from('person_assignments').update({
    is_active: false,
    ends_tick: tick,
    updated_at: new Date().toISOString(),
  }).in('id', ids)
  if (updateError) throw updateError
  return true
}
