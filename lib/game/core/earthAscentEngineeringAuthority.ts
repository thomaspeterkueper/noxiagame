import type { AscentEngineeringAuthority } from '../ascentControl'
import type { ResolvedAscentOrbitNode } from '../ascentTargets'

/**
 * Consumer projection of KUEPER Engineering authority ENG-EARTH-LEO-ASCENT-r2.
 *
 * Engineering remains source of truth. NOXIA copies only the stable approved
 * consumer gates needed to fail closed at runtime. The superseded r1 authority
 * must never authorize a new ascent.
 */
export const EARTH_LEO_ASCENT_AUTHORITY_R2 = {
  authorityId: 'ENG-EARTH-LEO-ASCENT-r2',
  engineeringFrameId: 'ENG-SCV-0004',
  departureBody: 'earth',
  targetBody: 'earth',
  targetOrbitClass: 'leo-circular',
  minCircularAltitudeKm: 395,
  maxCircularAltitudeKm: 405,
  maxStartMassKg: 748_340,
  requiredReleaseSpeedMS: 170,
  requiredPropellantStateRef: 'ENG-EARTH-LEO-ASCENT-r2:reference-propellant-state',
  requiredHighLiftStateRef: 'ENG-EARTH-LEO-ASCENT-r2:reference-high-lift-state',
  requiredLaunchSiteClass: 'engineering-cleared-asce-launch-assist-site',
  sourceRepository: 'thomaspeterkueper/kueper-engineering',
  sourceReference: 'systems/earth-leo-ascent-authority-r2.json',
} as const

export type EarthAscentEngineeringResult =
  | 'authorized'
  | 'frame-unmapped'
  | 'authority-mismatch'
  | 'over-mass'
  | 'mass-unresolved'
  | 'insufficient-propellant-authority'
  | 'unsupported-high-lift-state'
  | 'unsupported-launch-site'
  | 'insufficient-release-speed'
  | 'unsupported-orbit'
  | 'not-applicable'
  | 'unavailable'

/** NOXIA-owned physical departure state. All values must come from persisted/trusted state. */
export interface EarthAscentPhysicalState {
  actualStartMassKg: number | null
  crewMassResolved: boolean
  cargoMassResolved: boolean
  missionEquipmentMassResolved: boolean
  propellantStateRef: string | null
  highLiftStateRef: string | null
  departureSiteClass: string | null
  releaseSpeedMS: number | null
  targetPlaneResolved: boolean
  targetInclinationDeg: number | null
}

export interface EarthAscentEngineeringAssessment {
  result: EarthAscentEngineeringResult
  authority: AscentEngineeringAuthority | null
  blockers: string[]
  authorityId: string
  engineeringFrameId: string
}

