/**
 * #551 Venue preferences: deterministic, explainable NPC choice.
 * This pure selector never writes world state, creates invitations or moves actors.
 * All scores are normalized 0..1. Availability is authoritative input from the
 * building/access subsystem, not inferred from venue category or names.
 */
export type VisitPurpose = 'socialize' | 'food' | 'music' | 'dance' | 'work' | 'rest' | 'learn'
export interface VenueOption {
  id: string
  purposes: readonly VisitPurpose[]
  accessible: boolean
  open: boolean
  visitorCapacityAvailable: boolean
  routeReachable: boolean
  travelCost: number // normalized 0..1; lower is better
}
export interface NpcPreference {
  npcId: string
  interests: Partial<Record<VisitPurpose, number>>
  needs: Partial<Record<VisitPurpose, number>>
  autonomy: number // 0..1: preference for own needs over group consensus
}
export interface VenueChoice {
  venueId: string
  score: number
  reasons: readonly string[]
}
const bounded = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
const weight = (p: NpcPreference, purpose: VisitPurpose) =>
  0.55 * bounded(p.needs[purpose] ?? 0) + 0.45 * bounded(p.interests[purpose] ?? 0)

/**
 * Does not force a venue: null represents no attractive/available activity.
 * Does not infer consent: group membership must be negotiated separately.
 * Ties break by canonical venue id to avoid random tick oscillation.
 */
export function chooseGroupVenue(
  members: readonly NpcPreference[],
  venues: readonly VenueOption[],
  minimumDesirability = 0.18,
): VenueChoice | null {
  if (members.length === 0 || members.some(m => !m.npcId.trim()) ||
    new Set(members.map(m => m.npcId)).size !== members.length) return null
  const candidates: VenueChoice[] = []
  for (const venue of venues) {
    if (!venue.id.trim() || !venue.open || !venue.accessible ||
      !venue.visitorCapacityAvailable || !venue.routeReachable ||
      venue.purposes.length === 0) continue
    const personal = members.map(m => Math.max(...venue.purposes.map(p => weight(m, p))))
    const average = personal.reduce((sum, s) => sum + s, 0) / members.length
    const groupLow = Math.min(...personal)
    const autonomy = members.reduce((sum, m) => sum + bounded(m.autonomy), 0) / members.length
    // Autonomy permits personal priorities, but no one can be forced to participate.
    const desire = (0.65 + 0.2 * autonomy) * average + (0.35 - 0.2 * autonomy) * groupLow
    const score = desire - 0.18 * bounded(venue.travelCost)
    if (score >= bounded(minimumDesirability)) {
      candidates.push({ venueId: venue.id, score: Math.round(score * 10000) / 10000,
        reasons: venue.purposes.map(p => p + ':shared-interest') })
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.venueId.localeCompare(b.venueId))
  return candidates[0] ?? null
}
