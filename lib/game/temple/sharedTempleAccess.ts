/**
 * One destination, multiple discoverable entrances. This is metadata/routing
 * only: neither authentication nor movement nor an interior is granted here.
 */
export type TempleEntryChannel = 'world_map' | 'endia' | 'adventure_park'
export type TempleVisitMode = 'physical' | 'remote'
export interface SharedTempleEntrance {
  channel: TempleEntryChannel
  destinationKey: string
  mode: TempleVisitMode
  authenticated: boolean
  accessGranted: boolean
}
export const DAVARU_TEMPLE_DESTINATION = 'davaru-temple' as const

export function resolveSharedTempleEntrance(input: SharedTempleEntrance):
  | { allowed: true; destinationKey: typeof DAVARU_TEMPLE_DESTINATION; mode: TempleVisitMode }
  | { allowed: false; reason: 'unknown-destination' | 'authentication-required' | 'access-denied' } {
  if (input.destinationKey !== DAVARU_TEMPLE_DESTINATION)
    return { allowed: false, reason: 'unknown-destination' }
  if (!input.authenticated) return { allowed: false, reason: 'authentication-required' }
  if (!input.accessGranted) return { allowed: false, reason: 'access-denied' }
  // Merely using a portal may not instantly relocate a physical person.
  if (input.mode === 'physical' && input.channel !== 'world_map')
    return { allowed: false, reason: 'access-denied' }
  return { allowed: true, destinationKey: DAVARU_TEMPLE_DESTINATION, mode: input.mode }
}
