import {
  validateVehicleFrame,
  type VehicleFrame,
} from './types'
import type { SurfaceOperationProfile } from './surfaceMission'

export interface SurfaceVehicleProfileEntry {
  frame: VehicleFrame
  operationProfile: SurfaceOperationProfile | null
  sourceId?: string | null
}

export type SurfaceVehicleProfileUnresolvedReason =
  | 'frame-id-required'
  | 'frame-not-found'
  | 'duplicate-frame-id'
  | 'frame-invalid'
  | 'surface-domain-unsupported'
  | 'surface-mobility-missing'
  | 'operation-profile-missing'
  | 'operation-profile-invalid'
  | 'operation-profile-energy-store-missing'

export interface ResolvedSurfaceVehicleProfile {
  status: 'resolved'
  frame: VehicleFrame
  operationProfile: SurfaceOperationProfile
  sourceId: string | null
}

export interface UnresolvedSurfaceVehicleProfile {
  status: 'unresolved'
  frameId: string
  reason: SurfaceVehicleProfileUnresolvedReason
  details: string[]
}

export type SurfaceVehicleProfileResolution =
  | ResolvedSurfaceVehicleProfile
  | UnresolvedSurfaceVehicleProfile

function unresolved(
  frameId: string,
  reason: SurfaceVehicleProfileUnresolvedReason,
  details: string[] = [],
): UnresolvedSurfaceVehicleProfile {
  return { status: 'unresolved', frameId, reason, details }
}

/**
 * Resolve a persisted vehicle frame id to the exact shared surface frame and
 * Engineering operation profile that should feed `estimateSurfaceMission`.
 *
 * Deliberately no role-based, name-based or "closest frame" fallback exists:
 * if the exact canonical frame/profile is unavailable, the vehicle remains
 * unresolved rather than inheriting invented operating values.
 */
export function resolveSurfaceVehicleProfile(
  frameId: string,
  entries: readonly SurfaceVehicleProfileEntry[],
): SurfaceVehicleProfileResolution {
  const normalizedFrameId = frameId.trim()
  if (!normalizedFrameId) return unresolved(frameId, 'frame-id-required')

  const matches = entries.filter((entry) => entry.frame.id === normalizedFrameId)
  if (matches.length === 0) return unresolved(normalizedFrameId, 'frame-not-found')
  if (matches.length > 1) return unresolved(normalizedFrameId, 'duplicate-frame-id')

  const entry = matches[0]
  const frameErrors = validateVehicleFrame(entry.frame)
  if (frameErrors.length > 0) return unresolved(normalizedFrameId, 'frame-invalid', frameErrors)
  if (!entry.frame.domains.includes('surface')) {
    return unresolved(normalizedFrameId, 'surface-domain-unsupported')
  }
  if (!entry.frame.surfaceMobility) {
    return unresolved(normalizedFrameId, 'surface-mobility-missing')
  }

  const profile = entry.operationProfile
  if (!profile) return unresolved(normalizedFrameId, 'operation-profile-missing')
  if (!profile.energyStoreId.trim()
    || !Number.isFinite(profile.nominalConsumptionPerKm)
    || profile.nominalConsumptionPerKm < 0
    || !Number.isFinite(profile.wearPerOperatingHour)
    || profile.wearPerOperatingHour < 0) {
    return unresolved(normalizedFrameId, 'operation-profile-invalid')
  }
  if (!entry.frame.energyStores.some((store) => store.id === profile.energyStoreId)) {
    return unresolved(normalizedFrameId, 'operation-profile-energy-store-missing')
  }

  return {
    status: 'resolved',
    frame: entry.frame,
    operationProfile: profile,
    sourceId: entry.sourceId ?? null,
  }
}
