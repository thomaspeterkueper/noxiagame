import assert from 'node:assert/strict'
import {
  EARTH_SURFACE_ENGINEERING_PROFILES,
  resolveEarthSurfaceEngineeringProfile,
} from './earthSurfaceEngineering'

assert.equal(EARTH_SURFACE_ENGINEERING_PROFILES.length, 0)

const unresolved = resolveEarthSurfaceEngineeringProfile('cargo-rover-reference')
assert.equal(unresolved.status, 'unresolved')
if (unresolved.status === 'unresolved') {
  assert.equal(unresolved.frameId, 'cargo-rover-reference')
  assert.equal(unresolved.reason, 'frame-not-found')
}

const missing = resolveEarthSurfaceEngineeringProfile('')
assert.equal(missing.status, 'unresolved')
if (missing.status === 'unresolved') assert.equal(missing.reason, 'frame-id-required')

console.log('earth surface engineering registry tests passed')