export function resolveEarthAscentEngineeringAuthority(input: {
  engineeringFrameId: string | null
  engineeringAuthorityRef?: string | null
  departureSurfaceSlug: string
  target: ResolvedAscentOrbitNode | null
  physicalState: EarthAscentPhysicalState | null
}): EarthAscentEngineeringAssessment {
  const a = EARTH_LEO_ASCENT_AUTHORITY_R2
  const blockers: string[] = []

  if (input.departureSurfaceSlug.trim().toLowerCase() !== a.departureBody) {
    return {
      result: 'not-applicable',
      authority: null,
      blockers: ['departure-body-not-earth'],
      authorityId: a.authorityId,
      engineeringFrameId: a.engineeringFrameId,
    }
  }

  if (input.engineeringFrameId !== a.engineeringFrameId) {
    return {
      result: 'frame-unmapped',
      authority: null,
      blockers: ['flight-article-not-mapped-to-eng-scv-0004'],
      authorityId: a.authorityId,
      engineeringFrameId: a.engineeringFrameId,
    }
  }

  if (input.engineeringAuthorityRef !== a.authorityId) {
    return {
      result: 'authority-mismatch',
      authority: null,
      blockers: ['flight-article-authority-not-eng-earth-leo-ascent-r2'],
      authorityId: a.authorityId,
      engineeringFrameId: a.engineeringFrameId,
    }
  }

  const target = input.target
  if (
    !target
    || target.bodySlug !== a.targetBody
    || target.orbitClass !== a.targetOrbitClass
    || target.altitudeKm == null
    || target.altitudeKm < a.minCircularAltitudeKm
    || target.altitudeKm > a.maxCircularAltitudeKm
  ) {
    blockers.push('target-outside-395-405-km-circular-earth-leo')
  }

  const state = input.physicalState
  if (!state) {
    return {
      result: blockers.length ? 'unsupported-orbit' : 'unavailable',
      authority: null,
      blockers: [...blockers, 'physical-departure-state-unavailable'],
      authorityId: a.authorityId,
      engineeringFrameId: a.engineeringFrameId,
    }
  }

  if (
    state.actualStartMassKg == null
    || !Number.isFinite(state.actualStartMassKg)
    || !state.crewMassResolved
    || !state.cargoMassResolved
    || !state.missionEquipmentMassResolved
  ) {
    blockers.push('physical-start-mass-unresolved')
  } else if (state.actualStartMassKg > a.maxStartMassKg) {
    blockers.push('start-mass-exceeds-748340-kg')
  }

  // These are NOXIA consumer-resolution tokens anchored to the exact r2 authority.
  // They assert that trusted state has been resolved to the Engineering reference
  // envelope; they do not invent propellant or high-lift physics.
  if (state.propellantStateRef !== a.requiredPropellantStateRef) {
    blockers.push('r2-reference-propellant-state-unresolved')
  }
  if (state.highLiftStateRef !== a.requiredHighLiftStateRef) {
    blockers.push('r2-reference-high-lift-state-unresolved')
  }
  if (state.departureSiteClass !== a.requiredLaunchSiteClass) {
    blockers.push('launch-site-not-mapped-to-asce-site-class')
  }
  if (state.releaseSpeedMS == null || state.releaseSpeedMS < a.requiredReleaseSpeedMS) {
    blockers.push('release-speed-below-170-ms-or-unresolved')
  }
  if (
    !state.targetPlaneResolved
    || state.targetInclinationDeg == null
    || !Number.isFinite(state.targetInclinationDeg)
    || state.targetInclinationDeg < 0
    || state.targetInclinationDeg > 180
  ) {
    blockers.push('target-plane-or-inclination-unresolved')
  }

  if (blockers.length) {
    let result: EarthAscentEngineeringResult = 'unavailable'
    if (blockers.some(blocker => blocker.startsWith('target-'))) result = 'unsupported-orbit'
    else if (blockers.includes('physical-start-mass-unresolved')) result = 'mass-unresolved'
    else if (blockers.includes('start-mass-exceeds-748340-kg')) result = 'over-mass'
    else if (blockers.includes('r2-reference-propellant-state-unresolved')) result = 'insufficient-propellant-authority'
    else if (blockers.includes('r2-reference-high-lift-state-unresolved')) result = 'unsupported-high-lift-state'
    else if (blockers.includes('launch-site-not-mapped-to-asce-site-class')) result = 'unsupported-launch-site'
    else if (blockers.includes('release-speed-below-170-ms-or-unresolved')) result = 'insufficient-release-speed'

    return {
      result,
      authority: null,
      blockers,
      authorityId: a.authorityId,
      engineeringFrameId: a.engineeringFrameId,
    }
  }

  return {
    result: 'authorized',
    authority: {
      vehicleFrameId: a.engineeringFrameId,
      body: 'earth',
      profileId: a.authorityId,
      sourceRepository: a.sourceRepository,
      sourceReference: a.sourceReference,
    },
    blockers: [],
    authorityId: a.authorityId,
    engineeringFrameId: a.engineeringFrameId,
  }
}
