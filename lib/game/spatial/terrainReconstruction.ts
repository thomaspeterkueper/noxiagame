export interface LocalElevationGrid {
  stepM: number
  size: number
  values: (number | null)[]
}

export interface TerrainReconstructionOptions {
  upsampleFactor?: number
  maxHoleRadiusCells?: number
  minNeighbourCount?: number
  sunAzimuthDeg?: number
  sunAltitudeDeg?: number
}

export interface ReconstructedTerrainCell {
  row: number
  col: number
  xM: number
  yM: number
  elevationM: number
  observed: boolean
  confidence: number
  normalizedHeight01: number
  slopeDeg: number
  hillshade01: number
}

export interface ReconstructedTerrainSurface {
  size: number
  stepM: number
  sourceStepM: number
  sourceSize: number
  coverage01: number
  minElevationM: number
  maxElevationM: number
  cells: (ReconstructedTerrainCell | null)[]
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value)
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function idx(size: number, row: number, col: number) {
  return row * size + col
}

function validateGrid(grid: LocalElevationGrid) {
  if (!Number.isInteger(grid.size) || grid.size < 2) throw new Error('terrain grid size must be >= 2')
  if (!Number.isFinite(grid.stepM) || grid.stepM <= 0) throw new Error('terrain grid stepM must be positive')
  if (grid.values.length !== grid.size * grid.size) throw new Error('terrain grid values must match size²')
}

/**
 * Fills only small, locally constrained DEM holes. It deliberately does not
 * extrapolate across large NoData regions: inferred values need enough nearby
 * observed samples and retain a lower confidence than observations.
 */
export function fillLocalElevationHoles(
  grid: LocalElevationGrid,
  maxRadiusCells = 1,
  minNeighbourCount = 3,
): { values: (number | null)[]; observed: boolean[]; confidence: number[] } {
  validateGrid(grid)
  const values = [...grid.values]
  const observed: boolean[] = grid.values.map(finite)
  const confidence: number[] = observed.map(value => value ? 1 : 0)
  const radius = Math.max(0, Math.floor(maxRadiusCells))

  if (radius === 0) return { values, observed, confidence }

  for (let row = 0; row < grid.size; row++) {
    for (let col = 0; col < grid.size; col++) {
      const target = idx(grid.size, row, col)
      if (finite(grid.values[target])) continue

      let weighted = 0
      let weightSum = 0
      let neighbours = 0
      let nearest = Infinity
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (dr === 0 && dc === 0) continue
          const rr = row + dr, cc = col + dc
          if (rr < 0 || cc < 0 || rr >= grid.size || cc >= grid.size) continue
          const value = grid.values[idx(grid.size, rr, cc)]
          if (!finite(value)) continue
          const distance = Math.hypot(dr, dc)
          const weight = 1 / Math.max(distance, 0.5)
          weighted += value * weight
          weightSum += weight
          neighbours++
          nearest = Math.min(nearest, distance)
        }
      }
      if (neighbours < minNeighbourCount || weightSum <= 0) continue
      values[target] = weighted / weightSum
      confidence[target] = clamp01(0.62 + 0.05 * Math.min(neighbours, 5) - 0.08 * Math.max(0, nearest - 1))
    }
  }
  return { values, observed, confidence }
}

function bilinear(
  size: number,
  values: (number | null)[],
  confidence: number[],
  sourceRow: number,
  sourceCol: number,
) {
  const r0 = Math.floor(sourceRow), c0 = Math.floor(sourceCol)
  const r1 = Math.min(size - 1, r0 + 1), c1 = Math.min(size - 1, c0 + 1)
  if (r0 < 0 || c0 < 0 || r0 >= size || c0 >= size) return null
  const tr = sourceRow - r0, tc = sourceCol - c0
  const corners = [
    { r: r0, c: c0, w: (1 - tr) * (1 - tc) },
    { r: r0, c: c1, w: (1 - tr) * tc },
    { r: r1, c: c0, w: tr * (1 - tc) },
    { r: r1, c: c1, w: tr * tc },
  ]
  let z = 0, total = 0, conf = 0
  for (const corner of corners) {
    if (corner.w <= 0) continue
    const i = idx(size, corner.r, corner.c)
    const value = values[i]
    if (!finite(value)) continue
    z += value * corner.w
    conf += confidence[i] * corner.w
    total += corner.w
  }
  // Do not stretch a lone value over a large unsupported area.
  if (total < 0.74) return null
  return { elevationM: z / total, confidence: clamp01(conf / total) }
}

