type SupabaseLike = any

export type PersonActionRequestInput =
  | { kind: 'tool'; personId: string; toolType: string; purpose: string; sourceActionCode?: string | null; sourceRef?: string | null }
  | { kind: 'resource'; personId: string; resource: 'credits' | 'energy' | 'time'; amount: number; purpose: string; sourceActionCode?: string | null; sourceRef?: string | null }
  | { kind: 'capability'; personId: string; capability: string; minLevel: number; purpose: string; sourceActionCode?: string | null; sourceRef?: string | null }

export type PersonActionRequestResult =
  | { ok: true; requestId: string; status: 'open' | 'matched'; matchedSubjectType?: string | null; matchedSubjectRef?: string | null }
  | { ok: false; reason: 'person_not_found' | 'person_not_active' | 'invalid_amount' | 'invalid_level' }

async function existingOpenRequest(supabase: SupabaseLike, personId: string, kind: string, subjectCode: string) {
  const { data, error } = await supabase
    .from('person_action_requests')
    .select('id, status, matched_subject_type, matched_subject_ref')
    .eq('person_id', personId)
    .eq('request_kind', kind)
    .eq('subject_code', subjectCode)
    .in('status', ['open', 'matched'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

async function matchExistingTool(supabase: SupabaseLike, locationId: string, toolType: string) {
  const { data, error } = await supabase
    .from('equipment_items')
    .select('id')
    .eq('location_id', locationId)
    .eq('equipment_key', toolType)
    .eq('status', 'stored')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  return data?.[0]?.id ?? null
}

/**
 * Persists a real NPC-originated request.
 *
 * Matching a stored tool is only discovery of a candidate; ownership/reservation
 * is intentionally not changed here. Economy/inventory remains authoritative.
 */
export async function createPersonActionRequest(
  supabase: SupabaseLike,
  input: PersonActionRequestInput,
  tick: number,
): Promise<PersonActionRequestResult> {
  if (input.kind === 'resource' && (!Number.isFinite(input.amount) || input.amount <= 0)) {
    return { ok: false, reason: 'invalid_amount' }
  }
  if (input.kind === 'capability' && (!Number.isFinite(input.minLevel) || input.minLevel < 0 || input.minLevel > 1)) {
    return { ok: false, reason: 'invalid_level' }
  }

  const { data: person, error: personError } = await supabase
    .from('people')
    .select('id, current_location_id, simulation_tier')
    .eq('id', input.personId)
    .maybeSingle()
  if (personError) throw personError
  if (!person) return { ok: false, reason: 'person_not_found' }
  if (person.simulation_tier !== 'active') return { ok: false, reason: 'person_not_active' }

  const subjectCode = input.kind === 'tool' ? input.toolType : input.kind === 'resource' ? input.resource : input.capability
  const existing = await existingOpenRequest(supabase, input.personId, input.kind, subjectCode)
  if (existing) {
    return {
      ok: true,
      requestId: existing.id,
      status: existing.status,
      matchedSubjectType: existing.matched_subject_type ?? null,
      matchedSubjectRef: existing.matched_subject_ref ?? null,
    }
  }

  let matchedSubjectType: string | null = null
  let matchedSubjectRef: string | null = null
  let status: 'open' | 'matched' = 'open'

  if (input.kind === 'tool') {
    const equipmentId = await matchExistingTool(supabase, person.current_location_id, input.toolType)
    if (equipmentId) {
      matchedSubjectType = 'equipment_item'
      matchedSubjectRef = equipmentId
      status = 'matched'
    }
  }

  const { data: request, error } = await supabase.from('person_action_requests').insert({
    person_id: input.personId,
    location_id: person.current_location_id,
    request_kind: input.kind,
    subject_code: subjectCode,
    amount: input.kind === 'resource' ? input.amount : null,
    min_level: input.kind === 'capability' ? input.minLevel : null,
    purpose: input.purpose,
    status,
    source_action_code: input.sourceActionCode ?? null,
    source_ref: input.sourceRef ?? null,
    matched_subject_type: matchedSubjectType,
    matched_subject_ref: matchedSubjectRef,
    created_tick: tick,
    metadata: {
      settlementRequired: true,
      candidateMatchOnly: status === 'matched',
    },
  }).select('id').single()
  if (error) throw error

  const { error: eventError } = await supabase.from('population_events').insert({
    tick,
    event_type: 'npc_action_request_created',
    actor_person_id: input.personId,
    location_id: person.current_location_id,
    subject_type: input.kind,
    subject_ref: subjectCode,
    payload: {
      requestId: request.id,
      requestKind: input.kind,
      amount: input.kind === 'resource' ? input.amount : null,
      minLevel: input.kind === 'capability' ? input.minLevel : null,
      purpose: input.purpose,
      status,
      matchedSubjectType,
      matchedSubjectRef,
    },
  })
  if (eventError) throw eventError

  return { ok: true, requestId: request.id, status, matchedSubjectType, matchedSubjectRef }
}
