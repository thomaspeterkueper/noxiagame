import type { TerrainHeightSample } from './types'

export interface TerrainHeightSurface {
  originXM: number
  originYM: number
  stepM: number
  columns: number
  rows: number
  heightsM: number[]
}

export interface TerrainHillshade {
  columns: number
  rows: number
  values: number[]
}

export function createTerrainHeightSurface(
  samples: TerrainHeightSample[],
  stepM: number,
): TerrainHeightSurface {
  if (samples.length === 0) throw new Error('At least one terrain sample is required')
  if (!Number.isFinite(stepM) || stepM <= 0) throw new Error('Terrain surface stepM must be positive')

  const xs = [...new Set(samples.map(sample => sample.xM))].sort((a, b) => a - b)
  const ys = [...new Set(samples.map(sample => sample.yM))].sort((a, b) => a - b)
  const originXM = xs[0]
  const originYM = ys[0]
  const columns = Math.round((xs[xs.length - 1] - originXM) / stepM) + 1
  const rows = Math.round((ys[ys.length - 1] - originYM) / stepM) + 1
  const heightsM = new Array<number>(columns * rows).fill(Number.NaN)

  for (const sample of samples) {
    const column = Math.round((sample.xM - originXM) / stepM)
    const row = Math.round((sample.yM - originYM) / stepM)
    const expectedX = originXM + column * stepM
    const expectedY = originYM + row * stepM
    if (Math.abs(expectedX - sample.xM) > 1e-6 || Math.abs(expectedY - sample.yM) > 1e-6) {
      throw new Error('Terrain samples must lie on the requested metric surface grid')
    }
    const index = row * columns + column
    if (!Number.isNaN(heightsM[index])) throw new Error('Duplicate terrain sample on height surface')
    heightsM[index] = sample.zM
  }

  if (heightsM.some(Number.isNaN)) {
    throw new Error('Terrain height surface must be complete; unresolved cells may not be synthesized')
  }

  return { originXM, originYM, stepM, columns, rows, heightsM }
}

export function terrainHeightAt(surface: TerrainHeightSurface, column: number, row: number) {
  if (column < 0 || row < 0 || column >= surface.columns || row >= surface.rows) return null
  return surface.heightsM[row * surface.columns + column]
}

/**
 * Renderer-neutral analytical hillshade. Values are normalized 0..1 illumination,
 * not colors; 2D and isometric renderers can therefore consume the same terrain.
 */
export function deriveTerrainHillshade(
  surface: TerrainHeightSurface,
  azimuthDeg = 315,
  altitudeDeg = 45,
): TerrainHillshade {
  const azimuth = azimuthDeg * Math.PI / 180
  const altitude = altitudeDeg * Math.PI / 180
  const values = new Array<number>(surface.columns * surface.rows)

  const height = (column: number, row: number) => {
    const clampedColumn = Math.max(0, Math.min(surface.columns - 1, column))
    const clampedRow = Math.max(0, Math.min(surface.rows - 1, row))
    return surface.heightsM[clampedRow * surface.columns + clampedColumn]
  }

  for (let row = 0; row < surface.rows; row++) {
    for (let column = 0; column < surface.columns; column++) {
      const dzdx = (height(column + 1, row) - height(column - 1, row)) / (2 * surface.stepM)
      const dzdy = (height(column, row + 1) - height(column, row - 1)) / (2 * surface.stepM)
      const slope = Math.atan(Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)
      const illumination = Math.sin(altitude) * Math.cos(slope)
        + Math.cos(altitude) * Math.sin(slope) * Math.cos(azimuth - aspect)
      values[row * surface.columns + column] = Math.max(0, Math.min(1, illumination))
    }
  }

  return { columns: surface.columns, rows: surface.rows, values }
}
