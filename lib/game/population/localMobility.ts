import { startLocalVisit, type LocalVisitResult } from './localVisit'

type SupabaseLike = any

export type PersonalLocalVisitResult =
  | { ok: true; visit: LocalVisitResult; destinationTileEntityId: string }
  | { ok: false; reason: 'person_not_found' | 'destination_not_found' | 'destination_location_mismatch' | 'visit_failed' }

/**
 * Executes a deliberate same-location personal movement.
 *
 * Destination selection belongs to decision/planning. This function only validates
 * the chosen physical destination and persists the temporary presence.
 */
export async function startPersonalLocalVisit(
  supabase: SupabaseLike,
  personId: string,
  destinationTileEntityId: string,
  tick: number,
  subjectRef?: string | null,
): Promise<PersonalLocalVisitResult> {
  const [{ data: person, error: personError }, { data: destination, error: destinationError }] = await Promise.all([
    supabase.from('people').select('id, current_location_id').eq('id', personId).maybeSingle(),
    supabase.from('tile_entities').select('id, location_id, status').eq('id', destinationTileEntityId).maybeSingle(),
  ])
  if (personError) throw personError
  if (destinationError) throw destinationError
  if (!person) return { ok: false, reason: 'person_not_found' }
  if (!destination || destination.status !== 'active') return { ok: false, reason: 'destination_not_found' }
  if (person.current_location_id !== destination.location_id) {
    return { ok: false, reason: 'destination_location_mismatch' }
  }

  const visit = await startLocalVisit(supabase, {
    personId,
    locationId: person.current_location_id,
    destinationTileEntityId,
    reason: 'personal',
    subjectRef: subjectRef ?? null,
  }, tick)
  if (!visit.ok) return { ok: false, reason: 'visit_failed' }

  return { ok: true, visit, destinationTileEntityId }
}
