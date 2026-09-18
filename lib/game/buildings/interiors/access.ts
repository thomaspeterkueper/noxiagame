import type { InteriorInstance, InteriorPortalDef, InteriorTemplate, PortalId } from './types'
import { isPortalTraversable } from './navigation'

/**
 * Read-only access facts resolved by an authoritative Core/domain policy layer.
 * The interior domain never derives these from ownership, custody, assignments,
 * roles, broad location or presence by itself.
 */
export interface InteriorAccessSnapshot {
  subjectId: string
  grantedTags: readonly string[]
  source: string
}

export type InteriorPortalAccessReason =
  | 'allowed'
  | 'unknown-portal'
  | 'portal-not-traversable'
  | 'missing-required-access-tag'

export interface InteriorPortalAccessDecision {
  portalId: PortalId
  allowed: boolean
  reason: InteriorPortalAccessReason
  requiredTags: readonly string[]
  missingTags: readonly string[]
}

/**
 * Evaluates portal access against already-authorized access tags.
 * All declared portal accessTags are required. This function does not create
 * grants and does not interpret owner/operator/assignment relations as grants.
 */
export function evaluateInteriorPortalAccess(
  template: InteriorTemplate,
  instance: InteriorInstance,
  portalId: PortalId,
  access: InteriorAccessSnapshot,
): InteriorPortalAccessDecision {
  const portal = template.portals.find(candidate => candidate.id === portalId)
  if (!portal) {
    return {
      portalId,
      allowed: false,
      reason: 'unknown-portal',
      requiredTags: [],
      missingTags: [],
    }
  }

  if (!isPortalTraversable(instance, portalId)) {
    return {
      portalId,
      allowed: false,
      reason: 'portal-not-traversable',
      requiredTags: portal.accessTags ?? [],
      missingTags: [],
    }
  }

  return evaluateAccessTags(portal, access)
}

function evaluateAccessTags(
  portal: InteriorPortalDef,
  access: InteriorAccessSnapshot,
): InteriorPortalAccessDecision {
  const requiredTags = portal.accessTags ?? []
  const granted = new Set(access.grantedTags)
  const missingTags = requiredTags.filter(tag => !granted.has(tag))

  return {
    portalId: portal.id,
    allowed: missingTags.length === 0,
    reason: missingTags.length === 0 ? 'allowed' : 'missing-required-access-tag',
    requiredTags,
    missingTags,
  }
}

/**
 * Adapter for the navigation engine. Operational portal state is still checked
 * independently by navigation; access may further restrict a route but can
 * never make a locked/blocked/failed portal traversable.
 */
export function createInteriorPortalAccessPredicate(
  template: InteriorTemplate,
  instance: InteriorInstance,
  access: InteriorAccessSnapshot,
): (portalId: PortalId) => boolean {
  return portalId => evaluateInteriorPortalAccess(template, instance, portalId, access).allowed
}
