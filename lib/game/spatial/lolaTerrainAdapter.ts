import { planetaryToLocalWorld } from './planetary'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'

export interface LolaRasterImage {
  getWidth(): number
  getHeight(): number
  getBoundingBox(): [number, number, number, number]
  getGDALNoData?(): number | string | null
  readRasters(options: {
    window: [number, number, number, number]
    samples: number[]
    interleave: true
  }): Promise<ArrayLike<number>>
}

export type LolaRasterImageOpener = (url: string) => Promise<LolaRasterImage>

function metadataNumber(dataset: TerrainDatasetDescriptor, key: string, fallback: number) {
  const value = dataset.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}

function pixelForCoordinate(
  image: LolaRasterImage,
  coordinate: PlanetaryCoordinate,
): { x: number; y: number } | null {
  const [minLon, minLat, maxLon, maxLat] = image.getBoundingBox()
  const width = image.getWidth()
  const height = image.getHeight()
  const lon = normalizeLongitude(coordinate.lonDeg)
  const lat = coordinate.latDeg

  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null

  const xFraction = (lon - minLon) / (maxLon - minLon)
  const yFraction = (maxLat - lat) / (maxLat - minLat)
  const x = Math.min(width - 1, Math.max(0, Math.floor(xFraction * width)))
  const y = Math.min(height - 1, Math.max(0, Math.floor(yFraction * height)))
  return { x, y }
}

function isNoData(image: LolaRasterImage, value: number) {
  const rawNoData = image.getGDALNoData?.()
  if (rawNoData == null) return false
  const noData = typeof rawNoData === 'number' ? rawNoData : Number(rawNoData)
  return Number.isFinite(noData) && value === noData
}

/**
 * Dataset-specific interpretation for the canonical global LRO/LOLA LDEM.
 *
 * TIFF decoding is injected deliberately. The spatial domain owns coordinate,
 * scaling, NoData and vertical-reference semantics; an ingestion/runtime adapter
 * owns the concrete byte decoder. This keeps renderers and gameplay independent
 * of a particular GeoTIFF library and avoids coupling the app bundle to an
 * 8-GB remote source.
 */
export class LolaTerrainAdapter implements TerrainRasterAdapter {
  readonly id = 'moon-lro-lola-118m'
  private imagePromise: Promise<LolaRasterImage> | null = null

  constructor(private readonly openImage: LolaRasterImageOpener) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'moon_lro_lola_118m'
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
    const pixel = pixelForCoordinate(image, coordinate)
    if (!pixel) return null

    const raster = await image.readRasters({
      window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1],
      samples: [0],
      interleave: true,
    })
    const storedValue = Number(raster[0])
    if (!Number.isFinite(storedValue) || isNoData(image, storedValue)) return null

    const scale = metadataNumber(dataset, 'stored_scale', 0.5)
    const offset = metadataNumber(dataset, 'stored_offset', 0)
    const sourceElevationM = storedValue * scale + offset

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
