import type { AscentEngineeringAuthority } from '@/lib/game/ascentControl'
import type { ResolvedAscentOrbitNode } from '@/lib/game/ascentTargets'

/**
 * Consumer projection of KUEPER Engineering authority ENG-EARTH-LEO-ASCENT-r1.
 *
 * Engineering remains source of truth. NOXIA copies only the stable, approved
 * consumer boundaries needed to fail closed at runtime; it does not reproduce
 * the underlying propulsion model or derive new physical values.
 */
export const EARTH_LEO_ASCENT_AUTHORITY_R1 = {
  authorityId: 'ENG-EARTH-LEO-ASCENT-r1',
  engineeringFrameId: 'ENG-SCV-0003',
  noxiaShipTypeId: 'asce_p85_r1',
  departureBody: 'earth',
  targetBody: 'earth',
  targetOrbitClass: 'leo-circular',
  minCircularAltitudeKm: 395,
  maxCircularAltitudeKm: 405,
  maxStartMassKg: 674660,
  requiredReleaseSpeedMS: 160,
  requiredPropellantStateRef: 'ENG-EARTH-LEO-ASCENT-r1:reference-propellant-state',
  requiredLaunchSiteClass: 'engineering-cleared-asce-launch-assist-site',
  sourceRepository: 'thomaspeterkueper/kueper-engineering',
  sourceReference: 'systems/earth-leo-ascent-authority-r1.json',
} as const

export type EarthAscentEngineeringResult =
  | 'authorized'
  | 'frame-unmapped'
  | 'over-mass'
  | 'mass-unresolved'
  | 'insufficient-propellant-authority'
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
  departureSiteClass: string | null
  releaseSpeedMS: number | null
  targetPlaneResolved: boolean
}

export interface EarthAscentEngineeringAssessment {
  result: EarthAscentEngineeringResult
  authority: AscentEngineeringAuthority | null
  blockers: string[]
  authorityId: string
  engineeringFrameId: string
}

export function resolveEarthAscentEngineeringAuthority(input: {
  shipTypeId: string | null
  departureSurfaceSlug: string
  target: ResolvedAscentOrbitNode | null
  physicalState: EarthAscentPhysicalState | null
}): EarthAscentEngineeringAssessment {
  const a = EARTH_LEO_ASCENT_AUTHORITY_R1
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

  if (input.shipTypeId !== a.noxiaShipTypeId) {
    return {
      result: 'frame-unmapped',
      authority: null,
      blockers: ['noxia-ship-not-mapped-to-eng-scv-0003'],
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
    blockers.push('start-mass-exceeds-674660-kg')
  }

  if (state.propellantStateRef !== a.requiredPropellantStateRef) {
    blockers.push('r1-reference-propellant-state-unresolved')
  }
  if (state.departureSiteClass !== a.requiredLaunchSiteClass) {
    blockers.push('launch-site-not-mapped-to-asce-site-class')
  }
  if (state.releaseSpeedMS == null || state.releaseSpeedMS < a.requiredReleaseSpeedMS) {
    blockers.push('release-speed-below-160-ms-or-unresolved')
  }
  if (!state.targetPlaneResolved) {
    blockers.push('target-plane-unresolved')
  }

  if (blockers.length) {
    let result: EarthAscentEngineeringResult = 'unavailable'
    if (blockers.some(b => b.startsWith('target-') || b === 'target-plane-unresolved')) result = 'unsupported-orbit'
    else if (blockers.includes('physical-start-mass-unresolved')) result = 'mass-unresolved'
    else if (blockers.includes('start-mass-exceeds-674660-kg')) result = 'over-mass'
    else if (blockers.includes('r1-reference-propellant-state-unresolved')) result = 'insufficient-propellant-authority'
    else if (blockers.includes('launch-site-not-mapped-to-asce-site-class')) result = 'unsupported-launch-site'
    else if (blockers.includes('release-speed-below-160-ms-or-unresolved')) result = 'insufficient-release-speed'

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
