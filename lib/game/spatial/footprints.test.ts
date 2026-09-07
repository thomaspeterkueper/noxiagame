import { getBuildingFootprint, SPACEPORT_FOOTPRINTS } from './footprints'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const expected = {
  spaceport_core:         { widthM: 52,  depthM: 38, clearanceM: 6 },
  spaceport_pad_mini:     { widthM: 70,  depthM: 55, clearanceM: 10 },
  spaceport_pad_standard: { widthM: 120, depthM: 90, clearanceM: 15 },
  spaceport_service:      { widthM: 64,  depthM: 42, clearanceM: 6 },
  spaceport_storage:      { widthM: 72,  depthM: 48, clearanceM: 6 },
  landing_pad:            { widthM: 100, depthM: 80, clearanceM: 15 },
} as const

for (const [id, footprint] of Object.entries(expected)) {
  const actual = getBuildingFootprint(id)
  assert(actual.widthM === footprint.widthM, `${id}: width must stay canonical`)
  assert(actual.depthM === footprint.depthM, `${id}: depth must stay canonical`)
  assert(actual.clearanceM === footprint.clearanceM, `${id}: clearance must stay canonical`)
}

assert(
  getBuildingFootprint('spaceport_storage').widthM === SPACEPORT_FOOTPRINTS.spaceport_storage.widthM,
  'exact spaceport IDs must win over generic storage matching',
)
assert(
  getBuildingFootprint('spaceport_pad_standard').depthM >= 90,
  'standard pad must preserve apron depth for large surface craft',
)

console.log('spatial footprint tests passed')
