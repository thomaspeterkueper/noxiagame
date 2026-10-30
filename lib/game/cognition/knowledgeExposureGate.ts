// NOXIA #529: Pure, non-persistent knowledge access checks.
// A projection grants an opportunity to learn, never authoritative knowledge.
export type KnowledgeProjection = {
  id: string
  sourceId: string
  availableFromTick: number
  availableUntilTick?: number
  locationIds: readonly string[]
  requiredRoles: readonly string[]
}
export type AccessContext = {
  npcId: string
  tick: number
  locationId: string
  roles: readonly string[]
}
export type KnowledgeExposure = {
  npcId: string
  projectionId: string
  sourceId: string
  atTick: number
  canonical: false
}
export function evaluateKnowledgeAccess(
  projection: KnowledgeProjection,
  context: AccessContext,
): KnowledgeExposure | null {
  if (!Number.isSafeInteger(context.tick) || context.tick < 0) return null
  if (context.tick < projection.availableFromTick) return null
  if (projection.availableUntilTick !== undefined && context.tick > projection.availableUntilTick) return null
  if (!projection.locationIds.includes(context.locationId)) return null
  if (!projection.requiredRoles.some(role => context.roles.includes(role))) return null
  if (!projection.id || !projection.sourceId || !context.npcId) return null
  return {
    npcId: context.npcId,
    projectionId: projection.id,
    sourceId: projection.sourceId,
    atTick: context.tick,
    canonical: false,
  }
}
