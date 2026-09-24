import type { ResolvedAscentOrbitNode } from '../ascentTargets'
import type {
  LaunchEngineeringAuthority,
  LaunchVehicleReusability,
} from '../launchSystems'

export const CARRIER_ROCKET_LAUNCH_AUTHORITY_R1 = {
  authorityId: 'ENG-CARRIER-ROCKET-LAUNCH-r1',
  supportedBody: 'earth',
  sourceRepository: 'thomaspeterkueper/kueper-engineering',
  sourceReference: 'systems/carrier-rocket-launch-authority-r1.json',
  launchSiteClasses: ['ENG-LSITE-EQ-HEAVY', 'ENG-LSITE-MIDLAT-ORBITAL'] as const,
  profiles: {
    'ENG-CRLS-MR1': {
      reusability: 'partially-reusable' as LaunchVehicleReusability,
      leoPayloadMaxKg: 15_000,
      fairingDiameterM: 5,
      fairingUsableLengthM: 15,
      crewCapability: 'integrated-stack-authority-required',
      minimumTechnicalTurnaroundHours: 72,
    },
    'ENG-CRLS-HR1': {
      reusability: 'partially-reusable' as LaunchVehicleReusability,
      leoPayloadMaxKg: 40_000,
      fairingDiameterM: 7,
      fairingUsableLengthM: 20,
      crewCapability: 'integrated-stack-authority-required',
      minimumTechnicalTurnaroundHours: 96,
    },
    'ENG-CRLS-HE1': {
      reusability: 'expendable' as LaunchVehicleReusability,
      leoPayloadMaxKg: 22_000,
      fairingDiameterM: null,
      fairingUsableLengthM: null,
      crewCapability: 'not-authorized-by-profile-alone',
      minimumTechnicalTurnaroundHours: null,
    },
  },
} as const

export type CarrierRocketEngineeringResult =
  | 'authorized'
  | 'profile-unmapped'
  | 'wrong-body'
  | 'unsupported-launch-site'
  | 'unsupported-orbit'
  | 'payload-mass-unresolved'
  | 'payload-over-mass'
  | 'payload-geometry-unresolved'
  | 'payload-integration-unresolved'
  | 'vehicle-unavailable'
  | 'propellant-unavailable'
  | 'pad-unavailable'
  | 'range-not-clear'
  | 'weather-not-green'
  | 'navigation-not-green'
  | 'recovery-plan-unresolved'
  | 'crew-safety-unresolved'
  | 'unavailable'

export interface CarrierRocketOperationalState {
  bodySlug: string
  carrierProfileId: string | null
  launchSiteClass: string | null
  payloadMassKg: number | null
  payloadGeometryCompatible: boolean | null
  payloadIntegrationQualified: boolean | null
  vehicleAvailable: boolean | null
  propellantAvailable: boolean | null
  padAvailable: boolean | null
  rangeClear: boolean | null
  weatherGreen: boolean | null
  navigationSolutionGreen: boolean | null
  recoveryPlanGreen: boolean | null
  crewed: boolean
  crewSafetyAuthority: boolean | null
}

export interface CarrierRocketEngineeringAssessment {
  result: CarrierRocketEngineeringResult
  authority: LaunchEngineeringAuthority | null
  blockers: string[]
  authorityId: string
  carrierProfileId: string | null
  reusability: LaunchVehicleReusability | null
  minimumTechnicalTurnaroundHours: number | null
}

