import { strict as assert } from 'node:assert'
import { fillLocalElevationHoles, reconstructLocalTerrain } from './terrainReconstruction'

const grid = {
  stepM: 100,
  size: 3,
  values: [
    0, 0, 0,
    0, null, 20,
    0, 0, 0,
  ],
}

{
  const filled = fillLocalElevationHoles(grid, 1, 3)
  assert.equal(filled.observed[4], false)
  assert.ok(filled.values[4] != null)
  assert.ok((filled.confidence[4] ?? 0) > 0)
  assert.ok((filled.confidence[4] ?? 0) < 1)
}

{
  const surface = reconstructLocalTerrain(grid, { upsampleFactor: 2, sunAzimuthDeg: 315, sunAltitudeDeg: 25 })
  assert.equal(surface.size, 5)
  assert.equal(surface.stepM, 50)
  assert.equal(surface.sourceStepM, 100)
  assert.equal(surface.cells.length, 25)
  assert.ok(surface.coverage01 > 0.9)
  assert.ok(surface.cells.some(cell => cell && cell.slopeDeg > 0))
  assert.ok(surface.cells.every(cell => !cell || (cell.hillshade01 >= 0 && cell.hillshade01 <= 1)))
}

{
  const sparse = reconstructLocalTerrain({
    stepM: 50,
    size: 3,
    values: [
      10, null, null,
      null, null, null,
      null, null, 20,
    ],
  }, { upsampleFactor: 3, maxHoleRadiusCells: 1, minNeighbourCount: 3 })
  assert.ok(sparse.coverage01 < 0.5, 'large NoData gaps must remain unresolved instead of being invented')
}

console.log('terrainReconstruction.test: ok')
