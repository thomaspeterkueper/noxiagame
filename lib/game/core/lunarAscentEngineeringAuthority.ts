import type { AscentEngineeringAuthority } from '../ascentControl'
import type { ResolvedAscentOrbitNode } from '../ascentTargets'

/** Consumer projection of KUEPER Engineering ENG-LUNAR-ASCENT-r1. */
export const LUNAR_ASCENT_AUTHORITY_R1 = {
  authorityId: 'ENG-LUNAR-ASCENT-r1',
  engineeringFrameId: 'ENG-SCV-0002',
  departureBody: 'moon',
  targetBody: 'moon',
  targetOrbitClass: 'llo-circular',
  minCircularAltitudeKm: 80,
  maxCircularAltitudeKm: 120,
  maxLiftoffMassKg: 14_000,
  maxCrewCargoMissionEquipmentKg: 2_000,
  referenceUsableAscentPropellantKg: 5_500,
  sourceRepository: 'thomaspeterkueper/kueper-engineering',
  sourceReference: 'systems/lunar-ascent-authority-r1.json',
} as const

export type LunarAscentEngineeringResult =
  | 'authorized'
  | 'frame-unmapped'
  | 'over-mass'
  | 'payload-over-envelope'
  | 'insufficient-propellant'
  | 'mass-unresolved'
  | 'propellant-unresolved'
  | 'unsupported-orbit'
  | 'not-applicable'
  | 'unavailable'

/**
 * Trusted NOXIA flight-article state. These values must come from persisted
 * spacecraft/configuration state; gameplay labels are not Engineering frame IDs.
 */
export interface LunarAscentPhysicalState {
  engineeringFrameId: string | null
  actualLiftoffMassKg: number | null
  crewCargoMissionEquipmentKg: number | null
  usableAscentPropellantKg: number | null
  targetPlaneResolved: boolean
}

export interface LunarAscentEngineeringAssessment {
  result: LunarAscentEngineeringResult
  authority: AscentEngineeringAuthority | null
  blockers: string[]
  authorityId: string
  engineeringFrameId: string
}

export function resolveLunarAscentEngineeringAuthority(input: {
  departureSurfaceSlug: string
  target: ResolvedAscentOrbitNode | null
  physicalState: LunarAscentPhysicalState | null
}): LunarAscentEngineeringAssessment {
  const a = LUNAR_ASCENT_AUTHORITY_R1
  const blockers: string[] = []

  if (input.departureSurfaceSlug.trim().toLowerCase() !== a.departureBody) {
    return {
      result: 'not-applicable', authority: null,
      blockers: ['departure-body-not-moon'],
      authorityId: a.authorityId, engineeringFrameId: a.engineeringFrameId,
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
  ) blockers.push('target-outside-80-120-km-circular-lunar-orbit')

  const state = input.physicalState
  if (!state) {
    return {
      result: blockers.length ? 'unsupported-orbit' : 'unavailable',
      authority: null,
      blockers: [...blockers, 'physical-flight-article-state-unavailable'],
      authorityId: a.authorityId, engineeringFrameId: a.engineeringFrameId,
    }
  }

  if (state.engineeringFrameId !== a.engineeringFrameId) {
    return {
      result: 'frame-unmapped', authority: null,
      blockers: [...blockers, 'flight-article-not-mapped-to-eng-scv-0002'],
      authorityId: a.authorityId, engineeringFrameId: a.engineeringFrameId,
    }
  }

  if (state.actualLiftoffMassKg == null || !Number.isFinite(state.actualLiftoffMassKg)) {
    blockers.push('liftoff-mass-unresolved')
  } else if (state.actualLiftoffMassKg > a.maxLiftoffMassKg) {
    blockers.push('liftoff-mass-exceeds-14000-kg')
  }

  if (state.crewCargoMissionEquipmentKg == null || !Number.isFinite(state.crewCargoMissionEquipmentKg)) {
    blockers.push('mission-payload-mass-unresolved')
  } else if (state.crewCargoMissionEquipmentKg > a.maxCrewCargoMissionEquipmentKg) {
    blockers.push('crew-cargo-mission-equipment-exceeds-2000-kg')
  }

  if (state.usableAscentPropellantKg == null || !Number.isFinite(state.usableAscentPropellantKg)) {
    blockers.push('usable-ascent-propellant-unresolved')
  } else if (state.usableAscentPropellantKg < a.referenceUsableAscentPropellantKg) {
    blockers.push('usable-ascent-propellant-below-reference-5500-kg')
  }

  if (!state.targetPlaneResolved) blockers.push('target-plane-unresolved')

  if (blockers.length) {
    let result: LunarAscentEngineeringResult = 'unavailable'
    if (blockers.some(b => b.startsWith('target-'))) result = 'unsupported-orbit'
    else if (blockers.includes('liftoff-mass-unresolved') || blockers.includes('mission-payload-mass-unresolved')) result = 'mass-unresolved'
    else if (blockers.includes('liftoff-mass-exceeds-14000-kg')) result = 'over-mass'
    else if (blockers.includes('crew-cargo-mission-equipment-exceeds-2000-kg')) result = 'payload-over-envelope'
    else if (blockers.includes('usable-ascent-propellant-unresolved')) result = 'propellant-unresolved'
    else if (blockers.includes('usable-ascent-propellant-below-reference-5500-kg')) result = 'insufficient-propellant'

    return { result, authority: null, blockers, authorityId: a.authorityId, engineeringFrameId: a.engineeringFrameId }
  }

  return {
    result: 'authorized',
    authority: {
      vehicleFrameId: a.engineeringFrameId,
      body: 'moon',
      profileId: a.authorityId,
      sourceRepository: a.sourceRepository,
      sourceReference: a.sourceReference,
    },
    blockers: [],
    authorityId: a.authorityId,
    engineeringFrameId: a.engineeringFrameId,
  }
}
