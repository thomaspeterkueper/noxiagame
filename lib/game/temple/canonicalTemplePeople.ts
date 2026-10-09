/**
 * The temple has roles, never privately spawned copies of literary persons.
 * Real identities must be resolved from the canonical person bridge.
 */
export const TEMPLE_CANONICAL_ROLES = [
  { characterKey: 'daniel-van-runen-davaru', role: 'host', label: 'Daniel van Runen (DaVaRu)' },
  { characterKey: 'aristeas-lux', role: 'visitor', label: 'Aristeas Lux' },
] as const

export type TempleCanonicalRole = (typeof TEMPLE_CANONICAL_ROLES)[number]['role']

export interface TemplePersonReference {
  person_id: string
  character_key: string
  universe_key: string
  integration_mode: string
  valid_from_tick: number | null
  valid_until_tick: number | null
}

export function resolveTempleCanonicalPeople(
  references: readonly TemplePersonReference[],
  currentTick: number | null,
) {
  return TEMPLE_CANONICAL_ROLES.flatMap(definition => {
    const matches = references.filter(ref =>
      ref.character_key === definition.characterKey &&
      ref.universe_key === 'noxia' &&
      ref.integration_mode === 'canon_anchor' &&
      (currentTick === null || (
        (ref.valid_from_tick === null || currentTick >= ref.valid_from_tick) &&
        (ref.valid_until_tick === null || currentTick <= ref.valid_until_tick)
      ))
    )
    // Ambiguous mappings fail closed rather than assigning an arbitrary actor.
    if (matches.length !== 1) return []
    return [{ personId: matches[0].person_id, characterKey: definition.characterKey,
      role: definition.role, displayName: definition.label }]
  })
}
