import assert from 'node:assert/strict'
import { test } from 'node:test'
import { landmarkEntryDistance } from './landmarkEntryDistance'
import type { LocalSurfaceBuilding } from './localSurfaceScene'

const church: LocalSurfaceBuilding = {
  id: 'church', center: { xM: 0, yM: 0 }, widthM: 50, depthM: 30,
  rotationDeg: 0, provenance: 'observed',
}

test('large church is enterable near its boundary, even far from centre', () => {
  assert.equal(landmarkEntryDistance({ xM: 30, yM: 0 }, { xM: 0, yM: 0 }, [church]), 5)
})

test('unmapped POI falls back to point distance, not a nearby unrelated building', () => {
  assert.equal(landmarkEntryDistance({ xM: 30, yM: 0 }, { xM: 70, yM: 0 }, [church]), 40)
})

test('without geometry, existing point-distance interaction is retained', () => {
  assert.equal(landmarkEntryDistance({ xM: 10, yM: 0 }, { xM: 0, yM: 0 }, []), 10)
})

test('POI inside one of multiple buildings uses its host only', () => {
  const other: LocalSurfaceBuilding = { ...church, id: 'other', center: { xM: 80, yM: 0 } }
  assert.equal(landmarkEntryDistance({ xM: 30, yM: 0 }, { xM: 0, yM: 0 }, [other, church]), 5)
})
