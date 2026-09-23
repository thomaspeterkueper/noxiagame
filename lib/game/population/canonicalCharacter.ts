export const CANONICAL_CHARACTER_MODES = ['canon_anchor', 'historical_trace', 'simulation_only'] as const
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
  return (ref.validFromTick === null || tick >= ref.validFromTick)
    && (ref.validUntilTick === null || tick <= ref.validUntilTick)
}

/** Canon links identity only; cognition and knowledge still come from observable simulation state. */
export function canonicalIdentityFactors(ref: CanonicalCharacterRef): Record<string, string> {
  return {
    universeKey: ref.universeKey,
    characterKey: ref.characterKey,
    integrationMode: ref.integrationMode,
  }
}