export function resolveCarrierRocketEngineeringAuthority(input: {
  target: ResolvedAscentOrbitNode | null
  operationalState: CarrierRocketOperationalState
}): CarrierRocketEngineeringAssessment {
  const a = CARRIER_ROCKET_LAUNCH_AUTHORITY_R1
  const s = input.operationalState
  const profile = s.carrierProfileId
    ? a.profiles[s.carrierProfileId as keyof typeof a.profiles]
    : undefined

  const base = {
    authorityId: a.authorityId,
    carrierProfileId: s.carrierProfileId,
    reusability: profile?.reusability ?? null,
    minimumTechnicalTurnaroundHours: profile?.minimumTechnicalTurnaroundHours ?? null,
  }

  if (s.bodySlug.trim().toLowerCase() !== a.supportedBody) {
    return { ...base, result: 'wrong-body', authority: null, blockers: ['carrier-rocket-r1-is-earth-only'] }
  }
  if (!profile) {
    return { ...base, result: 'profile-unmapped', authority: null, blockers: ['carrier-profile-not-in-eng-carrier-rocket-launch-r1'] }
  }
  if (!s.launchSiteClass || !(a.launchSiteClasses as readonly string[]).includes(s.launchSiteClass)) {
    return { ...base, result: 'unsupported-launch-site', authority: null, blockers: ['launch-site-class-not-authorized'] }
  }

  const target = input.target
  if (!target || target.bodySlug !== 'earth' || target.altitudeKm == null || target.altitudeKm < 200 || target.altitudeKm > 600) {
    return { ...base, result: 'unsupported-orbit', authority: null, blockers: ['target-outside-earth-leo-200-600-km-class'] }
  }

  const blockers: string[] = []
  if (s.payloadMassKg == null || !Number.isFinite(s.payloadMassKg)) blockers.push('payload-mass-unresolved')
  else if (s.payloadMassKg > profile.leoPayloadMaxKg) blockers.push('payload-over-authorized-leo-envelope')
  if (s.payloadGeometryCompatible !== true) blockers.push('payload-geometry-not-qualified')
  if (s.payloadIntegrationQualified !== true) blockers.push('payload-integration-not-qualified')
  if (s.vehicleAvailable !== true) blockers.push('carrier-vehicle-unavailable')
  if (s.propellantAvailable !== true) blockers.push('propellant-unavailable')
  if (s.padAvailable !== true) blockers.push('pad-unavailable')
  if (s.rangeClear !== true) blockers.push('range-not-clear')
  if (s.weatherGreen !== true) blockers.push('weather-not-green')
  if (s.navigationSolutionGreen !== true) blockers.push('navigation-solution-not-green')
  if (profile.reusability !== 'expendable' && s.recoveryPlanGreen !== true) blockers.push('recovery-plan-not-green')
  if (s.crewed && s.crewSafetyAuthority !== true) blockers.push('crew-safety-authority-unresolved')

  if (blockers.length) {
    let result: CarrierRocketEngineeringResult = 'unavailable'
    if (blockers.includes('payload-mass-unresolved')) result = 'payload-mass-unresolved'
    else if (blockers.includes('payload-over-authorized-leo-envelope')) result = 'payload-over-mass'
    else if (blockers.includes('payload-geometry-not-qualified')) result = 'payload-geometry-unresolved'
    else if (blockers.includes('payload-integration-not-qualified')) result = 'payload-integration-unresolved'
    else if (blockers.includes('carrier-vehicle-unavailable')) result = 'vehicle-unavailable'
    else if (blockers.includes('propellant-unavailable')) result = 'propellant-unavailable'
    else if (blockers.includes('pad-unavailable')) result = 'pad-unavailable'
    else if (blockers.includes('range-not-clear')) result = 'range-not-clear'
    else if (blockers.includes('weather-not-green')) result = 'weather-not-green'
    else if (blockers.includes('navigation-solution-not-green')) result = 'navigation-not-green'
    else if (blockers.includes('recovery-plan-not-green')) result = 'recovery-plan-unresolved'
    else if (blockers.includes('crew-safety-authority-unresolved')) result = 'crew-safety-unresolved'
    return { ...base, result, authority: null, blockers }
  }

  return {
    ...base,
    result: 'authorized',
    authority: {
      architecture: 'carrier-rocket',
      authorityId: `${a.authorityId}:${s.carrierProfileId}`,
      sourceRepository: a.sourceRepository,
      sourceReference: a.sourceReference,
    },
    blockers: [],
  }
}
