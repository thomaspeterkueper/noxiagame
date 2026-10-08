// lib/game/population/visitTarget.ts
// NOXIA-LIVING-0009 — whom a person goes to see.

import type { PersonRelationship } from './types'

/**
 * Lonely people seek their strongest bond. Bored people seek someone they like
 * but know least: the person who would be the biggest change. Deterministic;
 * null without candidates.
 */
export function chooseVisitTarget(
  relationships: readonly PersonRelationship[],
  drive: { socialPressure: number; varietyPressure: number },
): string | null {
  if (!relationships.length) return null
  const byBond = [...relationships].sort((a, b) =>
    (b.familiarity + b.trust + b.affinity) - (a.familiarity + a.trust + a.affinity) || a.otherPersonId.localeCompare(b.otherPersonId))
  if (drive.varietyPressure <= drive.socialPressure) return byBond[0].otherPersonId
  const liked = relationships.filter((relation) => relation.affinity >= 0.5)
  if (!liked.length) return byBond[0].otherPersonId
  return [...liked].sort((a, b) =>
    (a.familiarity - b.familiarity) || ((a.lastInteractionTick ?? -1) - (b.lastInteractionTick ?? -1)) || a.otherPersonId.localeCompare(b.otherPersonId))[0].otherPersonId
}
