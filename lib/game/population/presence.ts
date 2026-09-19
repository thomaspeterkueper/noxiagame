import type { Person, PersonAssignment } from './types'
import type { EncounterCandidate } from './encounters'

function activeAtLocation(person: Person, assignment: PersonAssignment): boolean {
  return assignment.isActive && assignment.locationId === person.currentLocationId && Boolean(assignment.tileEntityId)
}

function assignmentPriority(person: Person, assignment: PersonAssignment): number {
  if (person.activityState === 'travelling') return -1
  if (person.activityState === 'working' || person.activityState === 'inspecting') {
    if (assignment.assignmentType === 'work') return 30
    if (assignment.assignmentType === 'temporary') return 20
    if (assignment.assignmentType === 'home') return 10
  }
  if (person.activityState === 'resting') {
    if (assignment.assignmentType === 'home') return 30
    if (assignment.assignmentType === 'temporary') return 20
    if (assignment.assignmentType === 'work') return 10
  }
  if (person.activityState === 'socialising') {
    if (assignment.assignmentType === 'temporary') return 30
    if (assignment.assignmentType === 'work') return 20
    if (assignment.assignmentType === 'home') return 10
  }
  if (person.activityState === 'idle') {
    // Idle does not imply presence at home or work. Only an explicit temporary
    // assignment is precise enough to use as local co-location evidence.
    if (assignment.assignmentType === 'temporary') return 30
    return -1
  }
  return 0
}

export function resolvedPresenceCandidate(
  person: Person,
  assignments: readonly PersonAssignment[],
): EncounterCandidate | null {
  if (person.activityState === 'travelling') return null

  const resolved = assignments
    .filter(assignment => activeAtLocation(person, assignment))
    .map(assignment => ({ assignment, priority: assignmentPriority(person, assignment) }))
    .filter(item => item.priority >= 0)
    .sort((a, b) => (b.priority - a.priority) || a.assignment.id.localeCompare(b.assignment.id))

  const tileEntityId = resolved[0]?.assignment.tileEntityId ?? null
  if (!tileEntityId) return null
  return { person, tileEntityId }
}

export function resolvedPresenceCandidates(
  people: readonly Person[],
  assignments: readonly PersonAssignment[],
): EncounterCandidate[] {
  const byPerson = new Map<string, PersonAssignment[]>()
  for (const assignment of assignments) {
    const list = byPerson.get(assignment.personId) ?? []
    list.push(assignment)
    byPerson.set(assignment.personId, list)
  }

  return people
    .map(person => resolvedPresenceCandidate(person, byPerson.get(person.id) ?? []))
    .filter((candidate): candidate is EncounterCandidate => Boolean(candidate))
    .sort((a, b) => a.person.id.localeCompare(b.person.id))
}
