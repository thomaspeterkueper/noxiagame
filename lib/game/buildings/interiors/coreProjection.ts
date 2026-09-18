import type { InteriorHostRef, InteriorPresenceProjection, RoomId } from './types'

export type CorePersonAssignmentType = 'home' | 'work' | 'temporary'

/**
 * Minimal read-only projection of the authoritative Core `person_assignments`
 * relation. This adapter deliberately does not own assignment lifecycle,
 * location, time, occupancy or person state.
 */
export interface CorePersonAssignmentRecord {
  personId: string
  tileEntityId: string
  assignmentType: CorePersonAssignmentType
  employerActorId?: string | null
  roleCode?: string | null
}

export interface InteriorHostAssignmentProjection {
  personId: string
  host: InteriorHostRef
  assignmentType: CorePersonAssignmentType
  employerActorId?: string | null
  roleCode?: string | null
  source: 'core.person_assignments'
}

/**
 * Projects durable Core building assignments into an interior host view.
 * A building assignment is NOT proof of current room presence.
 */
export function projectCoreAssignmentsToInteriorHost(
  host: InteriorHostRef,
  assignments: readonly CorePersonAssignmentRecord[],
): InteriorHostAssignmentProjection[] {
  if (host.kind !== 'building') return []

  return assignments
    .filter(assignment => assignment.tileEntityId === host.id)
    .map(assignment => ({
      personId: assignment.personId,
      host,
      assignmentType: assignment.assignmentType,
      employerActorId: assignment.employerActorId,
      roleCode: assignment.roleCode,
      source: 'core.person_assignments' as const,
    }))
}

export interface ExplicitRoomPresenceRecord {
  personId: string
  host: InteriorHostRef
  roomId: RoomId
  source: InteriorPresenceProjection['source']
}

/**
 * Creates a room-presence projection only from an explicit presence source.
 * It never derives presence from home/work/temporary assignments, timestamps,
 * ownership, broad location, node binding, transit or event chronology.
 */
export function projectExplicitRoomPresence(
  host: InteriorHostRef,
  records: readonly ExplicitRoomPresenceRecord[],
): InteriorPresenceProjection[] {
  return records
    .filter(record => record.host.kind === host.kind && record.host.id === host.id)
    .map(record => ({
      personId: record.personId,
      host,
      roomId: record.roomId,
      source: record.source,
    }))
}

export function countPresenceByRoom(
  presence: readonly InteriorPresenceProjection[],
): Record<RoomId, number> {
  const counts: Record<RoomId, number> = {}
  for (const record of presence) {
    counts[record.roomId] = (counts[record.roomId] ?? 0) + 1
  }
  return counts
}
