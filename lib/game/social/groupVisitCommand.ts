/**
 * #551 - Prepare, never execute, an atomic visit admission request for the
 * authoritative Core writer. Uses existing population vocabulary:
 * person_assignments (temporary) and people.activity_state (socialising).
 *
 * A server-side transaction must recheck arrival evidence, invitation consent,
 * permissions, capacity and concurrency before committing any of these fields.
 * Do not write these proposed rows sequentially from this module.
 */
import { assessGroupVenueAdmission, type PopulationPresenceEvidence } from './groupVenueAdmission'
import type { GroupVisit } from './groupVisits'

export type GroupAdmissionCommand = Readonly<{
  dedupeKey: string
  visitId: string
  venueTileEntityId: string
  locationId: string
  tick: number
  endsTick: number
  personIds: readonly string[]
  assignmentType: 'temporary'
  roleCode: string
  activityState: 'socialising'
  authoritativeCommitRequired: true
}>
export type PreparedAdmission = Readonly<{
  command: GroupAdmissionCommand | null
  reason: string
}>

/** Produces data for one all-or-nothing Core operation, never table writes. */
export function prepareGroupAdmission(input: {
  visit: GroupVisit
  locationId: string
  tick: number
  endsTick: number
  people: readonly PopulationPresenceEvidence[]
  verifiedInvitationIds: readonly string[]
  availableVisitorSlots: number
  venueAccessible: boolean
  venueOpen: boolean
}): PreparedAdmission {
  if (!Number.isInteger(input.tick) || !Number.isInteger(input.endsTick)
      || input.endsTick <= input.tick || !input.locationId.trim()
      || !input.visit.venueId.trim() || !input.visit.id.trim())
    return { command: null, reason: 'invalid_visit_window' }
  const verdict = assessGroupVenueAdmission({
    visit: input.visit,
    venueLocationId: input.locationId,
    people: input.people,
    verifiedInvitationIds: input.verifiedInvitationIds,
    availableVisitorSlots: input.availableVisitorSlots,
    venueAccessible: input.venueAccessible,
    venueOpen: input.venueOpen,
  })
  if (!verdict.admitted) return { command: null, reason: verdict.reason }
  // Stable deduplication scope: venue + visit (not repeated on tick retries).
  const command: GroupAdmissionCommand = {
    dedupeKey: 'group_visit:' + input.visit.id + ':' + input.visit.venueId,
    visitId: input.visit.id,
    venueTileEntityId: input.visit.venueId,
    locationId: input.locationId,
    tick: input.tick,
    endsTick: input.endsTick,
    personIds: [...verdict.members].sort(),
    assignmentType: 'temporary',
    roleCode: 'visit:social_group',
    activityState: 'socialising',
    authoritativeCommitRequired: true,
  }
  return { command, reason: 'pending_atomic_core_commit' }
}
