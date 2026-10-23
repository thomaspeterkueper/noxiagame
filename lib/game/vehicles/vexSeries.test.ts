import {
  VEX_SERIES_MILESTONES,
  getVexSeriesMilestone,
  isCanonicalVexModel,
  vexSeriesProgression,
} from './vexSeries'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const progression = vexSeriesProgression()
assert(progression[0]?.id === 'vex_01', 'VEX-01 must be the canonical origin of the series')
assert(progression.at(-1)?.id === 'vex_47', 'VEX-47 must remain the current bound high-end milestone')
assert(progression.every((model, i) => i === 0 || progression[i - 1]!.sequence < model.sequence), 'VEX milestone sequence must be strictly increasing')

const vex01 = getVexSeriesMilestone('vex_01')
assert(vex01?.canonStatus === 'canonical', 'VEX-01 origin is user canon')
assert(vex01.quantitativePerformance.rangeKm === null, 'VEX-01 range must remain unresolved until Engineering provides it')
assert(vex01.surveyBand === 'visual', 'VEX-01 must not silently gain advanced prospecting')

const vex47 = getVexSeriesMilestone('vex_47')
assert(vex47?.explorationAssetTypeId === 'vex_47', 'VEX-47 must remain bound to the existing exploration asset')
assert(vex47.availability === 'buildable', 'VEX-47 must remain buildable')
assert(isCanonicalVexModel('vex_47'), 'VEX-47 is canonical')
assert(!isCanonicalVexModel('vex_32'), 'intermediate proposed milestones must remain provisional')

assert(VEX_SERIES_MILESTONES.every(model =>
  model.quantitativePerformance.rangeKm === null &&
  model.quantitativePerformance.enduranceMinutes === null &&
  model.quantitativePerformance.payloadKg === null &&
  model.quantitativePerformance.powerWh === null
), 'series matrix must not invent Engineering performance values')

console.log('vexSeries tests passed')
