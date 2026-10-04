import { startLocalVisit, type LocalVisitResult } from './localVisit'

type SupabaseLike = any

export type SocialVisitResult =
  | { ok: true; targetPersonId: string; destinationTileEntityId: string; visit: LocalVisitResult }
  | { ok: false; reason: 'person_not_found' | 'target_not_found' | 'target_not_local' | 'target_has_no_resolved_presence' | 'visit_failed' }

function preferredPresence(assignments: any[]) {
  const active = assignments.filter(row => row.is_active && row.tile_entity_id)
  const order = new Map([['temporary', 0], ['work', 1], ['home', 2]])
  return active.slice().sort((a, b) =>
    (order.get(a.assignment_type) ?? 99) - (order.get(b.assignment_type) ?? 99)
    || String(a.id).localeCompare(String(b.id)),
  )[0] ?? null
}

/**
 * Authoritative local social visit.
 *
 * It never teleports across locations. The target must currently be in the same
 * location and must have a resolved tile presence through an active assignment.
 */
export async function startSocialVisit(
  supabase: SupabaseLike,
  personId: string,
  targetPersonId: string,
  tick: number,
): Promise<SocialVisitResult> {
  if (personId === targetPersonId) return { ok: false, reason: 'target_not_found' }

  const [{ data: person, error: personError }, { data: target, error: targetError }] = await Promise.all([
    supabase.from('people').select('id, current_location_id, simulation_tier').eq('id', personId).maybeSingle(),
    supabase.from('people').select('id, current_location_id, simulation_tier').eq('id', targetPersonId).maybeSingle(),
  ])
  if (personError) throw personError
  if (targetError) throw targetError
  if (!person) return { ok: false, reason: 'person_not_found' }
  if (!target) return { ok: false, reason: 'target_not_found' }
  if (person.current_location_id !== target.current_location_id) return { ok: false, reason: 'target_not_local' }

  const { data: assignments, error: assignmentError } = await supabase
    .from('person_assignments')
    .select('id, assignment_type, tile_entity_id, is_active')
    .eq('person_id', targetPersonId)
    .eq('is_active', true)
  if (assignmentError) throw assignmentError

  const targetPresence = preferredPresence(assignments ?? [])
  if (!targetPresence?.tile_entity_id) return { ok: false, reason: 'target_has_no_resolved_presence' }

  const visit = await startLocalVisit(supabase, {
    personId,
    locationId: person.current_location_id,
    destinationTileEntityId: targetPresence.tile_entity_id,
    reason: 'social',
    subjectRef: targetPersonId,
  }, tick)

  if (!visit.ok) return { ok: false, reason: 'visit_failed' }

  const { error: eventError } = await supabase.from('population_events').insert({
    tick,
    event_type: 'npc_social_visit_started',
    actor_person_id: personId,
    related_person_id: targetPersonId,
    location_id: person.current_location_id,
    subject_type: 'person',
    subject_ref: targetPersonId,
    payload: {
      destinationTileEntityId: targetPresence.tile_entity_id,
      visitAssignmentId: visit.assignmentId ?? null,
    },
  })
  if (eventError) throw eventError

  return {
    ok: true,
    targetPersonId,
    destinationTileEntityId: targetPresence.tile_entity_id,
    visit,
  }
}
