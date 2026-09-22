# Canonical Character Bridge

NOXIA may simulate characters that also exist in novels or other canonical Universe sources.

The game does **not** become the source of truth for those characters. Instead, `person_canonical_characters` links the normal Living Population `Person` to an external canonical identity.

## Boundary

- Canonical identity, biography and fixed historical events remain in the Universe/ORE canon.
- NOXIA owns runtime state: location, assignments, needs, health, relationships, knowledge, memories and emergent events.
- Emergent events may extend a character's lived simulation history but never silently rewrite the external canon.
- The same Person engine, actions, health, travel, employment and encounter rules apply to canonical and non-canonical residents.
- A canonical character receives no privileged world knowledge merely because the author knows it.
- `valid_from_tick` / `valid_until_tick` constrain when the character may participate in the simulation.

This keeps novel characters causal inhabitants of NOXIA rather than scripted cameos while preserving a single authoritative canon outside the game database.
