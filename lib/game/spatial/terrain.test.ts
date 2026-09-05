import { footprintSamplePoints, summarizeTerrainFootprint } from './terrain'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const points = footprintSamplePoints({ xM: 100, yM: 200, zM: null, widthM: 60, depthM: 40, rotationDeg: 0 })
assert(points.length === 9, 'footprint sampling must include center, corners and edge midpoints')
assert(points[0].xM === 100 && points[0].yM === 200, 'first sample must be footprint center')

const samples = points.map((point, index) => ({ ...point, zM: 300 + index }))
const summary = summarizeTerrainFootprint(samples)
assert(summary.sampleCount === 9, 'terrain summary must retain sample count')
assert(summary.minZM === 300 && summary.maxZM === 308, 'terrain summary must track elevation range')
assert(summary.foundationZM === 304, 'foundation height must use the sample median')
assert(summary.reliefM === 8, 'terrain relief must be max minus min')
assert(summary.maxSlopeDeg > 0, 'non-flat samples must produce a slope')

console.log('terrain footprint tests passed')
