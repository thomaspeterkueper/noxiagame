// Shared survey/prospecting carrier contract for NOXIA.
//
// Instruments answer "how is a signal measured?". Platforms answer
// "from where and with which observation geometry is it measured?".
// Keep both concerns separate so the same physical instrument family can be
// used from a fixed scanner, rover, drone or orbital platform without copying
// resource-discovery logic.

import { getExplorationAssetType } from '../explorationAssets'
import type { InstrumentId } from '../resourceScanning'

export type SurveyPlatformKind =
  | 'fixed_scanner'
  | 'surface_rover'
  | 'exploration_drone'
  | 'orbital_satellite'

export type SurveyFootprintKind = 'point' | 'radius' | 'swath'
export type SurveyPlatformAvailability = 'buildable' | 'contract_only'

export type SurveyPlatformProfile = {
  id: string
  name: string
  kind: SurveyPlatformKind
  availability: SurveyPlatformAvailability
  footprintKind: SurveyFootprintKind
  explorationAssetTypeId?: string
  /**
   * Mount compatibility, not sensor performance. Range, sensitivity and
   * interpretation remain owned by the instrument/scanning contracts.
   */
  supportedInstrumentIds: readonly InstrumentId[]
  notes: string
}

/**
 * The existing VEX-47 is the first canonical mobile survey carrier.
 * Only non-contact airborne instruments are enabled here. Contact/seismic
 * equipment needs a separate deployment mechanism rather than pretending the
 * drone itself performs a borehole or seismic survey.
 */
export const VEX_47_SURVEY_PLATFORM: SurveyPlatformProfile = {
  id: 'vex_47',
  name: 'VEX-47 Explorationsdrohne',
  kind: 'exploration_drone',
  availability: 'buildable',
  footprintKind: 'radius',
  explorationAssetTypeId: 'vex_47',
  supportedInstrumentIds: ['gravimetry', 'magnetometry', 'hyperspectral'],
  notes: 'Lokaler mobiler Prospektions-Träger. Flugleistung und konkrete Sensorreichweiten bleiben Engineering-/Instrumentenwerte.',
}

/**
 * Platform contract only. This is deliberately not a buildable satellite type
 * yet: a concrete spacecraft/frame, orbit and Engineering profile must be
 * supplied before NOXIA may instantiate it. The existing `orbital` scanning
 * profile acts as its current remote-sensing payload compatibility bridge.
 */
export const ORBITAL_SURVEY_PLATFORM_CONTRACT: SurveyPlatformProfile = {
  id: 'orbital_survey_satellite',
  name: 'Orbitaler Prospektionssatellit',
  kind: 'orbital_satellite',
  availability: 'contract_only',
  footprintKind: 'swath',
  supportedInstrumentIds: ['orbital'],
  notes: 'Großräumige Fernerkundung. Konkreter Satellitentyp, Orbit, Wiederholrate und Auflösung sind noch nicht kanonisiert.',
}

export const SURVEY_PLATFORM_PROFILES: Record<string, SurveyPlatformProfile> = {
  [VEX_47_SURVEY_PLATFORM.id]: VEX_47_SURVEY_PLATFORM,
  [ORBITAL_SURVEY_PLATFORM_CONTRACT.id]: ORBITAL_SURVEY_PLATFORM_CONTRACT,
}

export function getSurveyPlatformProfile(id: string): SurveyPlatformProfile | null {
  return SURVEY_PLATFORM_PROFILES[id] ?? null
}

export function surveyPlatformForExplorationAsset(assetTypeId: string): SurveyPlatformProfile | null {
  const asset = getExplorationAssetType(assetTypeId)
  if (!asset) return null
  if (asset.id === VEX_47_SURVEY_PLATFORM.explorationAssetTypeId) return VEX_47_SURVEY_PLATFORM
  return null
}

export function canMountSurveyInstrument(platform: SurveyPlatformProfile, instrumentId: InstrumentId): boolean {
  return platform.supportedInstrumentIds.includes(instrumentId)
}

export type SurveyObservationFootprint =
  | { kind: 'point'; lat: number; lon: number }
  | { kind: 'radius'; lat: number; lon: number; radiusKm: number }
  | {
      kind: 'swath'
      /** Ordered ground-track points. */
      centerline: readonly { lat: number; lon: number }[]
      /** Nullable until backed by a concrete orbital Engineering profile. */
      swathWidthKm: number | null
    }

export type SurveyObservation = {
  id: string
  platformProfileId: string
  platformInstanceId: string | null
  instrumentId: InstrumentId
  measuredAt: string
  footprint: SurveyObservationFootprint
  /** Null means unresolved rather than an invented balancing value. */
  spatialResolutionM: number | null
  /** Ground-truth/discovery keys observed during this measurement. */
  signalKeys: readonly string[]
}

export function validateSurveyObservation(
  observation: SurveyObservation,
  platform: SurveyPlatformProfile,
): { ok: true } | { ok: false; reason: string } {
  if (observation.platformProfileId !== platform.id) return { ok: false, reason: 'platform-mismatch' }
  if (!canMountSurveyInstrument(platform, observation.instrumentId)) return { ok: false, reason: 'instrument-unsupported' }
  if (observation.footprint.kind !== platform.footprintKind) return { ok: false, reason: 'footprint-mismatch' }
  if (!Number.isFinite(Date.parse(observation.measuredAt))) return { ok: false, reason: 'measurement-time-invalid' }
  if (observation.spatialResolutionM != null && (!Number.isFinite(observation.spatialResolutionM) || observation.spatialResolutionM <= 0)) {
    return { ok: false, reason: 'resolution-invalid' }
  }
  if (observation.footprint.kind === 'radius' && (!Number.isFinite(observation.footprint.radiusKm) || observation.footprint.radiusKm <= 0)) {
    return { ok: false, reason: 'radius-invalid' }
  }
  if (observation.footprint.kind === 'swath') {
    if (observation.footprint.centerline.length < 2) return { ok: false, reason: 'swath-centerline-required' }
    if (observation.footprint.swathWidthKm != null && (!Number.isFinite(observation.footprint.swathWidthKm) || observation.footprint.swathWidthKm <= 0)) {
      return { ok: false, reason: 'swath-width-invalid' }
    }
  }
  return { ok: true }
}
