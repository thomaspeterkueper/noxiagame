import type { TerrainSampleContext, TerrainSampler } from './terrainSampling'

export interface TerrainSurfaceRequest {
  minXM: number
  minYM: number
  maxXM: number
  maxYM: number
  columns: number
  rows: number
}

export interface TerrainSurfaceCell {
  xM: number
  yM: number
  zM: number | null
  hillshade: number | null
}

export interface TerrainSurface {
  columns: number
  rows: number
  minXM: number
  minYM: number
  maxXM: number
  maxYM: number
  stepXM: number
  stepYM: number
  resolvedCount: number
  cells: TerrainSurfaceCell[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function cellAt(surface: TerrainSurface, column: number, row: number) {
  if (column < 0 || row < 0 || column >= surface.columns || row >= surface.rows) return null
  return surface.cells[row * surface.columns + column] ?? null
}

/**
 * Builds a renderer-independent regular height surface in canonical local-world
 * metres. Missing terrain remains null; projection never invents elevation.
 */
export async function sampleTerrainSurface(
  sampler: TerrainSampler,
  context: TerrainSampleContext,
  request: TerrainSurfaceRequest,
): Promise<TerrainSurface> {
  if (request.columns < 2 || request.rows < 2) throw new Error('Terrain surface requires at least 2x2 samples')
  if (request.maxXM <= request.minXM || request.maxYM <= request.minYM) throw new Error('Terrain surface bounds are invalid')

  const stepXM = (request.maxXM - request.minXM) / (request.columns - 1)
  const stepYM = (request.maxYM - request.minYM) / (request.rows - 1)
  const cells: TerrainSurfaceCell[] = []
  let resolvedCount = 0

  for (let row = 0; row < request.rows; row += 1) {
    for (let column = 0; column < request.columns; column += 1) {
      const xM = request.minXM + column * stepXM
      const yM = request.minYM + row * stepYM
      const sample = await sampler.sampleTerrainHeight(context, { xM, yM })
      if (sample) resolvedCount += 1
      cells.push({ xM, yM, zM: sample?.zM ?? null, hillshade: null })
    }
  }

  return {
    ...request,
    stepXM,
    stepYM,
    resolvedCount,
    cells,
  }
}

/**
 * Adds normalized hillshade using central differences where complete neighbours
 * exist. The result is presentation data only: canonical z values are unchanged.
 */
export function withTerrainHillshade(
  surface: TerrainSurface,
  light = { east: -0.45, north: -0.55, up: 0.7 },
): TerrainSurface {
  const lightLength = Math.hypot(light.east, light.north, light.up)
  if (lightLength === 0) throw new Error('Hillshade light vector must be non-zero')
  const lx = light.east / lightLength
  const ly = light.north / lightLength
  const lz = light.up / lightLength

  const cells = surface.cells.map((cell, index) => {
    if (cell.zM == null) return { ...cell, hillshade: null }
    const row = Math.floor(index / surface.columns)
    const column = index % surface.columns
    const west = cellAt(surface, column - 1, row)
    const east = cellAt(surface, column + 1, row)
    const south = cellAt(surface, column, row - 1)
    const north = cellAt(surface, column, row + 1)
    if (west?.zM == null || east?.zM == null || south?.zM == null || north?.zM == null) {
      return { ...cell, hillshade: null }
    }

    const dzdx = (east.zM - west.zM) / (2 * surface.stepXM)
    const dzdy = (north.zM - south.zM) / (2 * surface.stepYM)
    const normalLength = Math.hypot(-dzdx, -dzdy, 1)
    const shade = ((-dzdx / normalLength) * lx) + ((-dzdy / normalLength) * ly) + ((1 / normalLength) * lz)
    return { ...cell, hillshade: clamp01(shade) }
  })

  return { ...surface, cells }
}
