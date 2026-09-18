import assert from 'node:assert/strict'
import {
  arrivalPhaseAfterSuccessfulAscent,
  assessSurfaceToOrbitAscentReadiness,
  canAuthorizeAscent,
  nextAscentPhase,
  type SurfaceToOrbitAscentReadiness,
} from './ascentControl'

const ready: SurfaceToOrbitAscentReadiness = {
  spacecraftResolved: true,
  actorAuthorized: true,
  onDepartureSurface: true,
  destinationOrbitResolved: true,
  noActiveDockingConnection: true,
  noConflictingMission: true,
  crewReady: true,
  cargoReady: true,
  engineering: {
    vehicleFrameId: 'frame-approved-by-engineering',
    body: 'moon',
    profileId: 'eng-lunar-ascent-profile',
    sourceRepository: 'thomaspeterkueper/kueper-engineering',
    sourceReference: 'engineering-reference',
  },
}

assert.deepEqual(assessSurfaceToOrbitAscentReadiness(ready), { ready: true, blockers: [] })
assert.equal(canAuthorizeAscent('surface', ready), true)
assert.equal(canAuthorizeAscent('ascending', ready), false)

const blocked = assessSurfaceToOrbitAscentReadiness({
  ...ready,
  destinationOrbitResolved: false,
  engineering: null,
})
assert.equal(blocked.ready, false)
assert.deepEqual(blocked.blockers, [
  'destination-orbit-unresolved',
  'engineering-profile-unavailable',
])

assert.equal(nextAscentPhase('surface'), 'ascent-authorized')
assert.equal(nextAscentPhase('ascent-authorized'), 'ascending')
assert.equal(nextAscentPhase('ascending'), 'orbital-insertion')
assert.equal(nextAscentPhase('orbital-insertion'), 'orbital-arrival')
assert.equal(nextAscentPhase('orbital-arrival'), null)
assert.equal(nextAscentPhase('aborted'), null)

assert.equal(arrivalPhaseAfterSuccessfulAscent('orbital-arrival'), 'arrival-rendezvous')
assert.equal(arrivalPhaseAfterSuccessfulAscent('orbital-insertion'), null)

console.log('ascentControl tests passed')