function sampleElevation(size: number, values: (number | null)[], row: number, col: number) {
  const rr = Math.max(0, Math.min(size - 1, row))
  const cc = Math.max(0, Math.min(size - 1, col))
  return values[idx(size, rr, cc)]
}

function lightVector(azimuthDeg: number, altitudeDeg: number) {
  const az = azimuthDeg * Math.PI / 180
  const alt = altitudeDeg * Math.PI / 180
  // azimuth: 0° north, 90° east; local axes x=east, y=north, z=up.
  return {
    x: Math.cos(alt) * Math.sin(az),
    y: Math.cos(alt) * Math.cos(az),
    z: Math.sin(alt),
  }
}

/**
 * Body-independent local terrain reconstruction. Spherical/ellipsoidal body
 * geometry is resolved before this stage by the shared body-fixed -> tangent
 * frame pipeline. The renderer therefore works purely in local metres and can
 * be reused for Earth, Moon, Mars and later planetary bodies.
 */
export function reconstructLocalTerrain(
  grid: LocalElevationGrid,
  options: TerrainReconstructionOptions = {},
): ReconstructedTerrainSurface {
  validateGrid(grid)
  const factor = Math.max(1, Math.floor(options.upsampleFactor ?? 4))
  const filled = fillLocalElevationHoles(
    grid,
    options.maxHoleRadiusCells ?? 1,
    options.minNeighbourCount ?? 3,
  )
  const outSize = (grid.size - 1) * factor + 1
  const outStepM = grid.stepM / factor
  const values: (number | null)[] = new Array(outSize * outSize).fill(null)
  const confidence: number[] = new Array(outSize * outSize).fill(0)
  const observed: boolean[] = new Array(outSize * outSize).fill(false)

  for (let row = 0; row < outSize; row++) {
    for (let col = 0; col < outSize; col++) {
      const sourceRow = row / factor, sourceCol = col / factor
      const sample = bilinear(grid.size, filled.values, filled.confidence, sourceRow, sourceCol)
      if (!sample) continue
      const target = idx(outSize, row, col)
      values[target] = sample.elevationM
      confidence[target] = sample.confidence
      if (row % factor === 0 && col % factor === 0) {
        observed[target] = filled.observed[idx(grid.size, row / factor, col / factor)]
      }
    }
  }

  const finiteValues = values.filter(finite)
  const minElevationM = finiteValues.length ? Math.min(...finiteValues) : 0
  const maxElevationM = finiteValues.length ? Math.max(...finiteValues) : 0
  const span = Math.max(1e-9, maxElevationM - minElevationM)
  const light = lightVector(options.sunAzimuthDeg ?? 315, options.sunAltitudeDeg ?? 24)
  const half = (outSize - 1) / 2
  const cells: (ReconstructedTerrainCell | null)[] = new Array(outSize * outSize).fill(null)

  for (let row = 0; row < outSize; row++) {
    for (let col = 0; col < outSize; col++) {
      const current = values[idx(outSize, row, col)]
      if (!finite(current)) continue
      const left = sampleElevation(outSize, values, row, col - 1)
      const right = sampleElevation(outSize, values, row, col + 1)
      const north = sampleElevation(outSize, values, row - 1, col)
      const south = sampleElevation(outSize, values, row + 1, col)
      const dzdx = finite(left) && finite(right) ? (right - left) / (2 * outStepM) : 0
      // Grid row grows southward, while local y grows northward.
      const dzdy = finite(north) && finite(south) ? (north - south) / (2 * outStepM) : 0
      const norm = Math.hypot(dzdx, dzdy, 1)
      const nx = -dzdx / norm, ny = -dzdy / norm, nz = 1 / norm
      const shade = clamp01(0.5 + 0.5 * (nx * light.x + ny * light.y + nz * light.z))
      const slopeDeg = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI
      const i = idx(outSize, row, col)
      cells[i] = {
        row,
        col,
        xM: (col - half) * outStepM,
        yM: (half - row) * outStepM,
        elevationM: current,
        observed: observed[i],
        confidence: confidence[i],
        normalizedHeight01: clamp01((current - minElevationM) / span),
        slopeDeg,
        hillshade01: shade,
      }
    }
  }

  return {
    size: outSize,
    stepM: outStepM,
    sourceStepM: grid.stepM,
    sourceSize: grid.size,
    coverage01: cells.filter(Boolean).length / cells.length,
    minElevationM,
    maxElevationM,
    cells,
  }
}
