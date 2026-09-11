import { planetaryToLocalWorld } from './planetary'
import type { PlanetaryCoordinate, TerrainDatasetDescriptor, WorldFrame } from './types'
import type { TerrainRasterAdapter, TerrainRasterSourceSample } from './terrainRaster'

export interface MolaRasterImage {
  getWidth(): number
  getHeight(): number
  getBoundingBox(): [number, number, number, number]
  getGDALNoData?(): number | string | null
  readRasters(options: { window: [number, number, number, number]; samples: number[]; interleave: true }): Promise<ArrayLike<number>>
}

export type MolaRasterImageOpener = (url: string) => Promise<MolaRasterImage>
export type MolaVerticalConverter = (
  sourceElevationM: number,
  coordinate: PlanetaryCoordinate,
  dataset: TerrainDatasetDescriptor,
  frame: WorldFrame,
) => number | null

function metadataNumber(dataset: TerrainDatasetDescriptor, key: string, fallback: number) {
  const value = dataset.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function normalizeLongitude(lonDeg: number) {
  const normalized = ((lonDeg + 180) % 360 + 360) % 360 - 180
  return normalized === -180 ? 180 : normalized
}
function pixelForCoordinate(image: MolaRasterImage, coordinate: PlanetaryCoordinate) {
  const [minLon, minLat, maxLon, maxLat] = image.getBoundingBox()
  const lon = normalizeLongitude(coordinate.lonDeg), lat = coordinate.latDeg
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return null
  const xFraction = (lon - minLon) / (maxLon - minLon)
  const yFraction = (maxLat - lat) / (maxLat - minLat)
  return {
    x: Math.min(image.getWidth() - 1, Math.max(0, Math.floor(xFraction * image.getWidth()))),
    y: Math.min(image.getHeight() - 1, Math.max(0, Math.floor(yFraction * image.getHeight()))),
  }
}
function isNoData(image: MolaRasterImage, value: number) {
  const raw = image.getGDALNoData?.()
  if (raw == null) return false
  const noData = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(noData) && value === noData
}

/**
 * MOLA elevations are referenced to the GMM-2B areoid while the canonical
 * Mars world frame currently uses the IAU reference ellipsoid. Those are not
 * interchangeable vertical datums. A source sample can therefore become local
 * ENU height only when a datum converter is explicitly supplied (or when a
 * future frame uses the same vertical reference as the dataset).
 */
export class MolaTerrainAdapter implements TerrainRasterAdapter {
  readonly id = 'mars-mgs-mola-megdr'
  private imagePromise: Promise<MolaRasterImage> | null = null

  constructor(
    private readonly openImage: MolaRasterImageOpener,
    private readonly convertVertical?: MolaVerticalConverter,
  ) {}

  supports(dataset: TerrainDatasetDescriptor) {
    return dataset.id === 'mars_mgs_mola_463m'
  }

  private getImage(dataset: TerrainDatasetDescriptor) {
    if (!this.imagePromise) this.imagePromise = this.openImage(dataset.sourceUri)
    return this.imagePromise
  }

  async sampleAtPlanetary(dataset: TerrainDatasetDescriptor, frame: WorldFrame, coordinate: PlanetaryCoordinate): Promise<TerrainRasterSourceSample | null> {
    if (!this.supports(dataset)) return null
    const image = await this.getImage(dataset)
    const pixel = pixelForCoordinate(image, coordinate)
    if (!pixel) return null

    const raster = await image.readRasters({ window: [pixel.x, pixel.y, pixel.x + 1, pixel.y + 1], samples: [0], interleave: true })
    const storedValue = Number(raster[0])
    if (!Number.isFinite(storedValue) || isNoData(image, storedValue)) return null

    const sourceElevationM = storedValue * metadataNumber(dataset, 'stored_scale', 1) + metadataNumber(dataset, 'stored_offset', 0)
    let frameElevationM: number | null = sourceElevationM
    if (frame.verticalDatum && frame.verticalDatum !== dataset.verticalReference) {
      frameElevationM = this.convertVertical?.(sourceElevationM, coordinate, dataset, frame) ?? null
    }
    if (frameElevationM == null || !Number.isFinite(frameElevationM)) return null

    const local = planetaryToLocalWorld(
      { latDeg: coordinate.latDeg, lonDeg: coordinate.lonDeg, elevationM: frameElevationM },
      frame,
    )
    if (!local) return null

    return { sourceElevationM, localUpM: local.zM, tileKey: `source:${dataset.id}:${pixel.x}:${pixel.y}` }
  }
}

export const MARS_MOLA_DATASET: TerrainDatasetDescriptor = {
  id: 'mars_mgs_mola_463m',
  body: 'mars',
  provider: 'USGS Astrogeology / NASA MGS',
  datasetName: 'MOLA MEGDR Global DEM',
  datasetVersion: '2.0',
  datasetKind: 'dem',
  resolutionM: 463.0836,
  horizontalReference: 'IAU_MARS_PLANETOCENTRIC',
  verticalReference: 'MOLA_GMM2B_AREOID',
  latitudeType: 'planetocentric',
  longitudeDirection: 'positive_east',
  sourceUri: 'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif',
  sourceLicense: 'public-domain',
  accessMode: 'geotiff',
  status: 'catalogued',
  metadata: { pixels_per_degree: 128, stored_scale: 1, stored_offset: 0, source_family: 'MOLA MEGDR' },
}
