import { planetaryToLocalWorld } from './planetary'
import type { LolaRasterImage, LolaRasterImageOpener } from './lolaTerrainAdapter'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'

export const SHACKLETON_POLAR_LOLA_DATASET_ID = 'moon_lro_lola_south_pole_5m'

const DEG = Math.PI / 180

function metadataNumber(dataset: TerrainDatasetDescriptor, key: string, fallback: number) {
  const value = dataset.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}

/**
 * Spherical south-polar stereographic projection used by the PGDA LOLA
 * south-pole products. The source GeoTIFF stores X/Y directly in meters.
 *
 * Keeping this transform in the terrain adapter is deliberate: gameplay and
 * rendering continue to use body-fixed coordinates + local ENU meters, while
 * source-specific projection semantics remain isolated here.
 */
export function lunarSouthPolarStereographic(
  coordinate: PlanetaryCoordinate,
  options: { radiusM?: number; centralLongitudeDeg?: number; xSign?: number; ySign?: number } = {},
) {
  const radiusM = options.radiusM ?? 1_737_400
  const centralLongitudeDeg = options.centralLongitudeDeg ?? 0
  const lat = coordinate.latDeg * DEG
  const lon = (normalizeLongitude(coordinate.lonDeg - centralLongitudeDeg)) * DEG
  const rho = 2 * radiusM * Math.tan(Math.PI / 4 + lat / 2)
  return {
    xM: (options.xSign ?? 1) * rho * Math.sin(lon),
    yM: (options.ySign ?? 1) * rho * Math.cos(lon),
  }
}

function pixelForProjectedCoordinate(
  image: LolaRasterImage,
  point: { xM: number; yM: number },
): { x: number; y: number } | null {
  const [minX, minY, maxX, maxY] = image.getBoundingBox()
  if (point.xM < minX || point.xM > maxX || point.yM < minY || point.yM > maxY) return null
  const width = image.getWidth()
  const height = image.getHeight()
  if (width <= 0 || height <= 0 || maxX === minX || maxY === minY) return null
  const xFraction = (point.xM - minX) / (maxX - minX)
  const yFraction = (maxY - point.yM) / (maxY - minY)
  return {
    x: Math.min(width - 1, Math.max(0, Math.floor(xFraction * width))),
    y: Math.min(height - 1, Math.max(0, Math.floor(yFraction * height))),
  }
}

function isNoData(image: LolaRasterImage, value: number) {
  const raw = image.getGDALNoData?.()
  if (raw == null) return false
  const noData = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(noData) && value === noData
}

export class LolaSouthPolarTerrainAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-south-pole-5m'
  private imagePromise: Promise<LolaRasterImage> | null = null

  constructor(private readonly openImage: LolaRasterImageOpener) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === SHACKLETON_POLAR_LOLA_DATASET_ID
  }

  private getImage(dataset: TerrainDatasetDescriptor) {
    if (!this.imagePromise) this.imagePromise = this.openImage(dataset.sourceUri)
    return this.imagePromise
  }

  async sampleAtPlanetary(
    dataset: TerrainDatasetDescriptor,
    frame: WorldFrame,
    coordinate: PlanetaryCoordinate,
  ): Promise<TerrainRasterSourceSample | null> {
    if (!this.supports(dataset)) return null
    const image = await this.getImage(dataset)
    const projected = lunarSouthPolarStereographic(coordinate, {
      radiusM: metadataNumber(dataset, 'projection_radius_m', 1_737_400),
      centralLongitudeDeg: metadataNumber(dataset, 'projection_center_lon_deg', 0),
      xSign: metadataNumber(dataset, 'projection_x_sign', 1),
      ySign: metadataNumber(dataset, 'projection_y_sign', 1),
    })
    const pixel = pixelForProjectedCoordinate(image, projected)
    if (!pixel) return null

    const raster = await image.readRasters({
      window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1],
      samples: [0],
      interleave: true,
    })
    const storedValue = Number(raster[0])
    if (!Number.isFinite(storedValue) || isNoData(image, storedValue)) return null

    // PGDA Site04 LDEM values are surface height Z in meters.
    const sourceElevationM = storedValue * metadataNumber(dataset, 'stored_scale', 1)
      + metadataNumber(dataset, 'stored_offset', 0)
    const local = planetaryToLocalWorld(
      { latDeg: coordinate.latDeg, lonDeg: coordinate.lonDeg, elevationM: sourceElevationM },
      frame,
    )
    if (!local) return null

    return {
      sourceElevationM,
      localUpM: local.zM,
      tileKey: `source:${dataset.id}:${pixel.x}:${pixel.y}`,
    }
  }
}
