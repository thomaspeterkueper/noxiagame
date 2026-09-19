import { startLocalVisit, type LocalVisitResult } from './localVisit'
import { decideMedicalCare, type PersonHealthState } from './health'

type SupabaseLike = any

export type MedicalCareResult =
  | { needed: false }
  | { needed: true; decisionScore: number; visit: LocalVisitResult }

/**
 * Resolves a real medical-care need to the canonical Medical Center in the
 * person's current location, then delegates presence mutation to LocalVisit.
 */
export async function seekMedicalCare(
  supabase: SupabaseLike,
  health: PersonHealthState,
  locationId: string,
  tick: number,
): Promise<MedicalCareResult> {
  const decision = decideMedicalCare(health)
  if (!decision) return { needed: false }

  const { data: centers, error } = await supabase.from('tile_entities')
    .select('id')
    .eq('location_id', locationId)
    .eq('entity_type', 'building')
    .eq('entity_id', 'medical_core')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  if (!centers?.length) {
    return { needed: true, decisionScore: decision.score, visit: { ok: false, reason: 'destination_not_found' } }
  }

  const visit = await startLocalVisit(supabase, {
    personId: health.personId,
    locationId,
    destinationTileEntityId: centers[0].id,
    reason: 'medical_care',
    subjectRef: health.conditionCode,
  }, tick)
  return { needed: true, decisionScore: decision.score, visit }
}
