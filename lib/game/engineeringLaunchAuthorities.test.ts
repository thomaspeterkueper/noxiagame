import assert from 'node:assert/strict'
import { resolveAscentOrbitNode } from './ascentTargets'
import {
  LUNAR_ASCENT_AUTHORITY_R1,
  resolveLunarAscentEngineeringAuthority,
} from './core/lunarAscentEngineeringAuthority'
import {
  CARRIER_ROCKET_LAUNCH_AUTHORITY_R1,
  resolveCarrierRocketEngineeringAuthority,
  type CarrierRocketOperationalState,
} from './core/carrierRocketEngineeringAuthority'

const lunarTarget = resolveAscentOrbitNode('moon-llo-100')
assert.ok(lunarTarget)
assert.equal(lunarTarget.bodySlug, 'moon')
assert.equal(lunarTarget.orbitClass, 'llo-circular')
assert.equal(lunarTarget.altitudeKm, 100)

const legacyMoon = resolveAscentOrbitNode('moon')
assert.ok(legacyMoon)
assert.equal(legacyMoon.orbitClass, 'legacy-orbit-node')

const unresolvedLunar = resolveLunarAscentEngineeringAuthority({
  departureSurfaceSlug: 'moon',
  target: lunarTarget,
  physicalState: null,
})
assert.equal(unresolvedLunar.result, 'unavailable')
assert.equal(unresolvedLunar.authority, null)

const wrongLunarFrame = resolveLunarAscentEngineeringAuthority({
  departureSurfaceSlug: 'moon',
  target: lunarTarget,
  physicalState: {
    engineeringFrameId: 'legacy-freighter',
    actualLiftoffMassKg: 12_000,
    crewCargoMissionEquipmentKg: 1_000,
    usableAscentPropellantKg: 5_500,
    targetPlaneResolved: true,
  },
})
assert.equal(wrongLunarFrame.result, 'frame-unmapped')
assert.equal(wrongLunarFrame.authority, null)

const approvedLunar = resolveLunarAscentEngineeringAuthority({
  departureSurfaceSlug: 'moon',
  target: lunarTarget,
  physicalState: {
    engineeringFrameId: 'ENG-SCV-0002',
    actualLiftoffMassKg: 14_000,
    crewCargoMissionEquipmentKg: 2_000,
    usableAscentPropellantKg: 5_500,
    targetPlaneResolved: true,
  },
})
assert.equal(approvedLunar.result, 'authorized')
assert.equal(approvedLunar.authority?.profileId, 'ENG-LUNAR-ASCENT-r1')
assert.equal(LUNAR_ASCENT_AUTHORITY_R1.sourceReference, 'systems/lunar-ascent-authority-r1.json')

const earthTarget = resolveAscentOrbitNode('earth-leo-400')
assert.ok(earthTarget)

const rocketState: CarrierRocketOperationalState = {
  bodySlug: 'earth',
  carrierProfileId: 'ENG-CRLS-MR1',
  launchSiteClass: 'ENG-LSITE-MIDLAT-ORBITAL',
  payloadMassKg: 12_000,
  payloadGeometryCompatible: true,
  payloadIntegrationQualified: true,
  vehicleAvailable: true,
  propellantAvailable: true,
  padAvailable: true,
  rangeClear: true,
  weatherGreen: true,
  navigationSolutionGreen: true,
  recoveryPlanGreen: true,
  crewed: false,
  crewSafetyAuthority: null,
}
const approvedRocket = resolveCarrierRocketEngineeringAuthority({ target: earthTarget, operationalState: rocketState })
assert.equal(approvedRocket.result, 'authorized')
assert.equal(approvedRocket.authority?.authorityId, 'ENG-CARRIER-ROCKET-LAUNCH-r1:ENG-CRLS-MR1')
assert.equal(approvedRocket.reusability, 'partially-reusable')
assert.equal(approvedRocket.minimumTechnicalTurnaroundHours, 72)

const overloadedRocket = resolveCarrierRocketEngineeringAuthority({
  target: earthTarget,
  operationalState: { ...rocketState, payloadMassKg: 15_001 },
})
assert.equal(overloadedRocket.result, 'payload-over-mass')
assert.equal(overloadedRocket.authority, null)

const moonRocket = resolveCarrierRocketEngineeringAuthority({
  target: lunarTarget,
  operationalState: { ...rocketState, bodySlug: 'moon' },
})
assert.equal(moonRocket.result, 'wrong-body')
assert.equal(moonRocket.authority, null)

assert.equal(CARRIER_ROCKET_LAUNCH_AUTHORITY_R1.sourceReference, 'systems/carrier-rocket-launch-authority-r1.json')
console.log('engineering launch authority tests passed')
