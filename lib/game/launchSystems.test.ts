import assert from 'node:assert/strict'
import {
  assessLaunchSystemReadiness,
  carrierVehicleRequired,
  defaultLaunchEconomicDimensions,
  type LaunchSystemReadiness,
} from './launchSystems'

assert.equal(carrierVehicleRequired('vehicle-native-ascent'), false)
assert.equal(carrierVehicleRequired('carrier-rocket'), true)

const nativeReady: LaunchSystemReadiness = {
  selection: {
    architecture: 'vehicle-native-ascent',
    spacecraftId: 'ship-1',
    carrierVehicleId: null,
    launchSiteId: 'pad-1',
    reusability: 'not-applicable',
    ownership: 'player-owned',
  },
  evidence: {
    spacecraft: 'ready',
    launchArchitecture: 'ready',
    carrierVehicle: 'ready',
    launchSite: 'ready',
    payloadIntegration: 'ready',
    engineering: 'ready',
  },
  engineering: {
    architecture: 'vehicle-native-ascent',
    authorityId: 'eng-native-1',
    sourceRepository: 'thomaspeterkueper/kueper-engineering',
    sourceReference: 'native-authority',
  },
}
assert.deepEqual(assessLaunchSystemReadiness(nativeReady), {
  ready: true,
  blockers: [],
  unresolved: [],
})

const rocketUnresolved: LaunchSystemReadiness = {
  selection: {
    architecture: 'carrier-rocket',
    spacecraftId: 'ship-1',
    carrierVehicleId: null,
    launchSiteId: 'pad-1',
    reusability: 'partially-reusable',
    ownership: 'third-party-service',
  },
  evidence: {
    spacecraft: 'ready',
    launchArchitecture: 'ready',
    carrierVehicle: 'unresolved',
    launchSite: 'ready',
    payloadIntegration: 'unresolved',
    engineering: 'unresolved',
  },
  engineering: null,
}
const assessed = assessLaunchSystemReadiness(rocketUnresolved)
assert.equal(assessed.ready, false)
assert.deepEqual(assessed.blockers, [])
assert.deepEqual(assessed.unresolved, [
  'carrierVehicle',
  'payloadIntegration',
  'engineering',
  'engineering-authority',
])

const economics = defaultLaunchEconomicDimensions()
for (const [key, value] of Object.entries(economics)) {
  if (key === 'authority') assert.equal(value, null)
  else assert.equal(value, null, `economic dimension ${key} must not invent a default`)
}

console.log('launchSystems tests passed')
