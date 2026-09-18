import {
  ORBITAL_SURVEY_PLATFORM_CONTRACT,
  VEX_47_SURVEY_PLATFORM,
  canMountSurveyInstrument,
  surveyPlatformForExplorationAsset,
  validateSurveyObservation,
} from './surveyPlatforms'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const vex = surveyPlatformForExplorationAsset('vex_47')
assert(vex?.id === 'vex_47', 'VEX-47 exploration asset must resolve to the canonical survey platform')
assert(vex.availability === 'buildable', 'VEX-47 must remain buildable')
assert(canMountSurveyInstrument(vex, 'hyperspectral'), 'VEX-47 should accept non-contact hyperspectral payloads')
assert(!canMountSurveyInstrument(vex, 'core_sample'), 'VEX-47 must not silently act as a borehole sampler')
assert(!canMountSurveyInstrument(vex, 'orbital'), 'VEX-47 must not mount the orbital compatibility payload')

assert(ORBITAL_SURVEY_PLATFORM_CONTRACT.availability === 'contract_only', 'satellite must remain contract-only until a concrete spacecraft profile exists')
assert(ORBITAL_SURVEY_PLATFORM_CONTRACT.footprintKind === 'swath', 'orbital survey uses a swath footprint')
assert(canMountSurveyInstrument(ORBITAL_SURVEY_PLATFORM_CONTRACT, 'orbital'), 'orbital contract should accept the existing remote-sensing bridge')

const vexObservation = validateSurveyObservation({
  id: 'obs-vex-1',
  platformProfileId: 'vex_47',
  platformInstanceId: 'vehicle-vex-1',
  instrumentId: 'magnetometry',
  measuredAt: '2026-09-18T09:00:00.000Z',
  footprint: { kind: 'radius', lat: 50.1, lon: 8.6, radiusKm: 0.4 },
  spatialResolutionM: null,
  signalKeys: [],
}, VEX_47_SURVEY_PLATFORM)
assert(vexObservation.ok, 'valid VEX observation must be accepted without inventing spatial resolution')

const badVexObservation = validateSurveyObservation({
  id: 'obs-vex-2',
  platformProfileId: 'vex_47',
  platformInstanceId: 'vehicle-vex-1',
  instrumentId: 'core_sample',
  measuredAt: '2026-09-18T09:00:00.000Z',
  footprint: { kind: 'radius', lat: 50.1, lon: 8.6, radiusKm: 0.01 },
  spatialResolutionM: null,
  signalKeys: [],
}, VEX_47_SURVEY_PLATFORM)
assert('reason' in badVexObservation && badVexObservation.reason === 'instrument-unsupported', 'contact sampling must fail closed on VEX-47')

const orbitalObservation = validateSurveyObservation({
  id: 'obs-orbit-1',
  platformProfileId: 'orbital_survey_satellite',
  platformInstanceId: null,
  instrumentId: 'orbital',
  measuredAt: '2026-09-18T09:00:00.000Z',
  footprint: {
    kind: 'swath',
    centerline: [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }],
    swathWidthKm: null,
  },
  spatialResolutionM: null,
  signalKeys: [],
}, ORBITAL_SURVEY_PLATFORM_CONTRACT)
assert(orbitalObservation.ok, 'orbital contract must permit unresolved engineering width/resolution instead of guessing values')

console.log('surveyPlatforms tests passed')
