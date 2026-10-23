import assert from 'node:assert/strict'
import {
  EARTH_LEO_ASCENT_AUTHORITY_R2,
  resolveEarthAscentEngineeringAuthority,
  type EarthAscentPhysicalState,
} from './core/earthAscentEngineeringAuthority'
import type { ResolvedAscentOrbitNode } from './ascentTargets'

const target: ResolvedAscentOrbitNode = {
  slug: 'earth-leo-400',
  bodySlug: 'earth',
  label: 'Earth · 400 km LEO',
  orbitClass: 'leo-circular',
  altitudeKm: 400,
  sourceReference: 'KUEPER-ENGINEERING systems/earth-leo-ascent-authority-r2.json',
  resolution: 'explicit-ascent-node',
}

const physicalState: EarthAscentPhysicalState = {
  actualStartMassKg: 748_340,
  crewMassResolved: true,
  cargoMassResolved: true,
  missionEquipmentMassResolved: true,
  propellantStateRef: EARTH_LEO_ASCENT_AUTHORITY_R2.requiredPropellantStateRef,
  highLiftStateRef: EARTH_LEO_ASCENT_AUTHORITY_R2.requiredHighLiftStateRef,
  departureSiteClass: EARTH_LEO_ASCENT_AUTHORITY_R2.requiredLaunchSiteClass,
  releaseSpeedMS: 170,
  targetPlaneResolved: true,
  targetInclinationDeg: 51.6,
}

function resolve(overrides: Partial<EarthAscentPhysicalState> = {}) {
  return resolveEarthAscentEngineeringAuthority({
    engineeringFrameId: EARTH_LEO_ASCENT_AUTHORITY_R2.engineeringFrameId,
    engineeringAuthorityRef: EARTH_LEO_ASCENT_AUTHORITY_R2.authorityId,
    departureSurfaceSlug: 'earth',
    target,
    physicalState: { ...physicalState, ...overrides },
  })
}

const authorized = resolve()
assert.equal(authorized.result, 'authorized')
assert.equal(authorized.authority?.profileId, 'ENG-EARTH-LEO-ASCENT-r2')
assert.equal(authorized.authority?.vehicleFrameId, 'ENG-SCV-0004')

const supersededFrame = resolveEarthAscentEngineeringAuthority({
  engineeringFrameId: 'ENG-SCV-0003',
  engineeringAuthorityRef: 'ENG-EARTH-LEO-ASCENT-r1',
  departureSurfaceSlug: 'earth',
  target,
  physicalState,
})
assert.equal(supersededFrame.result, 'frame-unmapped')
assert.equal(supersededFrame.authority, null)

const supersededAuthority = resolveEarthAscentEngineeringAuthority({
  engineeringFrameId: 'ENG-SCV-0004',
  engineeringAuthorityRef: 'ENG-EARTH-LEO-ASCENT-r1',
  departureSurfaceSlug: 'earth',
  target,
  physicalState,
})
assert.equal(supersededAuthority.result, 'authority-mismatch')

assert.equal(resolve({ actualStartMassKg: 748_341 }).result, 'over-mass')
assert.equal(resolve({ releaseSpeedMS: 169 }).result, 'insufficient-release-speed')
assert.equal(resolve({ propellantStateRef: null }).result, 'insufficient-propellant-authority')
assert.equal(resolve({ highLiftStateRef: null }).result, 'unsupported-high-lift-state')
assert.equal(resolve({ targetInclinationDeg: null }).result, 'unsupported-orbit')
assert.equal(resolve({ targetPlaneResolved: false }).result, 'unsupported-orbit')

console.log('Earth ascent Engineering r2 tests passed')
