export const CANONICAL_CHARACTER_MODES = [
  'canon_anchor',
  'historical_trace',
  'simulation_only',
] as const

export type CanonicalCharacterMode = (typeof CANONICAL_CHARACTER_MODES)[number]

export interface CanonicalCharacterRef {
  personId: string
  universeKey: string
  characterKey: string
  canonSourceRef: string | null
  canonRevision: string | null
  integrationMode: CanonicalCharacterMode
  validFromTick: number | null
  validUntilTick: number | null
}

export function isCanonicalCharacterActive(ref: CanonicalCharacterRef, tick: number): boolean {
  if (ref.validFromTick !== null && tick < ref.validFromTick) return false
  if (ref.validUntilTick !== null && tick > ref.validUntilTick) return false
  return true
}

export interface EmergentCharacterEvent {
  tick: number
  eventType: string
  subjectRef: string | null
}

/**
 * Simulation events belong to the person's lived game history.
 * They may reference canon, but never mutate the external canonical record.
 */
export function emergentCharacterEvent(
  ref: CanonicalCharacterRef,
  tick: number,
  eventType: string,
  subjectRef: string | null = null,
): EmergentCharacterEvent | null {
  if (!isCanonicalCharacterActive(ref, tick)) return null
  return { tick, eventType, subjectRef }
}
